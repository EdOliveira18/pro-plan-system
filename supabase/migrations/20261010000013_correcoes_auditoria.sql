-- Correções da auditoria técnica: convites por link, CNPJ verificado, planos e limites, permissões,
-- sigilo de salários, estoque com conversão de unidade, regras de faturamento e índices.

create or replace function eh_financeiro(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(papel_em(eid) in ('dono','gerente','financeiro'), false);
$$;
revoke execute on function eh_financeiro(uuid) from public, anon;
grant execute on function eh_financeiro(uuid) to authenticated;

-- ============ ADMIN DA PLATAFORMA (dono do Pro Plan System) ============
create table if not exists plataforma_admins (email text primary key);
alter table plataforma_admins enable row level security;  -- ninguém lê pela API; só funções internas
insert into plataforma_admins(email) values ('edwagner02002@gmail.com') on conflict do nothing;

create or replace function eh_admin_plataforma() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from plataforma_admins a join auth.users u on lower(u.email) = lower(a.email) where u.id = auth.uid());
$$;
revoke execute on function eh_admin_plataforma() from public, anon;
grant execute on function eh_admin_plataforma() to authenticated;

-- ============ PLANOS, LIMITES E CNPJ VERIFICADO ============
alter table empresas
  add column if not exists plano text not null default 'teste' check (plano in ('teste','basico','pro','cortesia','suspenso')),
  add column if not exists plano_ate date not null default (current_date + 14),
  add column if not exists limite_renders int not null default 20,
  add column if not exists cnpj_verificado boolean not null default false;

-- o gestor da loja não pode mexer no próprio plano nem se autoverificar: só via funções da plataforma
create or replace function proteger_campos_plataforma() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('pps.plataforma', true), '') <> '1' then
    if new.plano is distinct from old.plano or new.plano_ate is distinct from old.plano_ate
       or new.limite_renders is distinct from old.limite_renders or new.cnpj_verificado is distinct from old.cnpj_verificado then
      raise exception 'Plano e verificação de CNPJ só podem ser alterados pela administração do Pro Plan System';
    end if;
  end if;
  if new.cnpj is distinct from old.cnpj then new.cnpj_verificado := false; end if;
  return new;
end $$;
create trigger empresas_campos_plataforma before update on empresas for each row execute function proteger_campos_plataforma();

-- CNPJ deixa de ser "primeiro que cadastrar leva": só não pode haver dois CNPJs iguais verificados
drop index if exists empresas_cnpj_unico;
create unique index if not exists empresas_cnpj_verificado_unico on empresas (regexp_replace(cnpj, '\D', '', 'g')) where cnpj is not null and cnpj_verificado;

create or replace function admin_empresas() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Acesso restrito'; end if;
  return coalesce((select json_agg(x order by x.created_at desc) from (
    select e.id, e.nome, e.razao_social, e.cnpj, e.cnpj_verificado, e.plano, e.plano_ate, e.limite_renders, e.created_at,
      (select string_agg(m.email, ', ') from membros m where m.empresa_id = e.id and m.papel = 'dono') as donos,
      (select count(*) from membros m where m.empresa_id = e.id and m.ativo) as usuarios,
      (select count(*) from renders r where r.empresa_id = e.id and r.created_at >= date_trunc('month', now()) and r.status in ('concluido','processando')) as renders_mes,
      (select json_build_object('cnpj', c.cnpj, 'razao', c.razao_social, 'valido_ate', c.valido_ate) from certificados c where c.empresa_id = e.id) as certificado
    from empresas e) x), '[]'::json);
end $$;

