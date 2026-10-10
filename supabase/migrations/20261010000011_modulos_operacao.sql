-- Orçamentos (perdidos/excluídos/faturados), almoxarifado, produção, entregas, assistência, ferramentaria,
-- financeiro (pagar/receber, recorrentes, contas e cartões, plano de contas) e pós-venda.

-- numeração sequencial por empresa, para qualquer tabela com colunas empresa_id e numero
create or replace function numerar_seq() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext(TG_TABLE_NAME || new.empresa_id::text));
    execute format('select coalesce(max(numero), 0) + 1 from %I where empresa_id = $1', TG_TABLE_NAME) into new.numero using new.empresa_id;
  end if;
  return new;
end $$;

-- ============ ORÇAMENTOS ============
alter table orcamentos
  add column if not exists perdido_em timestamptz,
  add column if not exists motivo_perda text,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references auth.users(id),
  add column if not exists faturado_em timestamptz;

create or replace function marcar_status_orcamento() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'fechado' then new.faturado_em := coalesce(new.faturado_em, now()); end if;
    if new.status = 'perdido' then new.perdido_em := now(); end if;
    if new.status = 'excluido' then new.excluido_em := now(); new.excluido_por := auth.uid(); end if;
    if new.status in ('rascunho','apresentado') then new.perdido_em := null; new.excluido_em := null; new.excluido_por := null; new.motivo_perda := null; end if;
  end if;
  return new;
end $$;
create trigger orcamentos_status before update on orcamentos for each row execute function marcar_status_orcamento();
update orcamentos o set faturado_em = k.created_at from contratos k where k.orcamento_id = o.id and o.faturado_em is null;

alter table configuracoes
  add column if not exists margem_minima_pct numeric(6,2) not null default 20,
  add column if not exists dias_entrega int not null default 60,
  add column if not exists dias_uteis_montagem int not null default 7,
  add column if not exists dias_uteis_entrega int not null default 45,
  add column if not exists garantia_meses int not null default 12,
  add column if not exists dias_primeira_parcela int not null default 30,
  add column if not exists forma_entrada text not null default 'pix',
  add column if not exists modo_parcelas text not null default 'intervalo30',
  add column if not exists fatura_cartao text not null default 'agrupado',
  add column if not exists faturar_sem_documento text not null default 'bloquear',
  add column if not exists faturar_sem_endereco text not null default 'bloquear',
  add column if not exists conta_receitas text default '1.1.1',
  add column if not exists conta_comissao_vendedor text default '3.2.1',
  add column if not exists conta_comissao_arquiteto text default '3.2.2',
  add column if not exists conta_imposto text default '3.1.3',
  add column if not exists imposto_faturamento text default 'DAS';

-- ============ ALMOXARIFADO ============
create table categorias_produto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  precificacao boolean not null default true,
  unique (empresa_id, nome)
);
create table naturezas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'entrada' check (tipo in ('entrada','saida')),
  cfop_estadual text not null,
  cfop_interestadual text not null,
  pis_cst text not null default 'nao_usar',
  cofins_cst text not null default 'nao_usar'
);
create table produtos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null,
  nome text not null,
  tipo text not null,
  categoria_id uuid references categorias_produto(id) on delete set null,
  referencia text, marca text, acabamento text, cor text, localizacao text, observacoes text,
  unid_compra text not null default 'UN',
  fator_conversao numeric(14,4) not null default 1,
  unid_producao text not null default 'UN',
  estoque numeric(14,3) not null default 0,
  estoque_minimo numeric(14,3) not null default 0,
  fornecedor_id uuid references pessoas(id) on delete set null,
  valor_compra numeric(14,4) not null default 0,
  outras_despesas numeric(14,4) not null default 0,
  valor_final numeric(14,4) generated always as (valor_compra + outras_despesas) stored,
  ncm text, cest text, origem text, tributacao text not null default 'simples',
  excluido_em timestamptz, excluido_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (empresa_id, codigo)
);
create index on produtos(empresa_id) where excluido_em is null;

