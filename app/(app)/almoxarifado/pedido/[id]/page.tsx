import Link from "next/link";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import Confirmar from "@/components/Confirmar";
import { adicionarItem, removerItem, finalizarPedido, cancelarPedido } from "../../acoes";

export default async function Pedido({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: p } = await ctx.supabase.from("pedidos_estoque")
    .select("*, fornecedor:pessoas(nome, nome_fantasia), contrato:contratos(id, codigo, cliente:clientes(nome)), natureza:naturezas(nome, cfop_estadual), pedido_itens(id, quantidade, valor_unit, produto:produtos(codigo, nome, unid_producao, estoque, valor_final))")
    .eq("id", id).eq("empresa_id", ctx.empresa.id).maybeSingle();
  if (!p) notFound();
  const { data: prods } = await ctx.supabase.from("produtos").select("id, codigo, nome, estoque, unid_producao, valor_compra").eq("empresa_id", ctx.empresa.id).is("excluido_em", null).order("nome");
  const aberto = p.status === "aberto";
  const itens = (p.pedido_itens ?? []) as any[];
  const unit = (i: any) => (p.tipo === "saida" ? Number(i.produto?.valor_final) : Number(i.valor_unit));
  const total = itens.reduce((a, i) => a + Number(i.quantidade) * unit(i), 0);
  const volta = p.tipo === "compra" ? "/almoxarifado/compras" : "/almoxarifado/saidas";
  return (<>
    <nav className="migalha"><Link href={volta}>Almoxarifado › {p.tipo === "compra" ? "Pedidos de compra" : "Pedidos de saída"}</Link> › Nº {p.numero}</nav>
    <div className="head"><div><h1>Pedido de {p.tipo === "compra" ? "compra" : "saída"} nº {p.numero}</h1>
      <p className="sub">{data(p.data)} · {p.tipo === "compra" ? (p.fornecedor?.nome_fantasia || p.fornecedor?.nome) : p.contrato ? `Contrato #${p.contrato.codigo} · ${p.contrato.cliente?.nome}` : "Uso interno"}{p.documento ? ` · ${p.documento}` : ""}{p.natureza ? ` · ${p.natureza.nome} (${p.natureza.cfop_estadual})` : ""}</p></div>
      <span className={"pill " + (aberto ? "p-warn" : p.status === "finalizado" ? "p-good" : "p-neu")}>{aberto ? "Em aberto" : p.status === "finalizado" ? "Finalizado" : "Cancelado"}</span></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <div className="panel" style={{ padding: 0 }}>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Código</th><th>Produto</th><th className="r">Quantidade</th>{p.tipo === "saida" && aberto && <th className="r">Em estoque</th>}<th className="r">{p.tipo === "compra" ? "Valor unit." : "Custo unit."}</th><th className="r">Total</th>{aberto && <th />}</tr></thead>
        <tbody>{itens.map((i) => (
          <tr key={i.id}>
            <td className="num">{i.produto?.codigo}</td><td>{i.produto?.nome}</td>
            <td className="r num">{String(Number(i.quantidade)).replace(".", ",")} {i.produto?.unid_producao}</td>
            {p.tipo === "saida" && aberto && <td className="r num" style={{ color: Number(i.produto?.estoque) < Number(i.quantidade) ? "var(--bad)" : undefined }}>{String(Number(i.produto?.estoque)).replace(".", ",")}</td>}
            <td className="r num">{brl(unit(i))}</td><td className="r num">{brl(Number(i.quantidade) * unit(i))}</td>
            {aberto && <td className="r"><form action={removerItem.bind(null, id, i.id)}><button className="btn sm">Remover</button></form></td>}
          </tr>))}
          <tr><td colSpan={p.tipo === "saida" && aberto ? 5 : 4} className="r"><b>Total</b></td><td className="r num"><b>{brl(p.status === "finalizado" ? Number(p.valor_total) : total)}</b></td>{aberto && <td />}</tr>
        </tbody>
      </table></div>
      {aberto && (
        <form action={adicionarItem.bind(null, id)} className="cad-busca" style={{ borderTop: "1px solid var(--line)", borderBottom: 0 }}>
          <select name="produto_id" required defaultValue="" style={{ flex: 2, minWidth: 220 }} aria-label="Produto"><option value="">Escolha o produto</option>
            {(prods ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.codigo} · {x.nome} (estoque {String(Number(x.estoque)).replace(".", ",")} {x.unid_producao})</option>)}</select>
          <input name="quantidade" inputMode="decimal" placeholder="Quantidade" required style={{ width: 120 }} aria-label="Quantidade" />
          {p.tipo === "compra" && <input name="valor_unit" inputMode="decimal" placeholder="Valor unit. (opcional)" style={{ width: 170 }} aria-label="Valor unitário" />}
          <button className="btn">Adicionar item</button>
          <Link className="note" href="/cadastros/produtos/novo" style={{ alignSelf: "center" }}>+ Novo produto</Link>
        </form>
      )}
    </div>
    {aberto && (
      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        <form action={finalizarPedido.bind(null, id)}><Confirmar className="btn primary" texto={p.tipo === "compra" ? "Finalizar e dar entrada no estoque?" : "Finalizar e dar baixa no estoque?"}>Finalizar pedido</Confirmar></form>
        <form action={cancelarPedido.bind(null, id)}><Confirmar className="btn" texto="Cancelar este pedido?">Cancelar pedido</Confirmar></form>
        <span className="note" style={{ alignSelf: "center" }}>{p.tipo === "compra" ? (p.gerar_financeiro ? "Ao finalizar: entrada no estoque e lançamento em Contas a pagar." : "Ao finalizar: entrada no estoque.") : "Ao finalizar: baixa no estoque e custo no contrato."}</span>
      </div>
    )}
  </>);
}