create or replace function admin_definir_plano(p_empresa uuid, p_plano text, p_ate date, p_limite int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Acesso restrito'; end if;
  perform set_config('pps.plataforma', '1', true);
  update empresas set plano = p_plano, plano_ate = p_ate, limite_renders = greatest(0, p_limite) where id = p_empresa;
  perform set_config('pps.plataforma', '', true);
end $$;

create or replace function admin_verificar_cnpj(p_empresa uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Acesso restrito'; end if;
  perform set_config('pps.plataforma', '1', true);
  update empresas set cnpj_verificado = p_ok where id = p_empresa;
  perform set_config('pps.plataforma', '', true);
end $$;
revoke execute on function admin_empresas() from public, anon;
revoke execute on function admin_definir_plano(uuid, text, date, int) from public, anon;
revoke execute on function admin_verificar_cnpj(uuid, boolean) from public, anon;
grant execute on function admin_empresas() to authenticated;
grant execute on function admin_definir_plano(uuid, text, date, int) to authenticated;
grant execute on function admin_verificar_cnpj(uuid, boolean) to authenticated;

-- empresas já existentes (demonstração) ficam ativas
select set_config('pps.plataforma', '1', true);
update empresas set plano = 'cortesia', plano_ate = '2099-12-31', limite_renders = 200 where plano = 'teste';
select set_config('pps.plataforma', '', true);

-- no máximo 3 empresas por usuário (evita abuso de contas de teste); admin da plataforma sem limite
create or replace function criar_empresa(p_nome text, p_cnpj text, p_nome_usuario text)
returns uuid language plpgsql security definer set search_path = public as $$
declare eid uuid; uid uuid := auth.uid(); mail text;
begin
  if uid is null then raise exception 'Faça login para criar a empresa'; end if;
  if not eh_admin_plataforma() and (select count(*) from membros where user_id = uid and papel = 'dono') >= 3 then
    raise exception 'LIMITE_EMPRESAS: cada usuário pode criar até 3 empresas. Fale com o suporte para liberar mais.';
  end if;
  select email into mail from auth.users where id = uid;
  insert into empresas(nome, cnpj) values (p_nome, nullif(p_cnpj,'')) returning id into eid;
  insert into membros(empresa_id, user_id, nome, email, papel) values (eid, uid, coalesce(nullif(p_nome_usuario,''), mail, 'Dono'), mail, 'dono');
  insert into configuracoes(empresa_id) values (eid);
  insert into campanhas(empresa_id, nome, canal) values
    (eid, 'Indicação de arquiteto', 'indicacao'), (eid, 'Orgânico / loja física', 'organico');
  return eid;
end $$;

-- ============ CONVITES SÓ PELO LINK ============
alter table convites
  add column if not exists token uuid not null default gen_random_uuid(),
  add column if not exists expira_em timestamptz not null default (now() + interval '7 days');
create unique index if not exists convites_token on convites(token);

-- a aceitação automática por e-mail deixa de existir (alguém poderia criar conta com o e-mail do convidado)
create or replace function aceitar_convites() returns int
language sql security definer set search_path = public as $$ select 0 $$;

create or replace function aceitar_convite(p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text; c convites;
begin
  if uid is null then raise exception 'Faça login para aceitar o convite'; end if;
  select * into c from convites where token = p_token;
  if c.id is null then raise exception 'CONVITE_INVALIDO'; end if;
  if c.aceito_em is not null then raise exception 'CONVITE_USADO'; end if;
  if c.expira_em < now() then raise exception 'CONVITE_EXPIRADO'; end if;
  select email into mail from auth.users where id = uid;
  if lower(mail) <> lower(c.email) then raise exception 'CONVITE_OUTRO_EMAIL: este convite é para %', c.email; end if;
  insert into membros(empresa_id, user_id, nome, email, papel) values (c.empresa_id, uid, c.nome, mail, c.papel)
  on conflict (empresa_id, user_id) do update set ativo = true, papel = excluded.papel;
  update convites set aceito_em = now() where id = c.id;
  return json_build_object('empresa_id', c.empresa_id, 'empresa', (select nome from empresas where id = c.empresa_id));
end $$;

create or replace function convite_publico(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('empresa', e.nome, 'email', c.email, 'nome', c.nome, 'papel', c.papel, 'valido', c.aceito_em is null and c.expira_em > now())
  from convites c join empresas e on e.id = c.empresa_id where c.token = p_token;
$$;
revoke execute on function aceitar_convite(uuid) from public, anon;
grant execute on function aceitar_convite(uuid) to authenticated;
grant execute on function convite_publico(uuid) to anon, authenticated;

-- ============ SIGILO: salário, pró-labore e dados bancários de funcionários e sócios ============
create table if not exists pessoas_sigilo (
  pessoa_id uuid primary key references pessoas(id) on delete cascade,
  empresa_id uuid not null references empresas(id) on delete cascade,
  salario numeric(14,2), pro_labore numeric(14,2), participacao_pct numeric(6,3), comissao_pct numeric(6,3),
  dia_pagamento int, banco text, agencia text, conta text, pix_tipo text, pix_chave text
);
alter table pessoas_sigilo enable row level security;
create policy pessoas_sigilo_fin on pessoas_sigilo for all to authenticated using (eh_financeiro(empresa_id)) with check (eh_financeiro(empresa_id));
insert into pessoas_sigilo(pessoa_id, empresa_id, salario, pro_labore, participacao_pct, comissao_pct, dia_pagamento, banco, agencia, conta, pix_tipo, pix_chave)
select id, empresa_id, salario, pro_labore, participacao_pct, comissao_pct, dia_pagamento, banco, agencia, conta, pix_tipo, pix_chave
from pessoas where categoria in ('funcionario','socio') on conflict do nothing;
update pessoas set salario = null, pro_labore = null, participacao_pct = null, comissao_pct = null, dia_pagamento = null,
  banco = null, agencia = null, conta = null, pix_tipo = null, pix_chave = null where categoria in ('funcionario','socio');
-- impede que esses dados voltem a ser gravados na tabela aberta
create or replace function pessoas_sem_sigilo() returns trigger language plpgsql set search_path = public as $$
begin
  if new.categoria in ('funcionario','socio') then
    new.salario := null; new.pro_labore := null; new.participacao_pct := null; new.comissao_pct := null; new.dia_pagamento := null;
    new.banco := null; new.agencia := null; new.conta := null; new.pix_tipo := null; new.pix_chave := null;
  end if;
  return new;
end $$;
create trigger pessoas_sem_sigilo before insert or update on pessoas for each row execute function pessoas_sem_sigilo();

-- agora toda a equipe enxerga nomes e funções (para escolher responsável, montador, técnico)
create policy pessoas_ler_equipe on pessoas for select to authenticated using (eh_membro(empresa_id));

-- ============ FINANCEIRO SÓ PARA DONO, GERENTE E FINANCEIRO ============
do $$ declare t text; begin
  foreach t in array array['lancamentos','contas_bancarias','extrato','conexoes_bancarias','recorrencias'] loop
    execute format('create policy %I on %I as restrictive for all to authenticated using (eh_financeiro(empresa_id)) with check (eh_financeiro(empresa_id))', t || '_so_financeiro', t);
  end loop;
end $$;
-- montador não vê orçamentos (valores de venda)
create policy orcamentos_sem_montador on orcamentos as restrictive for all to authenticated
  using (papel_em(empresa_id) <> 'montador') with check (papel_em(empresa_id) <> 'montador');
-- excluir cadastros é só para dono e gerente
do $$ declare t text; begin
  foreach t in array array['clientes','parceiros','leads','pessoas','campanhas'] loop
    execute format('create policy %I on %I as restrictive for delete to authenticated using (eh_gestor(empresa_id))', t || '_apagar_gestor', t);
  end loop;
end $$;

-- ============ ESTOQUE: conversão de unidade e ajustes rastreados ============
alter table estoque_movimentos add column if not exists observacao text;

-- produto novo com quantidade inicial gera o movimento de abertura
create or replace function estoque_inicial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.estoque <> 0 then
    insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, por, observacao)
    values (new.empresa_id, new.id, 'ajuste', new.estoque, case when new.fator_conversao > 0 then new.valor_final / new.fator_conversao else new.valor_final end, auth.uid(), 'Estoque inicial do cadastro');
  end if;
  return null;
end $$;
create trigger produtos_estoque_inicial after insert on produtos for each row execute function estoque_inicial();

-- o saldo só muda por pedido ou por ajuste com motivo
create or replace function proteger_estoque() returns trigger language plpgsql set search_path = public as $$
begin
  if new.estoque is distinct from old.estoque and coalesce(current_setting('pps.estoque', true), '') <> '1' then
    new.estoque := old.estoque;
  end if;
  return new;
end $$;
create trigger produtos_proteger_estoque before update on produtos for each row execute function proteger_estoque();

create or replace function ajustar_estoque(p_produto uuid, p_quantidade numeric, p_motivo text) returns void
language plpgsql security definer set search_path = public as $$
declare p produtos;
begin
  select * into p from produtos where id = p_produto for update;
  if p.id is null or not eh_membro(p.empresa_id) or papel_em(p.empresa_id) = 'montador' then raise exception 'SEM_PERMISSAO'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'Informe o motivo do ajuste'; end if;
  perform set_config('pps.estoque', '1', true);
  update produtos set estoque = p_quantidade where id = p.id;
  insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, por, observacao)
  values (p.empresa_id, p.id, 'ajuste', p_quantidade - p.estoque, case when p.fator_conversao > 0 then p.valor_final / p.fator_conversao else p.valor_final end, auth.uid(), left(p_motivo, 300));
  perform set_config('pps.estoque', '', true);
end $$;
revoke execute on function ajustar_estoque(uuid, numeric, text) from public, anon;
grant execute on function ajustar_estoque(uuid, numeric, text) to authenticated;

-- compra entra na unidade de compra e vira unidade de produção pelo fator; saída usa custo por unidade de produção.
-- security definer porque também lança a conta a pagar (vendedor ou projetista podem finalizar a compra)
create or replace function finalizar_pedido_estoque(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare p pedidos_estoque; it record; total numeric := 0; forn text; fator numeric; custo numeric;
begin
  select * into p from pedidos_estoque where id = p_id for update;
  if p.id is null or not eh_membro(p.empresa_id) or papel_em(p.empresa_id) = 'montador' then raise exception 'SEM_PERMISSAO'; end if;
  if p.status <> 'aberto' then raise exception 'PEDIDO_JA_FECHADO'; end if;
  if not exists (select 1 from pedido_itens where pedido_id = p_id) then raise exception 'PEDIDO_SEM_ITENS'; end if;
  perform set_config('pps.estoque', '1', true);
  for it in select i.*, pr.nome, pr.estoque, pr.valor_final, pr.fator_conversao from pedido_itens i join produtos pr on pr.id = i.produto_id where i.pedido_id = p_id loop
    fator := case when coalesce(it.fator_conversao, 0) > 0 then it.fator_conversao else 1 end;
    if p.tipo = 'compra' then
      update produtos set estoque = estoque + it.quantidade * fator, valor_compra = case when it.valor_unit > 0 then it.valor_unit else valor_compra end where id = it.produto_id;
      insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, pedido_id, contrato_id, por)
        values (p.empresa_id, it.produto_id, 'entrada', it.quantidade * fator, it.valor_unit / fator, p_id, p.contrato_id, auth.uid());
      total := total + it.quantidade * it.valor_unit;
    else
      if it.estoque < it.quantidade then raise exception 'ESTOQUE_INSUFICIENTE: %', it.nome; end if;
      custo := it.valor_final / fator;
      update produtos set estoque = estoque - it.quantidade where id = it.produto_id;
      insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, pedido_id, contrato_id, por)
        values (p.empresa_id, it.produto_id, 'saida', it.quantidade, custo, p_id, p.contrato_id, auth.uid());
      total := total + it.quantidade * custo;
    end if;
  end loop;
  perform set_config('pps.estoque', '', true);
  update pedidos_estoque set status = 'finalizado', finalizado_em = now(), valor_total = round(total, 2) where id = p_id;
  if p.tipo = 'compra' and p.gerar_financeiro and total > 0 then
    select coalesce(nome_fantasia, nome) into forn from pessoas where id = p.fornecedor_id;
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, entidade, documento, plano_conta)
      values (p.empresa_id, p.contrato_id, coalesce(p.vencimento, current_date + 30), 'Pedido de compra nº ' || p.numero, 'compra_material', -round(total, 2), forn, p.documento, '2.1.2');
  end if;
