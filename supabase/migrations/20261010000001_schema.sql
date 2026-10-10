-- Pro Plan System · schema principal
-- Toda tabela de negócio carrega empresa_id. O isolamento entre empresas é feito por RLS (arquivo 0002).
-- O eixo central é o contrato, identificado por numero/ano por empresa (#N/ANO).

create extension if not exists pgcrypto;

-- ============ Empresas e pessoas ============
create table empresas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cnpj text,
  grupo_id uuid,                                   -- multi-empresa: CNPJs do mesmo grupo
  created_at timestamptz not null default now()
);

create type papel_membro as enum ('dono','gerente','vendedor','projetista','financeiro','montador');

create table membros (
  empresa_id uuid not null references empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome text not null,
  email text,
  papel papel_membro not null default 'vendedor',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (empresa_id, user_id)
);
create index on membros(user_id);

-- Premissas que alimentam o olhinho
create table configuracoes (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  pontuacao_minima numeric(6,3) not null default 2.6,
  frete_pct numeric(6,3) not null default 15,        -- % sobre custo de fábrica
  comissao_loja_pct numeric(6,3) not null default 3, -- % sobre VPL
  montagem_pct numeric(6,3) not null default 6,      -- % sobre VPL
  impostos_pct numeric(6,3) not null default 4.44,   -- % sobre VPL
  outros_pct numeric(6,3) not null default 1.1,      -- % sobre VPL
  boleto_pct numeric(6,3) not null default 1.2,
  -- taxa do cartão por número de parcelas, ex: {"1":2.4,"2":3.1,...}
  taxas_cartao jsonb not null default '{"1":2.4,"2":3.1,"3":3.9,"4":4.6,"5":5.3,"6":6.1,"7":6.8,"8":7.6,"9":8.3,"10":9.1,"11":9.8,"12":10.6}',
  sla_marcos jsonb not null default '{"medicao":7,"liberacao":10,"fabricacao":35,"material":5,"montagem":12,"conclusao":5}',
  -- faixas de comissão da equipe sobre VPL acumulado no mês
  faixas_comissao jsonb not null default '[{"nome":"Bronze","a_partir_de":0,"pct":2},{"nome":"Prata","a_partir_de":80000,"pct":2.5},{"nome":"Ouro","a_partir_de":140000,"pct":3}]',
  updated_at timestamptz not null default now()
);

-- ============ Comercial ============
create table campanhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  canal text,                      -- meta, google, indicacao, organico...
  investimento numeric(14,2) not null default 0,
  ativa boolean not null default true,
  created_at timestamptz not null default now()
);
create index on campanhas(empresa_id);

create table parceiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'arquiteto',   -- arquiteto | indicador
  rt_pct numeric(6,3) not null default 10,
  telefone text,
  created_at timestamptz not null default now()
);
create index on parceiros(empresa_id);

create table clientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  cpf_cnpj text,
  endereco text,
  campanha_id uuid references campanhas(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on clientes(empresa_id);

create type etapa_lead as enum ('novo','qualificado','briefing','projeto','apresentacao','negociacao','ganho','perdido');

create table leads (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid references clientes(id) on delete set null,
  nome text not null,
  telefone text,
  etapa etapa_lead not null default 'novo',
  valor_estimado numeric(14,2),
  ambientes text,
  campanha_id uuid references campanhas(id) on delete set null,
  vendedor_id uuid references auth.users(id),
  score int check (score between 0 and 100),
  resumo_ia text,
  proximo_passo text,
  ultimo_contato timestamptz,
  created_at timestamptz not null default now()
);
create index on leads(empresa_id, etapa);

create type status_orcamento as enum ('rascunho','apresentado','fechado','perdido');
create type forma_pagamento as enum ('avista','boleto','cartao');

create table orcamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  cliente_id uuid not null references clientes(id) on delete restrict,
  lead_id uuid references leads(id) on delete set null,
  nome_projeto text not null,
  vendedor_id uuid references auth.users(id),
  parceiro_id uuid references parceiros(id) on delete set null,
  rt_pct numeric(6,3) not null default 0,
  desconto_pct numeric(6,3) not null default 0,
  forma_pagamento forma_pagamento not null default 'cartao',
  parcelas int not null default 1 check (parcelas between 1 and 24),
  status status_orcamento not null default 'rascunho',
  calculo jsonb,                 -- último resultado do olhinho salvo
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on orcamentos(empresa_id, status);

-- versão 1 = projeto vendido; versão 2+ = revisões pós-medição (base do diff)
create table ambientes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  orcamento_id uuid not null references orcamentos(id) on delete cascade,
  versao int not null default 1,
  nome text not null,
  descricao text,
  prazo_dias int,
  custo_fabrica numeric(14,2) not null default 0,
  pontuacao numeric(6,3) not null default 3,
  origem text not null default 'manual',   -- manual | promob
  ordem int not null default 0,
  created_at timestamptz not null default now()
);
create index on ambientes(orcamento_id, versao);

create table pecas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  ambiente_id uuid not null references ambientes(id) on delete cascade,
  codigo text,
  descricao text not null,
  quantidade numeric(12,3) not null default 1,
  custo_unitario numeric(14,4) not null default 0,
  largura_mm numeric, altura_mm numeric, profundidade_mm numeric
);
create index on pecas(ambiente_id);

