-- Dados fiscais da empresa (base para nota fiscal e para vincular contas bancárias ao CNPJ)
alter table empresas
  add column if not exists razao_social text,
  add column if not exists nome_fantasia text,
  add column if not exists inscricao_estadual text,
  add column if not exists inscricao_municipal text,
  add column if not exists regime_tributario text check (regime_tributario in ('mei','simples','presumido','real')),
  add column if not exists cnae text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists municipio text,
  add column if not exists uf text,
  add column if not exists codigo_municipio text,
  add column if not exists email_fiscal text,
  add column if not exists telefone text;

create unique index if not exists empresas_cnpj_unico on empresas (regexp_replace(cnpj, '\D', '', 'g')) where cnpj is not null;

-- Certificado digital A1 (arquivo no storage privado; senha cifrada no servidor)
create table certificados (
  empresa_id uuid primary key references empresas(id) on delete cascade,
  storage_path text not null,
  senha_cifrada text not null,
  titular text,
  cnpj text,
  valido_ate date,
  enviado_por uuid references auth.users(id),
  enviado_em timestamptz not null default now()
);
alter table certificados enable row level security;
create policy certificados_gestor on certificados for all to authenticated
  using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));

insert into storage.buckets (id, name, public, file_size_limit) values ('certificados', 'certificados', false, 1048576)
on conflict (id) do nothing;
create policy "cert_ler" on storage.objects for select to authenticated
  using (bucket_id = 'certificados' and public.eh_gestor(((storage.foldername(name))[1])::uuid));
create policy "cert_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'certificados' and public.eh_gestor(((storage.foldername(name))[1])::uuid));
create policy "cert_trocar" on storage.objects for update to authenticated
  using (bucket_id = 'certificados' and public.eh_gestor(((storage.foldername(name))[1])::uuid));
create policy "cert_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'certificados' and public.eh_gestor(((storage.foldername(name))[1])::uuid));

-- Conexões Open Finance (Pluggy): cada item é um banco autorizado pela empresa
create table conexoes_bancarias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  provedor text not null default 'pluggy',
  item_id text not null unique,
  instituicao text,
  status text,
  erro text,
  ultimo_sync timestamptz,
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table conexoes_bancarias enable row level security;
create policy conexoes_fin on conexoes_bancarias for all to authenticated
  using (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador')
  with check (eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador');

alter table contas_bancarias add column if not exists conexao_id uuid references conexoes_bancarias(id) on delete set null;
create unique index if not exists contas_externo on contas_bancarias(externo_id) where externo_id is not null;
