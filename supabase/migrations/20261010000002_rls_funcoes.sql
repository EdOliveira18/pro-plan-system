-- Pro Plan System · segurança por empresa (RLS) e funções de negócio

-- ============ Helpers de acesso ============
create or replace function eh_membro(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros m where m.empresa_id = eid and m.user_id = auth.uid() and m.ativo);
$$;

create or replace function papel_em(eid uuid) returns papel_membro
language sql stable security definer set search_path = public as $$
  select m.papel from membros m where m.empresa_id = eid and m.user_id = auth.uid() and m.ativo;
$$;

create or replace function eh_gestor(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_em(eid) in ('dono','gerente'), false);
$$;

-- o contador precisa escrever mesmo com RLS ligada
alter function gerar_numero_contrato() security definer set search_path = public;
alter function tocar_updated_at() set search_path = public;

-- ============ RLS ============
alter table empresas enable row level security;
alter table membros enable row level security;
alter table configuracoes enable row level security;
alter table contador_contratos enable row level security;

create policy empresas_ler on empresas for select using (eh_membro(id));
create policy empresas_editar on empresas for update using (eh_gestor(id)) with check (eh_gestor(id));

create policy membros_ler on membros for select using (eh_membro(empresa_id));
create policy membros_gerir on membros for all using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));

create policy cfg_ler on configuracoes for select using (eh_membro(empresa_id));
create policy cfg_editar on configuracoes for update using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));
-- contador_contratos: sem policies, só o trigger (security definer) mexe

-- tabelas de operação: qualquer membro ativo da empresa lê e escreve
do $$
declare t text;
begin
  foreach t in array array['campanhas','parceiros','clientes','leads','orcamentos','ambientes','pecas','contratos',
    'marcos','historico_workflow','arquivos','renders','checkins','chamados','notas_fiscais']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all using (eh_membro(empresa_id)) with check (eh_membro(empresa_id))', t||'_membro', t);
  end loop;
end $$;

-- financeiro sensível: montador não enxerga lançamentos
alter table lancamentos enable row level security;
create policy lancamentos_membro on lancamentos for all
  using (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador')
  with check (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador');

-- ============ Onboarding ============
create or replace function criar_empresa(p_nome text, p_cnpj text, p_nome_usuario text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid; uid uuid := auth.uid(); mail text;
begin
  if uid is null then raise exception 'Faça login para criar a empresa'; end if;
  select email into mail from auth.users where id = uid;
  insert into empresas(nome, cnpj) values (p_nome, nullif(p_cnpj,'')) returning id into eid;
  insert into membros(empresa_id, user_id, nome, email, papel) values (eid, uid, coalesce(nullif(p_nome_usuario,''), mail, 'Dono'), mail, 'dono');
  insert into configuracoes(empresa_id) values (eid);
  insert into campanhas(empresa_id, nome, canal) values
    (eid, 'Indicação de arquiteto', 'indicacao'), (eid, 'Orgânico / loja física', 'organico');
  return eid;
end $$;

-- ============ Fechamento: orçamento vira contrato ============
-- Recebe os números do olhinho calculados no servidor e revalida a trava de pontuação no banco.
create or replace function fechar_orcamento(
  p_orcamento_id uuid,
  p_valor_total numeric, p_vpl numeric, p_custo_previsto numeric, p_lucro_previsto numeric,
  p_custo_fabrica numeric, p_valor_rt numeric,
  p_endereco_obra text default null,
  p_liberar_abaixo_minimo boolean default false
) returns uuid
language plpgsql set search_path = public as $$
declare
  o orcamentos%rowtype; cfg configuracoes%rowtype; cid uuid; pts numeric; fab numeric; tab numeric;
  sla jsonb; acum int := 0; tipos marco_tipo[] := array['medicao','liberacao','fabricacao','material','montagem','conclusao']::marco_tipo[];
  i int; parcela numeric; camp uuid;
begin
  select * into o from orcamentos where id = p_orcamento_id for update;
  if not found then raise exception 'Orçamento não encontrado'; end if;
  if o.status = 'fechado' then raise exception 'Este orçamento já virou contrato'; end if;
  select * into cfg from configuracoes where empresa_id = o.empresa_id;

  select coalesce(sum(custo_fabrica),0), coalesce(sum(custo_fabrica*pontuacao),0) into fab, tab
  from ambientes where orcamento_id = o.id and versao = 1;
  if fab <= 0 then raise exception 'Adicione pelo menos um ambiente com custo antes de fechar'; end if;
  pts := tab * (1 - o.desconto_pct/100) / fab;

  if pts < cfg.pontuacao_minima then
    if not p_liberar_abaixo_minimo then
      raise exception 'TRAVA_PONTUACAO: pontuação média % abaixo do mínimo %', round(pts,2), cfg.pontuacao_minima;
    end if;
    if not eh_gestor(o.empresa_id) then
      raise exception 'Somente dono ou gerente pode liberar venda abaixo da pontuação mínima';
    end if;
  end if;

  select campanha_id into camp from clientes where id = o.cliente_id;

  insert into contratos(empresa_id, orcamento_id, cliente_id, vendedor_id, parceiro_id, campanha_id,
    valor_total, vpl, custo_previsto, lucro_previsto, forma_pagamento, parcelas, endereco_obra,
    assinatura_empresa, assinatura_cliente)
  values (o.empresa_id, o.id, o.cliente_id, coalesce(o.vendedor_id, auth.uid()), o.parceiro_id, camp,
    p_valor_total, p_vpl, p_custo_previsto, p_lucro_previsto, o.forma_pagamento, o.parcelas,
    coalesce(p_endereco_obra, (select endereco from clientes where id = o.cliente_id)),
    'pendente', 'pendente')
  returning id into cid;

  -- 6 marcos com SLA acumulado a partir da data da venda
  sla := cfg.sla_marcos;
  for i in 1..6 loop
    acum := acum + coalesce((sla ->> tipos[i]::text)::int, 7);
    insert into marcos(empresa_id, contrato_id, tipo, ordem, sla_dias, previsto_em)
    values (o.empresa_id, cid, tipos[i], i, coalesce((sla ->> tipos[i]::text)::int, 7), current_date + acum);
  end loop;

  insert into historico_workflow(empresa_id, contrato_id, etapa, por) values (o.empresa_id, cid, 'pedido_liberado', auth.uid());

  -- lançamentos previstos: parcelas de recebimento, fábrica e RT
  parcela := round(p_valor_total / o.parcelas, 2);
  for i in 1..o.parcelas loop
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor)
    values (o.empresa_id, cid, current_date + (case when o.forma_pagamento = 'avista' then 0 else 30*i end),
      'Parcela ' || i || '/' || o.parcelas, 'recebimento',
      case when i = o.parcelas then p_valor_total - parcela*(o.parcelas-1) else parcela end);
  end loop;
  insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor)
  values (o.empresa_id, cid, current_date + 15, 'Pedido de fábrica', 'fabrica', -p_custo_fabrica);
  if p_valor_rt > 0 then
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor)
    values (o.empresa_id, cid, current_date + 30, 'Comissão RT parceiro', 'comissao_rt', -p_valor_rt);
  end if;

  update orcamentos set status = 'fechado' where id = o.id;
  if o.lead_id is not null then update leads set etapa = 'ganho' where id = o.lead_id; end if;
  return cid;
