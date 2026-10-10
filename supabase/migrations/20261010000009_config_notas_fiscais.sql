-- Parâmetros das notas fiscais por empresa
create table config_fiscal (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('producao','homologacao')),
  nfe_ultimo int not null default 0,
  nfe_serie int not null default 1,
  mdfe_ultimo int not null default 0,
  mdfe_serie int not null default 1,
  nfse_ultimo int not null default 0,
  nfse_serie int not null default 1,
  cfop_padrao text not null default '5102',
  ncm_padrao text,
  codigo_servico_nfse text,
  aliquota_iss numeric(6,3),
  info_complementar text,
  ibscbs_habilitado boolean not null default true,
  cbs_aliquota numeric(6,3) not null default 0.9,
  ibs_uf_aliquota numeric(6,3) not null default 0.1,
  ibs_mun_aliquota numeric(6,3) not null default 0,
  cst_ibscbs text not null default '000',
  cclasstrib text not null default '000001',
  envio_contabilidade boolean not null default false,
  email_contabilidade text,
  updated_at timestamptz not null default now()
);
alter table config_fiscal enable row level security;
create policy config_fiscal_ler on config_fiscal for select to authenticated using (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador');
create policy config_fiscal_gerir on config_fiscal for all to authenticated using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));

alter table notas_fiscais
  add column if not exists serie int,
  add column if not exists chave text,
  add column if not exists destinatario text,
  add column if not exists destinatario_doc text,
  add column if not exists emitida_em timestamptz,
  add column if not exists ambiente text,
  add column if not exists xml_path text,
  add column if not exists pdf_path text,
  add column if not exists erro text;
create index if not exists notas_empresa_data on notas_fiscais(empresa_id, created_at desc);