-- ============ Contrato (#N/ANO) ============
create table contador_contratos (
  empresa_id uuid not null references empresas(id) on delete cascade,
  ano int not null,
  ultimo int not null default 0,
  primary key (empresa_id, ano)
);

create type status_assinatura as enum ('pendente','enviado','assinado','recusado');
create type marco_tipo as enum ('medicao','liberacao','fabricacao','material','montagem','conclusao');
create type etapa_workflow as enum ('pedido_liberado','projeto_executivo','compra_material','corte_usinagem','montagem_fabrica','expedicao','entregue');

create table contratos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  numero int not null,
  ano int not null,
  codigo text generated always as (numero::text || '/' || ano::text) stored,
  orcamento_id uuid references orcamentos(id) on delete set null,
  cliente_id uuid not null references clientes(id) on delete restrict,
  vendedor_id uuid references auth.users(id),
  parceiro_id uuid references parceiros(id) on delete set null,
  campanha_id uuid references campanhas(id) on delete set null,
  data_venda date not null default current_date,
  valor_total numeric(14,2) not null,
  vpl numeric(14,2) not null,
  custo_previsto numeric(14,2) not null,
  lucro_previsto numeric(14,2) not null,
  forma_pagamento forma_pagamento not null,
  parcelas int not null default 1,
  endereco_obra text,
  marco_atual marco_tipo not null default 'medicao',
  etapa_workflow etapa_workflow not null default 'pedido_liberado',
  assinatura_empresa status_assinatura not null default 'pendente',
  assinatura_cliente status_assinatura not null default 'pendente',
  encerrado boolean not null default false,
  created_at timestamptz not null default now(),
  unique (empresa_id, ano, numero)
);
create index on contratos(empresa_id, encerrado);

-- numeração automática por empresa e ano, sem buracos e segura contra concorrência
create or replace function gerar_numero_contrato() returns trigger
language plpgsql as $$
declare n int;
begin
  if new.ano is null then new.ano := extract(year from coalesce(new.data_venda, current_date))::int; end if;
  insert into contador_contratos(empresa_id, ano, ultimo) values (new.empresa_id, new.ano, 1)
  on conflict (empresa_id, ano) do update set ultimo = contador_contratos.ultimo + 1
  returning ultimo into n;
  new.numero := n;
  return new;
end $$;
create trigger trg_numero_contrato before insert on contratos
for each row when (new.numero is null) execute function gerar_numero_contrato();

create table marcos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  tipo marco_tipo not null,
  ordem int not null,
  sla_dias int not null,
  previsto_em date not null,
  concluido_em timestamptz,
  concluido_por uuid references auth.users(id),
  unique (contrato_id, tipo)
);
create index on marcos(empresa_id, concluido_em);

create table historico_workflow (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  etapa etapa_workflow not null,
  em timestamptz not null default now(),
  por uuid references auth.users(id)
);

-- ============ Arquivos e render ============
create type tipo_arquivo as enum ('planta','promob','projeto_imagem','foto_obra','foto_montagem','contrato','render','documento');

create table arquivos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete cascade,
  orcamento_id uuid references orcamentos(id) on delete cascade,
  tipo tipo_arquivo not null,
  nome text not null,
  storage_path text not null unique,  -- {empresa_id}/...
  mime text,
  tamanho bigint,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index on arquivos(empresa_id, contrato_id);
create index on arquivos(empresa_id, orcamento_id);

create type status_render as enum ('pendente','processando','concluido','erro');

create table renders (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete cascade,
  orcamento_id uuid references orcamentos(id) on delete cascade,
  origem_arquivo_id uuid not null references arquivos(id) on delete cascade,
  resultado_arquivo_id uuid references arquivos(id) on delete set null,
  tipo_origem text not null default 'planta',   -- planta | promob
  ambiente text,
  estilo text,
  instrucoes text,
  status status_render not null default 'pendente',
  provedor text,
  modelo text,
  erro text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  concluido_em timestamptz
);
create index on renders(empresa_id, created_at desc);

-- ============ Montagem e pós-venda ============
create table checkins (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  user_id uuid references auth.users(id),
  latitude double precision,
  longitude double precision,
  precisao_m double precision,
  tipo text not null default 'chegada',   -- chegada | saida
  em timestamptz not null default now()
);

create type status_chamado as enum ('aberto','agendado','em_atendimento','resolvido');

create table chamados (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid not null references contratos(id) on delete cascade,
  descricao text not null,
  status status_chamado not null default 'aberto',
  responsavel text,
  agendado_para date,
  aberto_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index on chamados(empresa_id, status);

-- ============ Financeiro e fiscal ============
create table lancamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete set null,
  data date not null,
  descricao text not null,
  categoria text not null,      -- recebimento, fabrica, frete, comissao, montagem, imposto, taxa, despesa_fixa...
  valor numeric(14,2) not null, -- positivo entra, negativo sai
  realizado boolean not null default false,
  created_at timestamptz not null default now()
);
create index on lancamentos(empresa_id, data);
create index on lancamentos(contrato_id);

create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  contrato_id uuid references contratos(id) on delete set null,
  tipo text not null check (tipo in ('NF-e','NFS-e')),
  numero text,
  valor numeric(14,2) not null,
  status text not null default 'pendente',  -- pendente | autorizada | cancelada | erro
  provedor_ref text,
  created_at timestamptz not null default now()
);

-- ============ updated_at ============
create or replace function tocar_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger trg_orc_upd before update on orcamentos for each row execute function tocar_updated_at();
create trigger trg_cfg_upd before update on configuracoes for each row execute function tocar_updated_at();
