-- Convites de equipe: o gestor cadastra e-mail + papel; quando a pessoa cria a conta com esse e-mail, entra na empresa
create table convites (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references empresas(id) on delete cascade,
  email text not null,
  nome text not null,
  papel papel_membro not null default 'vendedor',
  criado_por uuid references auth.users(id),
  created_at timestamptz not null default now(),
  aceito_em timestamptz
);
create unique index convites_empresa_email on convites(empresa_id, lower(email));
alter table convites enable row level security;
create policy convites_gestor on convites for all to authenticated
  using (eh_gestor(empresa_id)) with check (eh_gestor(empresa_id));

create or replace function aceitar_convites() returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); mail text; n int := 0; c record;
begin
  if uid is null then return 0; end if;
  select email into mail from auth.users where id = uid;
  for c in select * from convites where lower(email) = lower(mail) and aceito_em is null loop
    insert into membros(empresa_id, user_id, nome, email, papel)
    values (c.empresa_id, uid, c.nome, mail, c.papel)
    on conflict (empresa_id, user_id) do update set ativo = true, papel = excluded.papel;
    update convites set aceito_em = now() where id = c.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function aceitar_convites() from public, anon;
grant execute on function aceitar_convites() to authenticated;
