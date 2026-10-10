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

import { lerOFX } from "../lib/banco/ofx.ts";
import { conciliar } from "../lib/banco/conciliar.ts";

test("OFX 1.x SGML com saldo e várias transações", () => {
  const ofx = `OFXHEADER:100
DATA:OFXSGML

<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL
<BANKACCTFROM><BANKID>0341<BRANCHID>1234<ACCTID>56789-0<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST><DTSTART>20261001<DTEND>20261010
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>5591.04<FITID>A1<MEMO>PIX RECEBIDO CAROLINA</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261006<TRNAMT>-18636,80<FITID>A2<NAME>TED FABRICA SUDATI</STMTTRN>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261007<TRNAMT>-12.90<MEMO>TARIFA &amp; PACOTE</STMTTRN>
</BANKTRANLIST><LEDGERBAL><BALAMT>48210.33<DTASOF>20261010</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const r = lerOFX(ofx);
  assert.equal(r.banco, "0341");
  assert.equal(r.conta, "56789-0");
  assert.equal(r.saldo, 48210.33);
  assert.equal(r.transacoes.length, 3);
  assert.deepEqual(r.transacoes[0], { fitid: "A1", data: "2026-10-05", valor: 5591.04, descricao: "PIX RECEBIDO CAROLINA" });
  assert.equal(r.transacoes[1].valor, -18636.8);
  assert.equal(r.transacoes[2].descricao, "TARIFA & PACOTE");
  assert.ok(r.transacoes[2].fitid.length > 0);
});

test("OFX 2.x XML", () => {
  const xml = `<?xml version="1.0"?><OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>260</BANKID><ACCTID>111</ACCTID></BANKACCTFROM><BANKTRANLIST>
  <STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20261003</DTPOSTED><TRNAMT>100.50</TRNAMT><FITID>X9</FITID><MEMO>Recebimento</MEMO></STMTTRN>
  </BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  const r = lerOFX(xml);
  assert.equal(r.banco, "260");
  assert.deepEqual(r.transacoes, [{ fitid: "X9", data: "2026-10-03", valor: 100.5, descricao: "Recebimento" }]);
});

test("conciliação: valor igual e data próxima; ambíguo fica pendente; sinal diferente não casa", () => {
  const movs = [
    { id: "m1", data: "2026-10-05", valor: 5591.04 },
    { id: "m2", data: "2026-10-06", valor: -18636.8 },
    { id: "m3", data: "2026-10-10", valor: 1000 },
    { id: "m4", data: "2026-10-12", valor: -500 },
  ];
  const prev = [
    { id: "p1", data: "2026-10-04", valor: 5591.04 },
    { id: "p2", data: "2026-10-01", valor: -18636.8 },
    { id: "p3a", data: "2026-10-08", valor: 1000 },
    { id: "p3b", data: "2026-10-12", valor: 1000 },
    { id: "p4", data: "2026-10-12", valor: 500 },
  ];
  const r = conciliar(movs, prev);
  assert.equal(r.get("m1"), "p1");
  assert.equal(r.get("m2"), "p2");
  assert.equal(r.has("m3"), false); // dois candidatos a 2 dias
  assert.equal(r.has("m4"), false); // sinal oposto
});