end $$;

-- ============ CONTRATO: regras de faturamento das Configurações de orçamentos ============
alter table contratos
  add column if not exists garantia_ate date,
  add column if not exists previsao_entrega date;

create or replace function fechar_orcamento(
  p_orcamento_id uuid,
  p_valor_total numeric, p_vpl numeric, p_custo_previsto numeric, p_lucro_previsto numeric,
  p_custo_fabrica numeric, p_valor_rt numeric,
  p_endereco_obra text default null,
  p_liberar_abaixo_minimo boolean default false
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  o orcamentos%rowtype; cfg configuracoes%rowtype; cli clientes%rowtype; cid uuid; pts numeric; fab numeric; tab numeric;
  sla jsonb; acum int := 0; tipos marco_tipo[] := array['medicao','liberacao','fabricacao','material','montagem','conclusao']::marco_tipo[];
  i int; parcela numeric; d0 date; dv date; forma text; agrupar boolean;
begin
  select * into o from orcamentos where id = p_orcamento_id for update;
  if not found or not eh_membro(o.empresa_id) or papel_em(o.empresa_id) = 'montador' then raise exception 'Orçamento não encontrado'; end if;
  if o.status = 'fechado' then raise exception 'Este orçamento já virou contrato'; end if;
  if o.status in ('perdido','excluido') then raise exception 'Este orçamento está como perdido ou excluído. Reabra antes de gerar o contrato.'; end if;
  select * into cfg from configuracoes where empresa_id = o.empresa_id;
  select * into cli from clientes where id = o.cliente_id;

  if cfg.faturar_sem_documento = 'bloquear' and coalesce(regexp_replace(cli.cpf_cnpj, '\D', '', 'g'), '') = '' then
    raise exception 'FALTA_DOCUMENTO: cadastre o CPF ou CNPJ do cliente antes de gerar o contrato.';
  end if;
  if cfg.faturar_sem_endereco = 'bloquear' and p_endereco_obra is null
     and (coalesce(cli.logradouro, '') = '' or coalesce(cli.numero, '') = '' or coalesce(cli.cidade, '') = '' or coalesce(cli.uf, '') = '') then
    raise exception 'FALTA_ENDERECO: complete o endereço do cliente (rua, número, cidade e UF) antes de gerar o contrato.';
  end if;

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

  insert into contratos(empresa_id, orcamento_id, cliente_id, vendedor_id, parceiro_id, campanha_id,
    valor_total, vpl, custo_previsto, lucro_previsto, forma_pagamento, parcelas, endereco_obra,
    assinatura_empresa, assinatura_cliente, garantia_ate, previsao_entrega)
  values (o.empresa_id, o.id, o.cliente_id, coalesce(o.vendedor_id, auth.uid()), o.parceiro_id, cli.campanha_id,
    p_valor_total, p_vpl, p_custo_previsto, p_lucro_previsto, o.forma_pagamento, o.parcelas,
    coalesce(p_endereco_obra, cli.endereco), 'pendente', 'pendente',
    (current_date + make_interval(months => coalesce(cfg.garantia_meses, 12)))::date,
    coalesce(o.data_entrega, current_date + coalesce(cfg.dias_entrega, 60)))
  returning id into cid;

  sla := cfg.sla_marcos;
  for i in 1..6 loop
    acum := acum + coalesce((sla ->> tipos[i]::text)::int, 7);
    insert into marcos(empresa_id, contrato_id, tipo, ordem, sla_dias, previsto_em)
    values (o.empresa_id, cid, tipos[i], i, coalesce((sla ->> tipos[i]::text)::int, 7), current_date + acum);
  end loop;
  insert into historico_workflow(empresa_id, contrato_id, etapa, por) values (o.empresa_id, cid, 'pedido_liberado', auth.uid());

  -- recebimentos conforme configuração: 1ª parcela em X dias, intervalo de 30 dias ou mesmo dia do mês, cartão agrupado ou não
  forma := case o.forma_pagamento when 'cartao' then 'Cartão de crédito' when 'boleto' then 'Boleto' else initcap(coalesce(cfg.forma_entrada, 'pix')) end;
  d0 := current_date + case when o.forma_pagamento = 'avista' then 0 else coalesce(cfg.dias_primeira_parcela, 30) end;
  agrupar := o.forma_pagamento = 'cartao' and coalesce(cfg.fatura_cartao, 'agrupado') = 'agrupado';
  if agrupar or o.forma_pagamento = 'avista' or o.parcelas <= 1 then
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, forma_pagamento, plano_conta)
    values (o.empresa_id, cid, d0, case when agrupar and o.parcelas > 1 then 'Venda no cartão em ' || o.parcelas || 'x' else 'Pagamento da venda' end,
      'recebimento', p_valor_total, forma, cfg.conta_receitas);
  else
    parcela := round(p_valor_total / o.parcelas, 2);
    for i in 1..o.parcelas loop
      dv := case when coalesce(cfg.modo_parcelas, 'intervalo30') = 'mesmo_dia' then (d0 + make_interval(months => i - 1))::date else d0 + 30 * (i - 1) end;
      insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, forma_pagamento, plano_conta)
      values (o.empresa_id, cid, dv, 'Parcela ' || i || '/' || o.parcelas, 'recebimento',
        case when i = o.parcelas then p_valor_total - parcela*(o.parcelas-1) else parcela end, forma, cfg.conta_receitas);
    end loop;
  end if;
  insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, plano_conta)
  values (o.empresa_id, cid, current_date + 15, 'Pedido de fábrica', 'fabrica', -p_custo_fabrica, '2.1.1');
  if p_valor_rt > 0 then
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, plano_conta, entidade)
    values (o.empresa_id, cid, current_date + 30, 'Comissão RT parceiro', 'comissao_rt', -p_valor_rt, cfg.conta_comissao_arquiteto,
      (select nome from parceiros where id = o.parceiro_id));
  end if;

  update orcamentos set status = 'fechado' where id = o.id;
  if o.lead_id is not null then update leads set etapa = 'ganho' where id = o.lead_id; end if;
  return cid;
