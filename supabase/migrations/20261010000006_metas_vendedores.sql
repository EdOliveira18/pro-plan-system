-- Metas mensais de VPL por vendedor (Ranking / Metas)
create table metas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mes date not null,                     -- sempre o dia 1 do mês
  meta_vpl numeric(14,2) not null default 0,
  unique (empresa_id, user_id, mes)
);
alter table metas enable row level security;
create policy metas_ler on metas for select to authenticated using (eh_membro(empresa_id));
create policy metas_gerir on metas for all to authenticated using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));

-- meta da loja por mês
alter table configuracoes add column if not exists meta_mensal_loja numeric(14,2) not null default 0;

-- o lead lembra o orçamento gerado a partir dele
create index if not exists orcamentos_lead on orcamentos(lead_id);