create table pedidos_estoque (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int,
  tipo text not null check (tipo in ('compra','saida')),
  data date not null default current_date,
  fornecedor_id uuid references pessoas(id) on delete set null,
  contrato_id uuid references contratos(id) on delete set null,
  responsavel_id uuid references auth.users(id),
  documento text,
  natureza_id uuid references naturezas(id) on delete set null,
  tipo_saida text,
  status text not null default 'aberto' check (status in ('aberto','finalizado','cancelado')),
  finalizado_em timestamptz,
  gerar_financeiro boolean not null default true,
  vencimento date,
  valor_total numeric(14,2) not null default 0,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (empresa_id, numero)
);
create trigger pedidos_estoque_num before insert on pedidos_estoque for each row execute function numerar_seq();
create table pedido_itens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  pedido_id uuid not null references pedidos_estoque(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete restrict,
  quantidade numeric(14,3) not null check (quantidade > 0),
  valor_unit numeric(14,4) not null default 0
);
create table estoque_movimentos (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  produto_id uuid not null references produtos(id) on delete cascade,
  tipo text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade numeric(14,3) not null,
  custo_unit numeric(14,4) not null default 0,
  contrato_id uuid references contratos(id) on delete set null,
  pedido_id uuid references pedidos_estoque(id) on delete set null,
  por uuid references auth.users(id),
  em timestamptz not null default now()
);
create index on estoque_movimentos(empresa_id, contrato_id);
create table notas_compra (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  chave text not null,
  numero text, serie text,
  emitente_nome text, emitente_cnpj text,
  emissao date,
  valor numeric(14,2) not null default 0,
  status text not null default 'pendente' check (status in ('pendente','gerada','outra')),
  pedido_id uuid references pedidos_estoque(id) on delete set null,
  itens jsonb not null default '[]',
  origem text not null default 'xml',
  created_at timestamptz not null default now(),
  unique (empresa_id, chave)
);

-- fecha o pedido: compra dá entrada no estoque (e lança a pagar); saída dá baixa e vira custo do contrato
create or replace function finalizar_pedido_estoque(p_id uuid) returns void
language plpgsql security invoker set search_path = public as $$
declare p pedidos_estoque; it record; total numeric := 0; forn text;
begin
  select * into p from pedidos_estoque where id = p_id for update;
  if p.id is null or not eh_membro(p.empresa_id) or papel_em(p.empresa_id) = 'montador' then raise exception 'SEM_PERMISSAO'; end if;
  if p.status <> 'aberto' then raise exception 'PEDIDO_JA_FECHADO'; end if;
  if not exists (select 1 from pedido_itens where pedido_id = p_id) then raise exception 'PEDIDO_SEM_ITENS'; end if;
  for it in select i.*, pr.nome, pr.estoque, pr.valor_final from pedido_itens i join produtos pr on pr.id = i.produto_id where i.pedido_id = p_id loop
    if p.tipo = 'compra' then
      update produtos set estoque = estoque + it.quantidade, valor_compra = case when it.valor_unit > 0 then it.valor_unit else valor_compra end where id = it.produto_id;
      insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, pedido_id, contrato_id, por)
        values (p.empresa_id, it.produto_id, 'entrada', it.quantidade, it.valor_unit, p_id, p.contrato_id, auth.uid());
      total := total + it.quantidade * it.valor_unit;
    else
      if it.estoque < it.quantidade then raise exception 'ESTOQUE_INSUFICIENTE: %', it.nome; end if;
      update produtos set estoque = estoque - it.quantidade where id = it.produto_id;
      insert into estoque_movimentos(empresa_id, produto_id, tipo, quantidade, custo_unit, pedido_id, contrato_id, por)
        values (p.empresa_id, it.produto_id, 'saida', it.quantidade, it.valor_final, p_id, p.contrato_id, auth.uid());
      total := total + it.quantidade * it.valor_final;
    end if;
  end loop;
  update pedidos_estoque set status = 'finalizado', finalizado_em = now(), valor_total = round(total, 2) where id = p_id;
  if p.tipo = 'compra' and p.gerar_financeiro and total > 0 then
    select coalesce(nome_fantasia, nome) into forn from pessoas where id = p.fornecedor_id;
    insert into lancamentos(empresa_id, contrato_id, data, descricao, categoria, valor, entidade, documento)
      values (p.empresa_id, p.contrato_id, coalesce(p.vencimento, current_date + 30), 'Pedido de compra nº ' || p.numero, 'compra_material', -round(total, 2), forn, p.documento);
  end if;
end $$;
grant execute on function finalizar_pedido_estoque(uuid) to authenticated;

-- ============ PRODUÇÃO ============
create table tipos_servico (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null, unidade text not null, valor numeric(14,2), markup_pct numeric(6,2)
);
create table etapas_execucao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null, valor_hora numeric(14,2) not null default 0, markup_pct numeric(6,2)
);
create table ordens_producao (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int,
  contrato_id uuid references contratos(id) on delete set null,
  descricao text,
  tipo_servico_id uuid references tipos_servico(id) on delete set null,
  responsavel_id uuid references pessoas(id) on delete set null,
  etapa text not null default 'agendada',
  status text not null default 'aguardando' check (status in ('aguardando','em_producao','pausada','finalizada','cancelada')),
  previsao_inicio date, previsao_fim date,
  iniciada_em timestamptz, finalizada_em timestamptz, cancelada_em timestamptz, motivo_cancelamento text,
  created_at timestamptz not null default now(),
  unique (empresa_id, numero)
);
create trigger ordens_producao_num before insert on ordens_producao for each row execute function numerar_seq();
create table op_etapas (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  op_id uuid not null references ordens_producao(id) on delete cascade,
  etapa text not null,
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  por uuid references auth.users(id)
);
create or replace function registrar_etapa_op() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.etapa is distinct from old.etapa then
    update op_etapas set saiu_em = now() where op_id = new.id and saiu_em is null;
    insert into op_etapas(empresa_id, op_id, etapa, por) values (new.empresa_id, new.id, new.etapa, auth.uid());
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('finalizada','cancelada') then
    update op_etapas set saiu_em = now() where op_id = new.id and saiu_em is null;
  end if;
  return null;