end $$;

-- ============ Radar: concluir o marco atual ============
create or replace function concluir_marco(p_contrato_id uuid) returns marco_tipo
language plpgsql set search_path = public as $$
declare c contratos%rowtype; prox marco_tipo;
begin
  select * into c from contratos where id = p_contrato_id for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  update marcos set concluido_em = now(), concluido_por = auth.uid()
   where contrato_id = c.id and tipo = c.marco_atual and concluido_em is null;
  select tipo into prox from marcos where contrato_id = c.id and concluido_em is null order by ordem limit 1;
  if prox is null then
    update contratos set encerrado = true where id = c.id;
    return c.marco_atual;
  end if;
  update contratos set marco_atual = prox where id = c.id;
  return prox;
end $$;

-- ============ Workflow industrial: avançar etapa ============
create or replace function avancar_workflow(p_contrato_id uuid) returns etapa_workflow
language plpgsql set search_path = public as $$
declare atual etapa_workflow; nova etapa_workflow; vals etapa_workflow[] := enum_range(null::etapa_workflow); idx int;
begin
  select etapa_workflow into atual from contratos where id = p_contrato_id for update;
  if not found then raise exception 'Contrato não encontrado'; end if;
  idx := array_position(vals, atual);
  if idx >= array_length(vals,1) then return atual; end if;
  nova := vals[idx+1];
  update contratos set etapa_workflow = nova where id = p_contrato_id;
  insert into historico_workflow(empresa_id, contrato_id, etapa, por)
  select empresa_id, id, nova, auth.uid() from contratos where id = p_contrato_id;
  -- auto-avanço do radar: expedição libera "material na loja", entregue conclui fabricação se pendente
  if nova = 'expedicao' then
    update marcos set concluido_em = coalesce(concluido_em, now()) where contrato_id = p_contrato_id and ordem <= 3;
    update contratos set marco_atual = 'material' where id = p_contrato_id and marco_atual in ('medicao','liberacao','fabricacao');
  end if;
  return nova;
end $$;

grant execute on function criar_empresa(text,text,text) to authenticated;
grant execute on function fechar_orcamento(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean) to authenticated;
grant execute on function concluir_marco(uuid) to authenticated;
grant execute on function avancar_workflow(uuid) to authenticated;
