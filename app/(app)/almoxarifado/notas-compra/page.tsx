import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import { importarXML, gerarPedidoDaNota, marcarNota } from "../acoes";

const ABAS: [string, string][] = [["", "Todas"], ["pendente", "Pendentes"], ["gerada", "Geradas"], ["outra", "Outras"]];

export default async function NotasCompra({ searchParams }: { searchParams: Promise<{ s?: string; q?: string; erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: rows } = await ctx.supabase.from("notas_compra").select("id, chave, numero, serie, emitente_nome, emitente_cnpj, emissao, valor, status, pedido_id, itens").eq("empresa_id", ctx.empresa.id).order("emissao", { ascending: false }).limit(1000);
  const todas = (rows ?? []) as any[];
  const t = (sp.q ?? "").toLowerCase().trim();
  const lista = todas.filter((n) => (!sp.s || n.status === sp.s) && (!t || [n.numero, n.emitente_nome, n.chave].some((x) => String(x ?? "").toLowerCase().includes(t))));
  return (<>
    <div className="head"><div><nav className="migalha">Almoxarifado › Notas de compra</nav><h1>Notas Fiscais de Compra</h1><p className="sub">Importe o XML que o fornecedor envia e transforme em pedido de compra com um clique</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <div className="cad-aviso" style={{ margin: "0 0 14px" }}>Por enquanto a entrada é pelo XML (o fornecedor manda junto com o DANFE). A captura automática direto da Sefaz, pelo CNPJ da loja, depende do certificado A1 e entra na próxima etapa.</div>
    <form action={importarXML} className="panel" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <b>Importar XML</b><input type="file" name="xml" accept=".xml,text/xml,application/xml" multiple required /><button className="btn primary">Importar</button>
      <span className="note">Pode escolher vários arquivos de uma vez.</span>
    </form>
    <div className="panel" style={{ padding: 0 }}>
      <div className="cad-busca">
        <nav className="abas" style={{ margin: 0 }}>{ABAS.map(([k, n]) => <Link key={k} href={`/almoxarifado/notas-compra${k ? "?s=" + k : ""}`} aria-current={(sp.s ?? "") === k ? "page" : undefined}>{n} <span className="note">{todas.filter((x) => !k || x.status === k).length}</span></Link>)}</nav>
        <form style={{ flex: 1 }}>{sp.s && <input type="hidden" name="s" value={sp.s} />}<input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por número, fornecedor ou chave" aria-label="Buscar" style={{ width: "100%" }} /></form>
      </div>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Data</th><th>Fornecedor</th><th>Série-Nº</th><th className="r">Itens</th><th className="r">Valor</th><th>Situação</th><th className="r">Ações</th></tr></thead>
        <tbody>{lista.map((n) => (
          <tr key={n.id}>
            <td className="num note">{n.emissao ? data(n.emissao) : "n/a"}</td>
            <td><b>{n.emitente_nome}</b><div className="note num">{n.emitente_cnpj}</div></td>
            <td className="num">{n.serie}-{n.numero}<div className="note" style={{ fontSize: 10.5 }}>{n.chave}</div></td>
            <td className="r num">{(n.itens ?? []).length}</td>
            <td className="r num">{brl(n.valor)}</td>
            <td><span className={"pill " + (n.status === "pendente" ? "p-warn" : n.status === "gerada" ? "p-good" : "p-neu")}>{n.status === "pendente" ? "Pendente" : n.status === "gerada" ? "Pedido gerado" : "Outra"}</span></td>
            <td className="r" style={{ whiteSpace: "nowrap" }}>
              {n.status === "pendente" && <><form action={gerarPedidoDaNota.bind(null, n.id)} style={{ display: "inline" }}><button className="btn primary sm">Gerar pedido</button></form>{" "}
                <form action={marcarNota.bind(null, n.id, "outra")} style={{ display: "inline" }}><button className="btn sm" title="Nota que não é de material (serviço, uso pessoal…)">Outra</button></form></>}
              {n.status === "gerada" && n.pedido_id && <Link className="btn sm" href={`/almoxarifado/pedido/${n.pedido_id}`}>Ver pedido</Link>}
              {n.status === "outra" && <form action={marcarNota.bind(null, n.id, "pendente")} style={{ display: "inline" }}><button className="btn sm">Voltar p/ pendente</button></form>}
            </td>
          </tr>))}</tbody>
      </table></div>
      {!lista.length && <div className="vazio"><b>Nenhuma nota fiscal encontrada.</b></div>}
      <div className="cad-rod note">Mostrando {lista.length} registro(s)</div>
    </div>
  </>);
}
