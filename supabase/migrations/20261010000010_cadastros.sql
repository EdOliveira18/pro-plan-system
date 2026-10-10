-- Cadastros completos: clientes, arquitetos, leads, funcionários, sócios, fornecedores, transportadoras, impostos
-- e numeração / status extras dos orçamentos.

-- CLIENTES
alter table clientes
  add column if not exists tipo_pessoa text not null default 'pf' check (tipo_pessoa in ('pf','pj')),
  add column if not exists status text not null default 'ativo' check (status in ('ativo','inativo')),
  add column if not exists conjuge text,
  add column if not exists nascimento date,
  add column if not exists produtor_rural boolean not null default false,
  add column if not exists rg text,
  add column if not exists inscricao_estadual text,
  add column if not exists estado_civil text,
  add column if not exists profissao text,
  add column if not exists end_tipo text,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists referencia text,
  add column if not exists tipo_imovel text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists pais text default 'Brasil',
  add column if not exists celular text,
  add column if not exists telefone_comercial text,
  add column if not exists ramal text,
  add column if not exists telefone_conjuge text,
  add column if not exists site text,
  add column if not exists observacoes text,
  add column if not exists indicacao text;

-- ARQUITETOS (tabela parceiros, usada no RT dos orçamentos)
alter table parceiros
  add column if not exists tipo_pessoa text not null default 'pf' check (tipo_pessoa in ('pf','pj')),
  add column if not exists status text not null default 'ativo' check (status in ('ativo','inativo')),
  add column if not exists cpf_cnpj text,
  add column if not exists registro_cau text,
  add column if not exists nascimento date,
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists referencia text,
  add column if not exists tipo_imovel text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists pais text default 'Brasil',
  add column if not exists celular text,
  add column if not exists telefone_comercial text,
  add column if not exists email text,
  add column if not exists banco text,
  add column if not exists agencia text,
  add column if not exists conta text,
  add column if not exists comissao_usa_pct boolean not null default true,
  add column if not exists pix_tipo text,
  add column if not exists pix_chave text,
  add column if not exists observacoes text;

-- LEADS
alter table leads
  add column if not exists email text,
  add column if not exists fonte text;

-- FUNCIONÁRIOS, SÓCIOS, FORNECEDORES E TRANSPORTADORAS
create table if not exists pessoas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null check (categoria in ('funcionario','socio','fornecedor','transportadora')),
  tipo_pessoa text not null default 'pf' check (tipo_pessoa in ('pf','pj')),
  status text not null default 'ativo' check (status in ('ativo','inativo')),
  cpf_cnpj text,
  nome text not null,
  nome_fantasia text,
  rg text,
  inscricao_estadual text,
  nascimento date,
  escolaridade text,
  cep text, logradouro text, numero text, complemento text, referencia text, tipo_imovel text,
  bairro text, cidade text, uf text, pais text default 'Brasil',
  telefone text, celular text, email text, site text, contato text,
  banco text, agencia text, conta text,
  comissao_usa_pct boolean not null default false,
  comissao_pct numeric(6,3),
  pix_tipo text, pix_chave text,
  funcao text,
  salario numeric(14,2),
  dia_pagamento int check (dia_pagamento between 1 and 31),
  admissao date,
  participacao_pct numeric(6,3),
  pro_labore numeric(14,2),
  ramo text,
  prazo_entrega_dias int,
  rntrc text,
  observacoes text,
  created_at timestamptz not null default now()
);
create index if not exists pessoas_empresa_cat on pessoas(empresa_id, categoria);
alter table pessoas enable row level security;

-- fornecedor e transportadora: toda a equipe (menos montador) vê; funcionário e sócio (salário, pró-labore): só dono, gerente e financeiro
create policy pessoas_ler on pessoas for select to authenticated using (
  eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador'
  and (categoria in ('fornecedor','transportadora') or papel_em(empresa_id) in ('dono','gerente','financeiro')));