end $$;
revoke execute on function fechar_orcamento(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean) from public, anon;
grant execute on function fechar_orcamento(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean) to authenticated;

-- ============ TOTAIS CALCULADOS NO BANCO (sem limite de 1.000 linhas) ============
create or replace function resumo_lancamentos(p_empresa uuid, p_de date, p_ate date, p_tipo text, p_atraso boolean, p_hoje date, p_termo text)
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'rec_pagas', coalesce(sum(valor) filter (where valor > 0 and realizado), 0),
    'desp_pagas', coalesce(-sum(valor) filter (where valor < 0 and realizado), 0),
    'rec_pend', coalesce(sum(valor) filter (where valor > 0 and not realizado), 0),
    'desp_pend', coalesce(-sum(valor) filter (where valor < 0 and not realizado), 0),
    'qtd', count(*))
  from lancamentos
  where empresa_id = p_empresa and excluido_em is null
    and (p_tipo <> 'pagar' or valor < 0) and (p_tipo <> 'receber' or valor > 0)
    and (case when p_atraso then not realizado and data < p_hoje else data between p_de and p_ate end)
    and (coalesce(p_termo, '') = '' or descricao ilike '%' || p_termo || '%' or entidade ilike '%' || p_termo || '%' or documento ilike '%' || p_termo || '%');
