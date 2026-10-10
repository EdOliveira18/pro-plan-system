-- funções internas só para usuários logados; o gerador de número só roda como trigger
revoke execute on function public.criar_empresa(text,text,text) from public, anon;
revoke execute on function public.eh_membro(uuid) from public, anon;
revoke execute on function public.eh_gestor(uuid) from public, anon;
revoke execute on function public.papel_em(uuid) from public, anon;
revoke execute on function public.gerar_numero_contrato() from public, anon, authenticated;
revoke execute on function public.fechar_orcamento(uuid,numeric,numeric,numeric,numeric,numeric,numeric,text,boolean) from public, anon;
revoke execute on function public.concluir_marco(uuid) from public, anon;
revoke execute on function public.avancar_workflow(uuid) from public, anon;
grant execute on function public.eh_membro(uuid) to authenticated;
grant execute on function public.eh_gestor(uuid) to authenticated;
grant execute on function public.papel_em(uuid) to authenticated;
