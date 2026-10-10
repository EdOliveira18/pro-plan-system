// Leitor de extrato OFX (formato que todo banco brasileiro exporta no internet banking).
// Aceita OFX 1.x (SGML, tags sem fechamento) e OFX 2.x (XML).

export type TransacaoBanco = { fitid: string; data: string; valor: number; descricao: string };
export type ExtratoBanco = { banco?: string; agencia?: string; conta?: string; saldo?: number; saldoEm?: string; transacoes: TransacaoBanco[] };

function tag(bloco: string, nome: string): string | undefined {
  // <NOME>valor  (até a próxima tag ou quebra de linha), com ou sem </NOME>
  const m = bloco.match(new RegExp(`<${nome}>\\s*([^<\\r\\n]*)`, "i"));
  const v = m?.[1]?.trim();
  return v ? v : undefined;
}

function dataOfx(v?: string): string | undefined {
  // 20261009, 20261009120000, 20261009120000[-3:BRT]
  const m = v?.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}

function valorOfx(v?: string): number {
  if (!v) return 0;
  const s = v.trim();
  // alguns bancos exportam com vírgula decimal
  const normal = /,\d{1,2}$/.test(s) ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = parseFloat(normal);
  return isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function decodificar(s: string) {
  return s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export function lerOFX(conteudo: string): ExtratoBanco {
  const texto = conteudo.replace(/\r/g, "");
  const blocos = texto.split(/<STMTTRN>/i).slice(1).map((b) => b.split(/<\/STMTTRN>/i)[0]);
  const transacoes: TransacaoBanco[] = [];
  for (const b of blocos) {
    const data = dataOfx(tag(b, "DTPOSTED"));
    if (!data) continue;
    const valor = valorOfx(tag(b, "TRNAMT"));
    const memo = tag(b, "MEMO"), nome = tag(b, "NAME");
    const descricao = decodificar([nome, memo].filter((x, i, a) => x && a.indexOf(x) === i).join(" · ") || tag(b, "TRNTYPE") || "Movimentação");
    // sem FITID, monta um identificador estável para não duplicar na reimportação
    const fitid = tag(b, "FITID") ?? `${data}|${valor}|${descricao}`.slice(0, 200);
    transacoes.push({ fitid, data, valor, descricao });
  }
  const saldoBloco = texto.split(/<LEDGERBAL>/i)[1] ?? "";
  return {
    banco: tag(texto, "BANKID") ?? tag(texto, "ORG"),
    agencia: tag(texto, "BRANCHID"),
    conta: tag(texto, "ACCTID"),
    saldo: saldoBloco ? valorOfx(tag(saldoBloco, "BALAMT")) : undefined,
    saldoEm: saldoBloco ? dataOfx(tag(saldoBloco, "DTASOF")) : undefined,
    transacoes,
  };
}
