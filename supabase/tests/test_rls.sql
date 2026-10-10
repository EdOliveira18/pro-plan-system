-- Testes do banco: isolamento entre empresas, numeração #N/ANO, trava de pontuação, marcos e radar.
\set ON_ERROR_STOP on
insert into auth.users values
 ('00000000-0000-0000-0000-00000000000a','ana@lojaa.com'),
 ('00000000-0000-0000-0000-00000000000b','bruno@lojab.com'),
 ('00000000-0000-0000-0000-00000000000c','carla@lojaa.com');

set role authenticated;

-- Ana cria a Loja A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
select criar_empresa('Loja A Planejados','11.111.111/0001-11','Ana') as empresa_a \gset
insert into clientes(empresa_id,nome,endereco) values (:'empresa_a','Cliente da A','Rua 1') returning id as cli_a \gset
insert into orcamentos(empresa_id,cliente_id,nome_projeto,desconto_pct,forma_pagamento,parcelas,rt_pct)
  values (:'empresa_a',:'cli_a','Casa',0,'cartao',10,10) returning id as orc_a \gset
insert into ambientes(empresa_id,orcamento_id,nome,custo_fabrica,pontuacao) values
  (:'empresa_a',:'orc_a','Cozinha',9543.14,3),(:'empresa_a',:'orc_a','Escritório',9093.66,3);

-- Bruno cria a Loja B e NÃO pode ver nada da A
select set_config('t.ea', :'empresa_a', false);
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
select criar_empresa('Loja B','22.222.222/0001-22','Bruno') as empresa_b \gset
select 'B ve clientes da A: ' || count(*) from clientes where empresa_id = :'empresa_a';
do $$ begin
  if (select count(*) from clientes) <> 0 then raise exception 'FALHA: B enxerga clientes de outra empresa'; end if;
  if (select count(*) from empresas) <> 1 then raise exception 'FALHA: B enxerga outra empresa'; end if;
end $$;
-- B tenta inserir dado na empresa A
do $$ begin
  begin
    insert into clientes(empresa_id,nome) values (current_setting('t.ea')::uuid,'invasor');
    raise exception 'FALHA: B inseriu cliente na empresa A';
  exception when insufficient_privilege then
    raise notice 'ok: insert de B na empresa A bloqueado pela RLS';
  end;
end $$;

-- Ana: trava de pontuação com desconto alto
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
update orcamentos set desconto_pct = 20 where id = :'orc_a';  -- 3,00 * 0,8 = 2,40 < 2,6
do $$ declare ok boolean := false; begin
  begin
    perform fechar_orcamento((select id from orcamentos limit 1), 50000, 40000, 20000, 20000, 18636.8, 4000, null, false);
  exception when others then ok := sqlerrm like 'TRAVA_PONTUACAO%'; end;
  if not ok then raise exception 'FALHA: trava de pontuação não bloqueou'; end if;
end $$;
-- Ana é dona, pode liberar explicitamente
select fechar_orcamento(:'orc_a', 44728.32, 36632.30, 21000, 15632.30, 18636.80, 4069.89, null, true) as contrato1 \gset
-- segundo orçamento e contrato para checar a numeração
insert into orcamentos(empresa_id,cliente_id,nome_projeto) values (:'empresa_a',:'cli_a','Closet') returning id as orc_a2 \gset
insert into ambientes(empresa_id,orcamento_id,nome,custo_fabrica,pontuacao) values (:'empresa_a',:'orc_a2','Closet',5000,3);
select fechar_orcamento(:'orc_a2', 15000, 13000, 7000, 6000, 5000, 0) as contrato2 \gset
select codigo, numero, ano, marco_atual from contratos order by numero;
do $$ begin
  if (select string_agg(numero::text, ',' order by numero) from contratos) <> '1,2' then raise exception 'FALHA: numeração'; end if;
  if (select count(*) from marcos) <> 12 then raise exception 'FALHA: marcos não criados'; end if;
  if (select count(*) from lancamentos where categoria='recebimento') <> 11 then raise exception 'FALHA: parcelas'; end if;
end $$;

-- Radar: concluir marco avança para liberação
select concluir_marco(:'contrato1') as proximo;
-- Workflow: avança até expedição e confirma auto-avanço do radar para "material"
select avancar_workflow(:'contrato1'), avancar_workflow(:'contrato1'), avancar_workflow(:'contrato1'), avancar_workflow(:'contrato1'), avancar_workflow(:'contrato1');
select etapa_workflow, marco_atual from contratos where id = :'contrato1';
do $$ begin
  if (select marco_atual from contratos where numero=1) <> 'material' then raise exception 'FALHA: auto-avanço do radar'; end if;
  if (select count(*) from marcos m join contratos c on c.id=m.contrato_id where c.numero=1 and m.ordem<=3 and m.concluido_em is null) <> 0 then raise exception 'FALHA: marcos anteriores não concluídos'; end if;
end $$;

-- Carla entra na Loja A como vendedora: vê os contratos, mas não pode liberar abaixo do mínimo
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into membros(empresa_id,user_id,nome,papel) values (:'empresa_a','00000000-0000-0000-0000-00000000000c','Carla','vendedor');
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000c';
do $$ begin if (select count(*) from contratos) <> 2 then raise exception 'FALHA: vendedora não vê contratos da empresa'; end if; end $$;
insert into orcamentos(empresa_id,cliente_id,nome_projeto,desconto_pct) values (:'empresa_a',:'cli_a','Sala',25) returning id as orc_c \gset
insert into ambientes(empresa_id,orcamento_id,nome,custo_fabrica,pontuacao) values (:'empresa_a',:'orc_c','Sala',4000,3);
do $$ declare ok boolean := false; begin
  begin perform fechar_orcamento((select id from orcamentos where nome_projeto='Sala'), 9000,8000,5000,3000,4000,0,null,true);
  exception when others then ok := sqlerrm like 'Somente dono ou gerente%'; end;
  if not ok then raise exception 'FALHA: vendedora conseguiu liberar abaixo do mínimo'; end if;
end $$;
-- Bruno continua sem ver contratos da A
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin if (select count(*) from contratos) <> 0 then raise exception 'FALHA: vazamento de contratos'; end if; end $$;
reset role;
select 'TODOS OS TESTES PASSARAM' as resultado;
