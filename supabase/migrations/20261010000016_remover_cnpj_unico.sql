-- Pendente de aprovação no painel: o índice antigo impede o dono real de um CNPJ de se cadastrar
-- se outra conta usou o mesmo CNPJ antes. A unicidade agora vale só para CNPJ verificado (empresas_cnpj_verificado_unico).
drop index if exists public.empresas_cnpj_unico;
