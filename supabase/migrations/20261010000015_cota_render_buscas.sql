-- Cota de render à prova de manipulação, resumo de orçamentos com filtros e contagem do painel administrativo

-- ============ USO DE RENDER ============
-- Registro que o usuário não consegue apagar nem editar (sem policy de escrita); só as funções abaixo gravam.
create table if not exists uso_renders (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  render_id uuid references renders(id) on delete set null,
  em timestamptz not null default now(),
  devolvido_em timestamptz          -- falha da IA devolve a cota (marca em vez de apagar, fica o histórico)
);
create index if not exists uso_renders_empresa_em on uso_renders(empresa_id, em);
create index if not exists uso_renders_render on uso_renders(render_id);
alter table uso_renders enable row level security;
create policy uso_renders_ler on uso_renders for select to authenticated using (eh_membro(empresa_id));

-- quantos renders a empresa já usou no mês corrente (horário de Brasília)
create or replace function renders_no_mes(p_empresa uuid) returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from uso_renders
  where empresa_id = p_empresa and devolvido_em is null
    and em >= (date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo');
$$;

-- reserva um render antes de chamar a IA; recusa se o plano venceu ou a cota acabou
create or replace function consumir_render(p_render uuid) returns int
language plpgsql security definer set search_path = public as $$
declare r renders; e empresas; usados int;
begin
  select * into r from renders where id = p_render;
  if r.id is null or not eh_membro(r.empresa_id) then raise exception 'SEM_PERMISSAO'; end if;
  select * into e from empresas where id = r.empresa_id for update;
  if e.plano = 'suspenso' or (e.plano_ate is not null and e.plano_ate < (now() at time zone 'America/Sao_Paulo')::date) then raise exception 'PLANO_INATIVO'; end if;
  usados := renders_no_mes(e.id);
  if usados >= coalesce(e.limite_renders, 0) then raise exception 'COTA_ESGOTADA: %', e.limite_renders; end if;
  insert into uso_renders(empresa_id, render_id) values (e.id, r.id);
  return e.limite_renders - usados - 1;
end $$;

-- devolve a reserva quando a IA falhou (só a reserva recente de um render que terminou em erro e sem imagem)
create or replace function devolver_render(p_render uuid) returns void
language plpgsql security definer set search_path = public as $$
declare r renders;
begin
  select * into r from renders where id = p_render;
  if r.id is null or not eh_membro(r.empresa_id) then raise exception 'SEM_PERMISSAO'; end if;
  if r.status <> 'erro' or r.resultado_arquivo_id is not null then return; end if;
  update uso_renders set devolvido_em = now() where id = (
    select id from uso_renders where render_id = r.id and devolvido_em is null and em > now() - interval '10 minutes' order by em desc limit 1);
end $$;
revoke execute on function consumir_render(uuid) from public, anon;
revoke execute on function devolver_render(uuid) from public, anon;
grant execute on function consumir_render(uuid) to authenticated;
grant execute on function devolver_render(uuid) to authenticated;
grant execute on function renders_no_mes(uuid) to authenticated;

-- histórico: renders concluídos deste mês já contam
insert into uso_renders(empresa_id, render_id, em)
select r.empresa_id, r.id, coalesce(r.concluido_em, r.created_at) from renders r
where r.status = 'concluido' and coalesce(r.concluido_em, r.created_at) >= date_trunc('month', now())
  and not exists (select 1 from uso_renders u where u.render_id = r.id);

-- painel administrativo passa a contar pelo registro de uso
create or replace function admin_empresas() returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if not eh_admin_plataforma() then raise exception 'Acesso restrito'; end if;
  return coalesce((select json_agg(x order by x.created_at desc) from (
    select e.id, e.nome, e.razao_social, e.cnpj, e.cnpj_verificado, e.plano, e.plano_ate, e.limite_renders, e.created_at,
      (select string_agg(m.email, ', ') from membros m where m.empresa_id = e.id and m.papel = 'dono') as donos,
      (select count(*) from membros m where m.empresa_id = e.id and m.ativo) as usuarios,
      renders_no_mes(e.id) as renders_mes,
      (select json_build_object('cnpj', c.cnpj, 'razao', c.razao_social, 'valido_ate', c.valido_ate) from certificados c where c.empresa_id = e.id) as certificado
    from empresas e) x), '[]'::json);
end $$;

-- ============ RESUMO DE ORÇAMENTOS COM OS MESMOS FILTROS DA LISTA ============
-- p_status: rascunho/apresentado/fechado/perdido/excluido; datas filtram pela data do status (faturado, perdido, excluído ou criação)
create or replace function resumo_orcamentos_f(p_empresa uuid, p_status text[], p_de date default null, p_ate date default null, p_termo text default null)
returns json language sql stable security invoker set search_path = public as $$
  with o as (
    select o.status, o.created_at, o.perdido_em,
      coalesce((select k.valor_total from contratos k where k.orcamento_id = o.id limit 1), (o.calculo->>'valorProposta')::numeric, 0) as v,
      (case o.status when 'fechado' then o.faturado_em when 'perdido' then o.perdido_em when 'excluido' then o.excluido_em else o.created_at end
        at time zone 'America/Sao_Paulo')::date as dref
    from orcamentos o left join clientes c on c.id = o.cliente_id
    where o.empresa_id = p_empresa and o.status::text = any(p_status)
      and (coalesce(p_termo, '') = '' or o.nome_projeto ilike '%' || p_termo || '%' or c.nome ilike '%' || p_termo || '%'
        or o.numero::text = p_termo or o.motivo_perda ilike '%' || p_termo || '%'))
  select json_build_object('qtd', count(*), 'valor', coalesce(sum(v), 0), 'com_valor', count(*) filter (where v > 0),
    'dias_perda', coalesce(round(avg(extract(epoch from (perdido_em - created_at)) / 86400) filter (where perdido_em is not null)), 0))
  from o where (p_de is null or dref >= p_de) and (p_ate is null or dref <= p_ate);
$$;
grant execute on function resumo_orcamentos_f(uuid, text[], date, date, text) to authenticated;

-- ============ RESUMO DE COMISSÕES ============
create or replace function resumo_comissoes(p_empresa uuid, p_hoje date) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'a_pagar', coalesce(-sum(valor) filter (where not realizado), 0),
    'atrasadas', coalesce(-sum(valor) filter (where not realizado and data < p_hoje), 0),
    'pagas', coalesce(-sum(valor) filter (where realizado), 0))
  from lancamentos where empresa_id = p_empresa and excluido_em is null and categoria in ('comissao_rt', 'comissao_vendedor');
