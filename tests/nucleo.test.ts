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

import forge from "node-forge";
import { cnpjValido, formatarCNPJ } from "../lib/cnpj.ts";
import { lerCertificadoA1 } from "../lib/certificado.ts";

test("CNPJ: valida dígitos e formata", () => {
  assert.equal(cnpjValido("11.222.333/0001-81"), true);
  assert.equal(cnpjValido("11.222.333/0001-82"), false);
  assert.equal(cnpjValido("00000000000000"), false);
  assert.equal(formatarCNPJ("11222333000181"), "11.222.333/0001-81");
});

test("Certificado A1: lê titular, CNPJ e validade; recusa senha errada", () => {
  const keys = forge.pki.rsa.generateKeyPair(1024);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date("2026-01-01");
  cert.validity.notAfter = new Date("2027-01-01");
  const attrs = [{ name: "commonName", value: "LOJA TESTE PLANEJADOS LTDA:11222333000181" }];
  cert.setSubject(attrs); cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], "senha123", { algorithm: "3des" });
  const der = forge.asn1.toDer(p12).getBytes();
  const bytes = Uint8Array.from(der, (c) => c.charCodeAt(0));
  const info = lerCertificadoA1(bytes, "senha123");
  assert.equal(info.titular, "LOJA TESTE PLANEJADOS LTDA");
  assert.equal(info.cnpj, "11222333000181");
  assert.equal(info.validoAte.toISOString().slice(0, 10), "2027-01-01");
  assert.throws(() => lerCertificadoA1(bytes, "errada"), /senha/);
});

import { lerNFe } from "../lib/nfe-xml.ts";
test("lê XML de NF-e de compra com dois itens", () => {
  const xml = `<?xml version="1.0"?><nfeProc xmlns="http://www.portalfiscal.inf.br/nfe"><NFe><infNFe Id="NFe35261012345678000199550010000012341000012345" versao="4.00">
  <ide><serie>1</serie><nNF>1234</nNF><dhEmi>2026-10-05T10:00:00-03:00</dhEmi></ide>
  <emit><CNPJ>12345678000199</CNPJ><xNome>DURATEX SA</xNome><xFant>Duratex</xFant></emit><dest><CNPJ>11222333000181</CNPJ></dest>
  <det nItem="1"><prod><cProd>MDF18BR</cProd><xProd>MDF BRANCO 18MM</xProd><NCM>44111310</NCM><CFOP>5101</CFOP><uCom>CH</uCom><qCom>10.0000</qCom><vUnCom>220.00</vUnCom><vProd>2200.00</vProd></prod></det>
  <det nItem="2"><prod><cProd>DOB35</cProd><xProd>DOBRADICA 35MM</xProd><NCM>83021000</NCM><CFOP>5102</CFOP><uCom>un</uCom><qCom>50</qCom><vUnCom>4.5</vUnCom><vProd>225.00</vProd></prod></det>
  <total><ICMSTot><vNF>2425.00</vNF></ICMSTot></total></infNFe></NFe></nfeProc>`;
  const n = lerNFe(xml);
  assert.equal(n.chave, "35261012345678000199550010000012341000012345");
  assert.equal(n.numero, "1234");
  assert.equal(n.emitenteNome, "Duratex");
  assert.equal(n.valor, 2425);
  assert.equal(n.itens.length, 2);
  assert.equal(n.itens[1].unidade, "UN");
  assert.equal(n.itens[0].quantidade, 10);
  assert.equal(n.emissao, "2026-10-05");
});

test("NF-e sem chave no XML ganha chave de emitente, série e número", () => {
  const xml = `<NFe><infNFe><ide><serie>2</serie><nNF>77</nNF></ide><emit><CNPJ>12345678000199</CNPJ><xNome>X</xNome></emit><total><ICMSTot><vNF>10</vNF></ICMSTot></total></infNFe></NFe>`;
  assert.equal(lerNFe(xml).chave, "SEM-CHAVE-12345678000199-2-77");
});

import { hojeISO, somaDias, mesAtual } from "../lib/tempo.ts";
test("datas seguem Brasília: 23h30 de Brasília ainda é o mesmo dia, mesmo já sendo amanhã em UTC", () => {
  assert.equal(hojeISO(new Date("2026-10-11T02:30:00Z")), "2026-10-10");
  assert.equal(hojeISO(new Date("2026-10-11T03:30:00Z")), "2026-10-11");
  assert.equal(somaDias("2026-01-31", 1), "2026-02-01");
  assert.equal(somaDias("2026-03-01", -1), "2026-02-28");
  const m = mesAtual();
  assert.ok(m.de.endsWith("-01") && m.ate >= m.de);
});

import { lerValor } from "../lib/formato.ts";
test("lerValor aceita o jeito que o vendedor digita", () => {
  assert.equal(lerValor("R$ 20.000,00"), 20000);
  assert.equal(lerValor("20.000"), 20000);
  assert.equal(lerValor("20000,5"), 20000.5);
  assert.equal(lerValor("20000.50"), 20000.5);
  assert.equal(lerValor("1.234.567,89"), 1234567.89);
  assert.equal(lerValor(""), 0);
});