create policy pessoas_gravar on pessoas for insert to authenticated with check (
  eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador'
  and (categoria in ('fornecedor','transportadora') or papel_em(empresa_id) in ('dono','gerente','financeiro')));
create policy pessoas_alterar on pessoas for update to authenticated using (
  eh_membro(empresa_id) and papel_em(empresa_id) <> 'montador'
  and (categoria in ('fornecedor','transportadora') or papel_em(empresa_id) in ('dono','gerente','financeiro')));
create policy pessoas_apagar on pessoas for delete to authenticated using (eh_gestor(empresa_id));

-- IMPOSTOS
create table if not exists impostos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  categoria text not null check (categoria in ('federal','estadual','municipal')),
  sigla text not null,
  nome text not null,
  aliquota numeric(6,3),
  created_at timestamptz not null default now(),
  unique (empresa_id, sigla)
);
alter table impostos enable row level security;
create policy impostos_ler on impostos for select to authenticated using (eh_membro(empresa_id));
create policy impostos_gravar on impostos for all to authenticated using (eh_gestor(empresa_id) or papel_em(empresa_id) = 'financeiro')
  with check (eh_gestor(empresa_id) or papel_em(empresa_id) = 'financeiro');

create or replace function semear_impostos(eid uuid) returns void
language sql security definer set search_path = public as $$
  insert into impostos (empresa_id, categoria, sigla, nome) values
    (eid,'estadual','ICMS','Imposto sobre circulação de mercadorias e serviços'),
    (eid,'estadual','IPVA','Imposto sobre a propriedade de veículos automotores'),
    (eid,'estadual','ITCMD','Imposto de transmissão causa mortis e doação'),
    (eid,'federal','COFINS','Contribuição para o financiamento da seguridade social'),
    (eid,'federal','CSLL','Contribuição social sobre o lucro líquido'),
    (eid,'federal','II','Imposto sobre importação de mercadorias vindas de fora do país'),
    (eid,'federal','IOF','Imposto sobre operações financeiras'),
    (eid,'federal','IPI','Imposto sobre produtos industrializados'),
    (eid,'federal','IRPJ','Imposto de renda da pessoa jurídica'),
    (eid,'federal','PIS','Programa de integração social'),
    (eid,'federal','INSS','Contribuição previdenciária'),
    (eid,'federal','CBS','Contribuição sobre bens e serviços (reforma tributária)'),
    (eid,'estadual','IBS UF','Imposto sobre bens e serviços, parcela estadual (reforma tributária)'),
    (eid,'municipal','IBS Mun','Imposto sobre bens e serviços, parcela municipal (reforma tributária)'),
    (eid,'municipal','ISS','Imposto sobre serviços (montagem e instalação)'),
    (eid,'municipal','IPTU','Imposto predial e territorial urbano')
  on conflict (empresa_id, sigla) do nothing;
$$;
revoke execute on function semear_impostos(uuid) from public, anon, authenticated;
select semear_impostos(id) from empresas;

create or replace function semear_impostos_nova() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform semear_impostos(new.id); return new; end $$;
create trigger empresas_impostos after insert on empresas for each row execute function semear_impostos_nova();

-- ORÇAMENTOS: número sequencial por empresa, previsão de entrega e lixeira
alter type status_orcamento add value if not exists 'excluido';
alter table orcamentos
  add column if not exists numero int,
  add column if not exists data_entrega date;

create or replace function numerar_orcamento() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.numero is null then
    perform pg_advisory_xact_lock(hashtext('orc' || new.empresa_id::text));
    select coalesce(max(numero), 0) + 1 into new.numero from orcamentos where empresa_id = new.empresa_id;
  end if;
  return new;
end $$;
create trigger orcamentos_numero before insert on orcamentos for each row execute function numerar_orcamento();

update orcamentos o set numero = s.n from (
  select id, row_number() over (partition by empresa_id order by created_at) n from orcamentos) s
where s.id = o.id and o.numero is null;
create unique index if not exists orcamentos_empresa_numero on orcamentos(empresa_id, numero);
