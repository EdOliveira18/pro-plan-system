-- Totais e indicadores calculados no banco, para não depender do limite de 1.000 linhas por consulta
create or replace function resumo_perdidos(p_empresa uuid) returns json
language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'qtd', count(*),
    'valor', coalesce(sum((calculo->>'valorProposta')::numeric), 0),
    'dias_medio', coalesce(round(avg(extract(epoch from (perdido_em - created_at)) / 86400)), 0),
    'motivos', coalesce((select json_agg(json_build_object('motivo', m, 'qtd', n) order by n desc) from (
      select coalesce(split_part(motivo_perda, ':', 1), 'Sem motivo') m, count(*) n from orcamentos
      where empresa_id = p_empresa and status = 'perdido' group by 1) x), '[]'::json))
  from orcamentos where empresa_id = p_empresa and status = 'perdido';
$$;

create or replace function dashboard_orcamentos(p_empresa uuid, p_desde timestamptz, p_vendedor uuid) returns json
language sql stable security invoker set search_path = public as $$
  with o as (
    select o.status, o.created_at, o.faturado_em, o.perdido_em,
      coalesce((select k.valor_total from contratos k where k.orcamento_id = o.id limit 1), (o.calculo->>'valorProposta')::numeric, 0) as valor
    from orcamentos o
    where o.empresa_id = p_empresa and o.status <> 'excluido' and o.created_at >= p_desde and (p_vendedor is null or o.vendedor_id = p_vendedor))
  select json_build_object(
    'total', count(*), 'ganhos', count(*) filter (where status = 'fechado'), 'perdidos', count(*) filter (where status = 'perdido'),
    'pendentes', count(*) filter (where status in ('rascunho','apresentado')), 'rascunho', count(*) filter (where status = 'rascunho'),
    'apresentado', count(*) filter (where status = 'apresentado'),
    'valor_total', coalesce(sum(valor), 0), 'valor_ganhos', coalesce(sum(valor) filter (where status = 'fechado'), 0),
    'dias_ganho', coalesce(round(avg(extract(epoch from (faturado_em - created_at)) / 86400) filter (where status = 'fechado' and faturado_em is not null)), 0),
    'dias_perda', coalesce(round(avg(extract(epoch from (perdido_em - created_at)) / 86400) filter (where status = 'perdido' and perdido_em is not null)), 0))
  from o;
$$;

create or replace function faturado_por_mes(p_empresa uuid, p_desde timestamptz, p_vendedor uuid) returns json
language sql stable security invoker set search_path = public as $$
  select coalesce(json_object_agg(mes, total), '{}'::json) from (
    select to_char(created_at at time zone 'America/Sao_Paulo', 'YYYY-MM') mes, sum(valor_total) total
    from contratos where empresa_id = p_empresa and created_at >= p_desde and (p_vendedor is null or vendedor_id = p_vendedor)
    group by 1) x;
$$;

create or replace function lucro_resumo(p_empresa uuid, p_de timestamptz, p_ate timestamptz, p_minima numeric) returns json
language sql stable security invoker set search_path = public as $$
  with l as (
    select k.valor_total, k.vpl, k.custo_previsto, k.lucro_previsto, x.recebido, x.a_receber, x.custo_lanc + x.estoque as custo
    from contratos k join lucro_contratos(p_empresa, p_de, p_ate) x on x.contrato_id = k.id)
  select json_build_object('qtd', count(*), 'venda', coalesce(sum(valor_total), 0), 'vpl', coalesce(sum(vpl), 0),
    'recebido', coalesce(sum(recebido), 0), 'a_receber', coalesce(sum(a_receber), 0), 'custo', coalesce(sum(custo), 0),
    'custo_previsto', coalesce(sum(custo_previsto), 0), 'lucro_previsto', coalesce(sum(lucro_previsto), 0),
    'sem_custo', count(*) filter (where custo = 0), 'prejuizo', count(*) filter (where vpl - custo < 0),
    'abaixo', count(*) filter (where vpl > 0 and vpl - custo >= 0 and (vpl - custo) / vpl < p_minima))
  from l;
$$;
grant execute on function resumo_perdidos(uuid) to authenticated;
grant execute on function dashboard_orcamentos(uuid, timestamptz, uuid) to authenticated;
grant execute on function faturado_por_mes(uuid, timestamptz, uuid) to authenticated;
grant execute on function lucro_resumo(uuid, timestamptz, timestamptz, numeric) to authenticated;
