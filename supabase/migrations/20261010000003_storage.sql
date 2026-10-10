-- Pro Plan System · bucket de arquivos (plantas, Promob, fotos, renders, contratos)
-- Caminho obrigatório: {empresa_id}/{pasta}/{arquivo}. A primeira pasta define quem pode acessar.

insert into storage.buckets (id, name, public, file_size_limit)
values ('arquivos', 'arquivos', false, 52428800)
on conflict (id) do nothing;

create policy "arquivos_ler" on storage.objects for select to authenticated
  using (bucket_id = 'arquivos' and public.eh_membro(((storage.foldername(name))[1])::uuid));

create policy "arquivos_enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'arquivos' and public.eh_membro(((storage.foldername(name))[1])::uuid));

create policy "arquivos_apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'arquivos' and public.eh_gestor(((storage.foldername(name))[1])::uuid));
