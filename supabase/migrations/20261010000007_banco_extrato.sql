-- Contas bancárias e extrato importado (OFX hoje, Pluggy/Open Finance depois)
create table contas_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  nome text not null,
  banco text,
  agencia text,
  conta text,
  origem text not null default 'ofx',          -- ofx | pluggy
  externo_id text,                              -- id da conta no agregador
  saldo numeric(14,2),
  saldo_em timestamptz,
  created_at timestamptz not null default now(),
  unique (empresa_id, banco, conta)
);

create type status_extrato as enum ('pendente','conciliado','ignorado');

create table extrato (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  conta_id uuid not null references contas_bancarias(id) on delete cascade,
  fitid text not null,                          -- identificador único da transação no banco
  data date not null,
  valor numeric(14,2) not null,                 -- positivo entrou, negativo saiu
  descricao text,
  status status_extrato not null default 'pendente',
  lancamento_id uuid references lancamentos(id) on delete set null,
  importado_em timestamptz not null default now(),
  unique (conta_id, fitid)
);
create index on extrato(empresa_id, status, data);

alter table lancamentos add column if not exists conta_id uuid references contas_bancarias(id) on delete set null;

alter table contas_bancarias enable row level security;
alter table extrato enable row level security;
create policy contas_bancarias_fin on contas_bancarias for all to authenticated
  using (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador')
  with check (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador');
create policy extrato_fin on extrato for all to authenticated
  using (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador')
  with check (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador');