end $$;
create trigger ordens_producao_etapas after insert or update on ordens_producao for each row execute function registrar_etapa_op();

-- ============ ENTREGAS ============
create table status_entrega (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null, cor text not null default '#999999', ordem int not null default 1,
  final boolean not null default false
);
create table entregas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  status_id uuid references status_entrega(id) on delete set null,
  data_entrega date, data_montagem date,
  transportadora_id uuid references pessoas(id) on delete set null,
  observacoes text,
  created_at timestamptz not null default now(),
  unique (contrato_id)
);

-- ============ ASSISTÊNCIA ============
alter table chamados
  add column if not exists numero int,
  add column if not exists modalidade text not null default 'reparo',
  add column if not exists historico text,
  add column if not exists observacoes text,
  add column if not exists hora_visita time,
  add column if not exists montador_id uuid references pessoas(id) on delete set null;
update chamados c set numero = s.n from (select id, row_number() over (partition by empresa_id order by aberto_em) n from chamados) s where s.id = c.id and c.numero is null;
create trigger chamados_num before insert on chamados for each row execute function numerar_seq();

-- ============ FERRAMENTARIA ============
create table ferramentas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int,
  nome text not null, marca text, serie text, aplicacao text,
  quantidade int not null default 1,
  responsavel_id uuid references pessoas(id) on delete set null,
  created_at timestamptz not null default now()
);
create trigger ferramentas_num before insert on ferramentas for each row execute function numerar_seq();

-- ============ FINANCEIRO ============
create table plano_contas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  codigo text not null, nome text not null,
  tipo text not null check (tipo in ('receita','despesa','custo')),
  unique (empresa_id, codigo)
);
create table recorrencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  tipo text not null check (tipo in ('receita','despesa')),
  descricao text not null, entidade text,
  valor numeric(14,2) not null check (valor > 0),
  dia int not null check (dia between 1 and 31),
  inicio date not null default current_date, fim date,
  forma_pagamento text, plano_conta text,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
alter table lancamentos
  add column if not exists entidade text,
  add column if not exists documento text,
  add column if not exists forma_pagamento text,
  add column if not exists pago_em date,
  add column if not exists competencia date,
  add column if not exists plano_conta text,
  add column if not exists observacoes text,
  add column if not exists recorrencia_id uuid references recorrencias(id) on delete set null,
  add column if not exists excluido_em timestamptz,
  add column if not exists excluido_por uuid references auth.users(id);
update lancamentos set pago_em = data where realizado and pago_em is null;
create unique index if not exists lancamentos_recorrencia_mes on lancamentos(recorrencia_id, competencia) where recorrencia_id is not null;

alter table contas_bancarias
  add column if not exists tipo text not null default 'corrente' check (tipo in ('corrente','cartao','poupanca','caixa')),
  add column if not exists bandeira text,
  add column if not exists ultimos4 text,
  add column if not exists dia_fechamento int,
  add column if not exists dia_vencimento int,
  add column if not exists conta_pagamento_id uuid references contas_bancarias(id) on delete set null,
  add column if not exists saldo_inicial numeric(14,2) not null default 0,
  add column if not exists data_inicial date;

-- ============ PÓS-VENDA ============
create table pesquisas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int,
  contrato_id uuid not null references contratos(id) on delete cascade,
  token uuid not null unique default gen_random_uuid(),
  enviado_em timestamptz not null default now(),
  respondido_em timestamptz,
  nota_nps int check (nota_nps between 0 and 10),
  nota_atendimento int check (nota_atendimento between 1 and 5),
  nota_montagem int check (nota_montagem between 1 and 5),
  nota_prazo int check (nota_prazo between 1 and 5),
  comentario text
);
create trigger pesquisas_num before insert on pesquisas for each row execute function numerar_seq();

-- leitura e resposta públicas, só pelo token (sem login)
create or replace function pesquisa_publica(p_token uuid) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('empresa', coalesce(e.nome_fantasia, e.nome), 'cliente', c.nome, 'contrato', k.codigo, 'respondida', p.respondido_em is not null)
  from pesquisas p join contratos k on k.id = p.contrato_id join clientes c on c.id = k.cliente_id join empresas e on e.id = p.empresa_id
  where p.token = p_token;
