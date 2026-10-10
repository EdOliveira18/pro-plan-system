-- Testes das correções da auditoria. Rode com: psql -d pps -f supabase/tests/test_auditoria.sql (tudo dentro de transação, sem sujar o banco)
\set ON_ERROR_STOP 1
begin;
create or replace function pg_temp.como(uid text) returns void language sql as $$ select set_config('request.jwt.claim.sub', uid, true), set_config('role', 'authenticated', true) $$;
create or replace function pg_temp.raiz() returns void language sql as $$ select set_config('role', 'pgtest', true) $$;
create or replace function pg_temp.espera_erro(sqltxt text, trecho text) returns text language plpgsql as $$
begin execute sqltxt; raise exception 'FALHOU: deveria dar erro (%): %', trecho, sqltxt;
exception when others then if sqlerrm not ilike '%' || trecho || '%' and trecho <> '' then raise exception 'FALHOU: erro diferente: %', sqlerrm; end if; return 'ok: ' || trecho; end $$;

insert into auth.users(id, email) values
 ('00000000-0000-0000-0000-0000000000a1','dono@loja.com'), ('00000000-0000-0000-0000-0000000000b2','vend@loja.com'),
 ('00000000-0000-0000-0000-0000000000c3','intruso@x.com'), ('00000000-0000-0000-0000-0000000000d4','mont@loja.com');
insert into empresas(id, nome, cnpj) values ('10000000-0000-0000-0000-000000000001','Loja X','11.222.333/0001-81');
insert into membros(empresa_id,user_id,papel,nome) values ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000a1','dono','D'),
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000b2','vendedor','V'),('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000d4','montador','M');
insert into configuracoes(empresa_id) values ('10000000-0000-0000-0000-000000000001');

-- 1. convite só pelo link e só para o e-mail certo
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
insert into convites(id, empresa_id, email, nome, papel) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','novo@loja.com','Novo','vendedor');
select pg_temp.raiz();
insert into auth.users(id, email) values ('00000000-0000-0000-0000-0000000000e5','novo@loja.com');
select token as tk from convites where id='20000000-0000-0000-0000-000000000001' \gset
select pg_temp.como('00000000-0000-0000-0000-0000000000c3');
select aceitar_convites() = 0 as aceite_automatico_desligado;
select pg_temp.espera_erro(format('select aceitar_convite(%L)', :'tk'), 'CONVITE_OUTRO_EMAIL');
select pg_temp.como('00000000-0000-0000-0000-0000000000e5');
select aceitar_convite(:'tk')->>'empresa' = 'Loja X' as convite_aceito;

-- 2. CNPJ: outro usuário pode cadastrar o mesmo CNPJ (não bloqueia o dono real); dono não se autoverifica
select pg_temp.como('00000000-0000-0000-0000-0000000000c3');
select criar_empresa('Golpe', '11.222.333/0001-81', 'X') is not null as cnpj_repetido_nao_bloqueia;
select pg_temp.como('00000000-0000-0000-0000-0000000000a1');
select pg_temp.espera_erro($$update empresas set cnpj_verificado = true where id = '10000000-0000-0000-0000-000000000001'$$, 'administração');
select pg_temp.espera_erro($$update empresas set plano = 'pro', plano_ate = '2099-01-01' where id = '10000000-0000-0000-0000-000000000001'$$, 'administração');
select pg_temp.espera_erro($$select admin_empresas()$$, 'restrito');

-- 4/5. vendedor vê funcionários mas não salário; vendedor não vê financeiro
insert into pessoas(id, empresa_id, categoria, nome, funcao) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','funcionario','Zé','Montador');
insert into pessoas_sigilo(pessoa_id, empresa_id, salario) values ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001', 3500);
insert into lancamentos(empresa_id, data, descricao, categoria, valor) values ('10000000-0000-0000-0000-000000000001', current_date, 'Salário Zé', 'despesa', -3500);
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select count(*) = 1 as vendedor_ve_funcionario from pessoas where categoria = 'funcionario';
select count(*) = 0 as vendedor_nao_ve_salario from pessoas_sigilo;
select count(*) = 0 as vendedor_nao_ve_financeiro from lancamentos;
select pg_temp.como('00000000-0000-0000-0000-0000000000d4');
select count(*) = 1 as montador_ve_funcionario from pessoas where categoria = 'funcionario';
select count(*) = 0 as montador_nao_ve_orcamentos from orcamentos;

-- 12. vendedor não exclui cadastro
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
insert into parceiros(id, empresa_id, nome) values ('40000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Arq');
delete from parceiros where id = '40000000-0000-0000-0000-000000000001';
select count(*) = 1 as vendedor_nao_apaga_arquiteto from parceiros where id = '40000000-0000-0000-0000-000000000001';

-- 6/13. conversão de unidade e estoque protegido
select pg_temp.raiz();
insert into produtos(id, empresa_id, codigo, nome, tipo, unid_compra, fator_conversao, unid_producao, valor_compra) values
 ('50000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','DOB','Dobradiça','Ferragem','CX',10,'UN',50);
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
insert into pedidos_estoque(id, empresa_id, tipo) values ('60000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','compra');
insert into pedido_itens(empresa_id, pedido_id, produto_id, quantidade, valor_unit) values ('10000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001', 2, 60);
select finalizar_pedido_estoque('60000000-0000-0000-0000-000000000001');
select estoque = 20 as compra_2_caixas_vira_20_unidades from produtos where id = '50000000-0000-0000-0000-000000000001';
update produtos set estoque = 999 where id = '50000000-0000-0000-0000-000000000001';
select estoque = 20 as edicao_direta_nao_muda_estoque from produtos where id = '50000000-0000-0000-0000-000000000001';
select ajustar_estoque('50000000-0000-0000-0000-000000000001', 18, 'Contagem física');
select estoque = 18 as ajuste_com_motivo from produtos where id = '50000000-0000-0000-0000-000000000001';
select pg_temp.raiz();
select count(*) = 1 as compra_gerou_conta_a_pagar from lancamentos where categoria = 'compra_material' and valor = -120;
select round(custo_unit, 2) = 6 as custo_por_unidade from estoque_movimentos where tipo = 'entrada';