$$;

create or replace function lucro_contratos(p_empresa uuid, p_de timestamptz, p_ate timestamptz)
returns table (contrato_id uuid, recebido numeric, a_receber numeric, custo_lanc numeric, estoque numeric)
language sql stable security invoker set search_path = public as $$
  select k.id,
    coalesce((select sum(l.valor) from lancamentos l where l.contrato_id = k.id and l.excluido_em is null and l.valor > 0 and l.realizado), 0),
    coalesce((select sum(l.valor) from lancamentos l where l.contrato_id = k.id and l.excluido_em is null and l.valor > 0 and not l.realizado), 0),
    coalesce((select -sum(l.valor) from lancamentos l where l.contrato_id = k.id and l.excluido_em is null and l.valor < 0 and l.categoria <> 'comissao_rt'), 0),
    coalesce((select sum(m.quantidade * m.custo_unit) from estoque_movimentos m where m.contrato_id = k.id and m.tipo = 'saida'), 0)
  from contratos k where k.empresa_id = p_empresa and k.created_at >= p_de and k.created_at < p_ate;
$$;

create or replace function resumo_orcamentos(p_empresa uuid, p_status text[]) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object('qtd', count(*), 'valor', coalesce(sum(coalesce((select valor_total from contratos k where k.orcamento_id = o.id limit 1), (o.calculo->>'valorProposta')::numeric, 0)), 0),
    'com_valor', count(*) filter (where coalesce((o.calculo->>'valorProposta')::numeric, 0) > 0))
  from orcamentos o where o.empresa_id = p_empresa and o.status::text = any(p_status);