$$;
create or replace function responder_pesquisa(p_token uuid, p_nps int, p_atend int, p_mont int, p_prazo int, p_coment text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update pesquisas set nota_nps = p_nps, nota_atendimento = p_atend, nota_montagem = p_mont, nota_prazo = p_prazo,
    comentario = left(p_coment, 2000), respondido_em = now()
  where token = p_token and respondido_em is null;
  return found;
end $$;
grant execute on function pesquisa_publica(uuid) to anon, authenticated;
grant execute on function responder_pesquisa(uuid, int, int, int, int, text) to anon, authenticated;

-- ============ RLS ============
do $$ declare t text; begin
  foreach t in array array['categorias_produto','naturezas','produtos','pedidos_estoque','pedido_itens','estoque_movimentos','notas_compra',
    'tipos_servico','etapas_execucao','status_entrega','entregas','plano_contas','recorrencias','pesquisas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (eh_membro(empresa_id) and papel_em(empresa_id) <> ''montador'') with check (eh_membro(empresa_id) and papel_em(empresa_id) <> ''montador'')', t || '_equipe', t);
  end loop;
  -- montador também vê e movimenta produção, ferramentas e histórico de etapas
  foreach t in array array['ordens_producao','op_etapas','ferramentas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to authenticated using (eh_membro(empresa_id)) with check (eh_membro(empresa_id))', t || '_equipe', t);
  end loop;
end $$;

-- ============ DADOS INICIAIS ============
create or replace function semear_operacao(eid uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into categorias_produto(empresa_id, nome) values (eid,'MDF'),(eid,'Madeira maciça'),(eid,'Ferragens'),(eid,'Vidraçaria'),(eid,'Químicos'),(eid,'Elétros')
    on conflict do nothing;
  if not exists (select 1 from naturezas where empresa_id = eid) then
    insert into naturezas(empresa_id, nome, tipo, cfop_estadual, cfop_interestadual) values
      (eid,'Compra para industrialização','entrada','1101','2101'),
      (eid,'Compra de material para uso ou consumo','entrada','1556','2556');
  end if;
  if not exists (select 1 from etapas_execucao where empresa_id = eid) then
    insert into etapas_execucao(empresa_id, nome) values (eid,'Fabricação'),(eid,'Montagem'),(eid,'Instalação'),(eid,'Acabamento');
  end if;
  if not exists (select 1 from status_entrega where empresa_id = eid) then
    insert into status_entrega(empresa_id, nome, cor, ordem, final) values
      (eid,'Faturado','#dc3545',1,false),(eid,'Aguardando conferência de medida','#999999',2,false),(eid,'Medidas conferidas','#333333',3,false),
      (eid,'Fabricando','#f89406',4,false),(eid,'Finalizado','#f89406',5,false),(eid,'Aguardando montagem','#f89406',6,false),
      (eid,'Montando','#f89406',7,false),(eid,'Entregando','#3a87ad',8,false),(eid,'Entregue','#468847',9,true);
  end if;
  insert into plano_contas(empresa_id, codigo, nome, tipo) values
    (eid,'1.1.1','Receitas operacionais › Venda de móveis planejados','receita'),
    (eid,'1.1.2','Receitas operacionais › Serviços de montagem','receita'),
    (eid,'1.2.1','Receitas financeiras › Rendimentos','receita'),
    (eid,'2.1.1','Custos › Fábrica / indústria','custo'),
    (eid,'2.1.2','Custos › Matéria-prima e ferragens','custo'),
    (eid,'2.1.3','Custos › Frete','custo'),
    (eid,'2.1.4','Custos › Montagem terceirizada','custo'),
    (eid,'3.1.1','Despesas operacionais › Aluguel','despesa'),
    (eid,'3.1.2','Despesas operacionais › Salários e encargos','despesa'),
    (eid,'3.1.3','Despesas operacionais › Impostos sobre vendas','despesa'),
    (eid,'3.1.4','Despesas operacionais › Marketing e anúncios','despesa'),
    (eid,'3.1.5','Despesas operacionais › Taxas bancárias e cartão','despesa'),
    (eid,'3.2.1','Despesas comerciais › Comissão de vendedores','despesa'),
    (eid,'3.2.2','Despesas comerciais › Comissão de arquitetos (RT)','despesa'),
    (eid,'3.3.1','Despesas administrativas › Sistemas e software','despesa'),
    (eid,'3.3.2','Despesas administrativas › Contabilidade','despesa')
  on conflict do nothing;
end $$;
revoke execute on function semear_operacao(uuid) from public, anon, authenticated;
select semear_operacao(id) from empresas;
create or replace function semear_operacao_nova() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform semear_operacao(new.id); return new; end $$;
create trigger empresas_operacao after insert on empresas for each row execute function semear_operacao_nova();
