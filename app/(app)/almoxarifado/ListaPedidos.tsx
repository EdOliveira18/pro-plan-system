import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";

const ST: Record<string, [string, string]> = { aberto: ["Em aberto", "p-warn"], finalizado: ["Finalizado", "p-good"], cancelado: ["Cancelado", "p-neu"] };

export default async function ListaPedidos({ tipo, q }: { tipo: "compra" | "saida"; q?: string }) {
  const ctx = await contexto();
  const { data: rows } = await ctx.supabase.from("pedidos_estoque")
    .select("id, numero, data, documento, status, valor_total, tipo_saida, finalizado_em, fornecedor:pessoas(nome, nome_fantasia), contrato:contratos(codigo, cliente:clientes(nome)), pedido_itens(quantidade, valor_unit)")
    .eq("empresa_id", ctx.empresa.id).eq("tipo", tipo).order("numero", { ascending: false }).limit(500);
  const t = (q ?? "").toLowerCase().trim();
  const lista = ((rows ?? []) as any[]).filter((p) => !t || [String(p.numero), p.documento, p.fornecedor?.nome, p.fornecedor?.nome_fantasia, p.contrato?.codigo, p.contrato?.cliente?.nome].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const valor = (p: any) => (p.status === "finalizado" ? Number(p.valor_total) : (p.pedido_itens ?? []).reduce((a: number, i: any) => a + Number(i.quantidade) * Number(i.valor_unit), 0));
  return (
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={q ?? ""} placeholder={tipo === "compra" ? "Código do pedido, nº NF-e, fornecedor" : "Buscar por cliente, código do pedido ou contrato"} style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Código</th><th>Data pedido</th>{tipo === "compra" ? <><th>Nº doc / NF-e</th><th>Fornecedor</th></> : <><th>Cliente</th><th>Contrato</th><th>Tipo</th></>}<th>Situação</th><th className="r">Valor</th><th className="r">Ações</th></tr></thead>
        <tbody>{lista.map((p) => (
          <tr key={p.id}>
            <td className="num"><Link href={`/almoxarifado/pedido/${p.id}`}><b>{p.numero}</b></Link></td>
            <td className="num note">{data(p.data)}</td>
            {tipo === "compra" ? <><td className="note">{p.documento ?? "n/a"}</td><td>{p.fornecedor?.nome_fantasia || p.fornecedor?.nome || "n/a"}</td></>
              : <><td>{p.contrato?.cliente?.nome ?? "n/a"}</td><td className="num">{p.contrato ? "#" + p.contrato.codigo : "n/a"}</td><td className="note">{p.tipo_saida ?? "n/a"}</td></>}
            <td><span className={"pill " + ST[p.status][1]}>{ST[p.status][0]}</span>{p.finalizado_em && <div className="note">{data(p.finalizado_em)}</div>}</td>
            <td className="r num">{brl(valor(p))}</td>
            <td className="r"><Link className="btn sm" href={`/almoxarifado/pedido/${p.id}`}>Abrir</Link></td>
          </tr>))}</tbody>
      </table></div>
      {!lista.length && <div className="vazio"><b>Nenhum pedido cadastrado.</b></div>}
      <div className="cad-rod note">Mostrando {lista.length} registro(s)</div>
    </div>
  );
}