$$;
grant execute on function resumo_comissoes(uuid, date) to authenticated;

-- ============ RESUMO DE ENTREGAS ============
create or replace function resumo_entregas(p_empresa uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object('total', count(*), 'entregues', count(*) filter (where s.final),
    'valor', coalesce(sum(k.valor_total), 0))
  from entregas e left join status_entrega s on s.id = e.status_id left join contratos k on k.id = e.contrato_id
  where e.empresa_id = p_empresa;
$$;
grant execute on function resumo_entregas(uuid) to authenticated;

-- ============ RESUMO DO PÓS-VENDA (NPS e médias) ============
create or replace function resumo_pesquisas(p_empresa uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object('total', count(*), 'respondidas', count(*) filter (where respondido_em is not null),
    'nps', case when count(*) filter (where respondido_em is not null) = 0 then null else
      round(100.0 * (count(*) filter (where respondido_em is not null and nota_nps >= 9) - count(*) filter (where respondido_em is not null and nota_nps <= 6))
        / count(*) filter (where respondido_em is not null)) end,
    'atendimento', round(avg(nota_atendimento) filter (where respondido_em is not null), 1),
    'montagem', round(avg(nota_montagem) filter (where respondido_em is not null), 1),
    'prazo', round(avg(nota_prazo) filter (where respondido_em is not null), 1))
  from pesquisas where empresa_id = p_empresa;
$$;
grant execute on function resumo_pesquisas(uuid) to authenticated;