$$;
grant execute on function resumo_lancamentos(uuid, date, date, text, boolean, date, text) to authenticated;
grant execute on function lucro_contratos(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function resumo_orcamentos(uuid, text[]) to authenticated;

-- ============ HIGIENE DE FUNÇÕES ============
alter function marcar_status_orcamento() set search_path = public;
do $$ declare f text; begin
  foreach f in array array['campanha_sem_duplicar()','numerar_orcamento()','numerar_seq()','registrar_etapa_op()','semear_impostos_nova()',
    'semear_operacao_nova()','semear_origens_nova()','proteger_campos_plataforma()','pessoas_sem_sigilo()','estoque_inicial()','proteger_estoque()','marcar_status_orcamento()'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ============ ÍNDICES EM TODAS AS CHAVES ESTRANGEIRAS SEM ÍNDICE ============
do $$ declare r record; begin
  for r in
    select c.conrelid::regclass as tabela, a.attname as coluna
    from pg_constraint c join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.connamespace = 'public'::regnamespace and array_length(c.conkey, 1) = 1
      and not exists (select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1])
  loop
    execute format('create index if not exists %I on %s (%I)', 'ix_' || replace(r.tabela::text, 'public.', '') || '_' || r.coluna, r.tabela, r.coluna);
  end loop;
end $$;