-- 11/15. regras de faturamento
insert into clientes(id, empresa_id, nome) values ('70000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Cliente sem CPF');
insert into orcamentos(id, empresa_id, cliente_id, nome_projeto, forma_pagamento, parcelas) values ('80000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','Cozinha','boleto',3);
insert into ambientes(empresa_id, orcamento_id, nome, custo_fabrica, pontuacao, versao) values ('10000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','Cozinha',10000,3,1);
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.espera_erro($$select fechar_orcamento('80000000-0000-0000-0000-000000000001', 30000, 28000, 15000, 13000, 10000, 0)$$, 'FALTA_DOCUMENTO');
select pg_temp.raiz();
update clientes set cpf_cnpj = '123.456.789-09', logradouro = 'Rua A', numero = '1', cidade = 'SP', uf = 'SP' where id = '70000000-0000-0000-0000-000000000001';
update orcamentos set status = 'perdido' where id = '80000000-0000-0000-0000-000000000001';
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.espera_erro($$select fechar_orcamento('80000000-0000-0000-0000-000000000001', 30000, 28000, 15000, 13000, 10000, 0)$$, 'perdido');
select pg_temp.raiz();
update orcamentos set status = 'rascunho' where id = '80000000-0000-0000-0000-000000000001';
update configuracoes set dias_primeira_parcela = 10 where empresa_id = '10000000-0000-0000-0000-000000000001';
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select fechar_orcamento('80000000-0000-0000-0000-000000000001', 30000, 28000, 15000, 13000, 10000, 0) is not null as vendedor_fecha_contrato;
select pg_temp.raiz();
select min(data) = current_date + 10 as primeira_parcela_em_10_dias, count(*) = 3 as tres_parcelas, bool_and(plano_conta = '1.1.1') as plano_de_contas
  from lancamentos where categoria = 'recebimento';
select garantia_ate = (current_date + interval '12 months')::date as garantia_gravada from contratos;

-- cota de render: não dá para apagar o uso, cota acaba, plano vencido bloqueia, falha devolve
create or replace function pg_temp.ok(c boolean, nome text) returns text language plpgsql as $$
begin if c is not true then raise exception 'FALHOU: %', nome; end if; return 'ok: ' || nome; end $$;
insert into arquivos(id, empresa_id, tipo, nome, storage_path) values ('90000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','planta','p.png','x/p.png');
insert into renders(id, empresa_id, origem_arquivo_id) values
 ('91000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001'),
 ('91000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001'),
 ('91000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','90000000-0000-0000-0000-000000000001');
select set_config('pps.plataforma','1',true);
update empresas set plano = 'basico', plano_ate = current_date + 30, limite_renders = 2 where id = '10000000-0000-0000-0000-000000000001';
select set_config('pps.plataforma','',true);
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.ok(consumir_render('91000000-0000-0000-0000-000000000001') = 1, 'render 1 de 2');
select pg_temp.ok(consumir_render('91000000-0000-0000-0000-000000000002') = 0, 'render 2 de 2');
select pg_temp.espera_erro($$select consumir_render('91000000-0000-0000-0000-000000000003')$$, 'COTA_ESGOTADA');
delete from uso_renders;
select pg_temp.ok(renders_no_mes('10000000-0000-0000-0000-000000000001') = 2, 'usuario nao apaga o uso');
update renders set status = 'erro' where id = '91000000-0000-0000-0000-000000000002';
select devolver_render('91000000-0000-0000-0000-000000000002');
select pg_temp.ok(renders_no_mes('10000000-0000-0000-0000-000000000001') = 1, 'falha devolve a cota');
select pg_temp.como('00000000-0000-0000-0000-0000000000c3');
select pg_temp.espera_erro($$select consumir_render('91000000-0000-0000-0000-000000000003')$$, 'SEM_PERMISSAO');
select pg_temp.raiz();
select set_config('pps.plataforma','1',true);
update empresas set plano_ate = current_date - 1 where id = '10000000-0000-0000-0000-000000000001';
select set_config('pps.plataforma','',true);
select pg_temp.como('00000000-0000-0000-0000-0000000000b2');
select pg_temp.espera_erro($$select consumir_render('91000000-0000-0000-0000-000000000003')$$, 'PLANO_INATIVO');
select pg_temp.ok((resumo_orcamentos_f('10000000-0000-0000-0000-000000000001', array['fechado'], null, null, 'sem CPF')->>'qtd')::int = 1, 'resumo filtra pelo nome do cliente');
select pg_temp.ok((resumo_orcamentos_f('10000000-0000-0000-0000-000000000001', array['fechado'], null, null, 'zzz')->>'qtd')::int = 0, 'resumo com termo sem resultado');
select pg_temp.raiz();

select 'TODOS OS TESTES PASSARAM' as resultado;
rollback;
