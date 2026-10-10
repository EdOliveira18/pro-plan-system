-- Origens padrão do cliente (em vez de nomes de campanha específicos) e proteção contra nomes repetidos
update campanhas set nome = 'Tráfego pago' where canal = 'meta' and nome = 'Meta · Cozinhas outubro';

create or replace function semear_origens(eid uuid) returns void
language sql security definer set search_path = public as $$
  insert into campanhas(empresa_id, nome, canal)
  select eid, o.nome, o.canal from (values
    ('Tráfego pago','meta'), ('Indicação de cliente','indicacao'), ('Indicação de arquiteto','indicacao'),
    ('Instagram orgânico','organico'), ('Google / site','google'), ('Orgânico / loja física','organico'), ('Feira / evento','organico'), ('Outro','organico')
  ) as o(nome, canal)
  where not exists (select 1 from campanhas c where c.empresa_id = eid and lower(c.nome) = lower(o.nome));
$$;
revoke execute on function semear_origens(uuid) from public, anon, authenticated;
select semear_origens(id) from empresas;

create or replace function semear_origens_nova() returns trigger
language plpgsql security definer set search_path = public as $$
begin perform semear_origens(new.id); return new; end $$;
create trigger empresas_origens after insert on empresas for each row execute function semear_origens_nova();

create or replace function campanha_sem_duplicar() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from campanhas c where c.empresa_id = new.empresa_id and lower(c.nome) = lower(new.nome)) then return null; end if;
  return new;
end $$;
create trigger campanhas_sem_duplicar before insert on campanhas for each row execute function campanha_sem_duplicar();
