// node --experimental-strip-types --test tests/
import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularOlhinho, type Config } from "../lib/olhinho.ts";
import { lerPromob } from "../lib/promob.ts";

const cfg: Config = {
  pontuacao_minima: 2.6, frete_pct: 15, comissao_loja_pct: 3, montagem_pct: 6, impostos_pct: 4.44, outros_pct: 1.1, boleto_pct: 1.2,
  taxas_cartao: { "1": 2.4, "10": 9.1 },
};
const amb = [{ custo_fabrica: 9543.14, pontuacao: 3 }, { custo_fabrica: 9093.66, pontuacao: 3 }];

test("olhinho à vista sem RT: VPL igual à proposta", () => {
  const r = calcularOlhinho(amb, { desconto_pct: 0, forma_pagamento: "avista", parcelas: 1, rt_pct: 0 }, cfg);
  assert.equal(r.custoFabrica, 18636.8);
  assert.equal(r.valorProposta, 55910.4);
  assert.equal(r.vpl, 55910.4);
  assert.equal(r.travado, false);
  assert.ok(Math.abs(r.lucro - (r.vpl - r.custoTotal)) < 0.01);
});

test("olhinho cartão 10x com RT 10% desconta taxa e parceiro", () => {
  const r = calcularOlhinho(amb, { desconto_pct: 0, forma_pagamento: "cartao", parcelas: 10, rt_pct: 10 }, cfg);
  assert.equal(r.taxaPagamento, Math.round(55910.4 * 0.091 * 100) / 100);
  const esperadoVpl = (55910.4 - 55910.4 * 0.091) * 0.9;
  assert.ok(Math.abs(r.vpl - esperadoVpl) < 0.02);
});

test("trava com desconto que derruba a pontuação abaixo do mínimo", () => {
  const r = calcularOlhinho(amb, { desconto_pct: 20, forma_pagamento: "avista", parcelas: 1, rt_pct: 0 }, cfg);
  assert.ok(Math.abs(r.pontuacaoMedia - 2.4) < 1e-9);
  assert.equal(r.travado, true);
});

test("Promob XML: ambientes com peças e quantidades", () => {
  const xml = `<?xml version="1.0"?><PROJECT><AMBIENTS>
    <AMBIENT DESCRIPTION="Cozinha"><ITEM DESCRIPTION="Balcão 1800" QUANTITY="1" PRICE="2140,50"/><ITEM DESCRIPTION="Aéreo 900" QUANTITY="2" PRICE="612.30"/></AMBIENT>
    <AMBIENT DESCRIPTION="Escritório"><ITEM DESCRIPTION="Bancada" QUANTITY="1" PRICE="1830.40"/></AMBIENT>
  </AMBIENTS></PROJECT>`;
  const r = lerPromob(xml, "projeto.xml");
  assert.equal(r.length, 2);
  assert.equal(r[0].nome, "Cozinha");
  assert.equal(r[0].custo_fabrica, 3365.1);
  assert.equal(r[0].pecas.length, 2);
  assert.equal(r[1].custo_fabrica, 1830.4);
});

test("Promob TXT com cabeçalho e formato brasileiro", () => {
  const txt = "Ambiente;Descrição;Qtd;Custo\nCozinha;Balcão;1;2.140,50\nCozinha;Aéreo;2;612,30\nSala;Painel TV;1;980,00";
  const r = lerPromob(txt, "lista.txt");
  assert.deepEqual(r.map((a) => [a.nome, a.custo_fabrica]), [["Cozinha", 3365.1], ["Sala", 980]]);
});
