import { notFound } from "next/navigation";
import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { entidade } from "@/lib/cadastros";
import { contexto as ctxPapel, exigir } from "@/lib/contexto";
import Formulario from "../../Formulario";
import { ajustarEstoque } from "../../actions";
import { dataHora } from "@/lib/tempo";

const TIPO_MOV: Record<string, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste" };

export default async function Editar({ params, searchParams }: { params: Promise<{ ent: string; id: string }>; searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const { ent, id } = await params;
  const sp = await searchParams;
  const e = entidade(ent);
  if (!e) notFound();
  { const c0 = await ctxPapel(); exigir(c0, c0.papel !== "montador" || e.slug === "ferramentas"); }
  const ctx = await contexto();
  const { data } = await ctx.supabase.from(e.tabela).select("*").eq("id", id).eq("empresa_id", ctx.empresa.id).maybeSingle();
  if (!data) notFound();
  const Nome = e.singular[0].toUpperCase() + e.singular.slice(1);
  const produto = e.slug === "produtos" ? (data as any) : null;
  const { data: movs } = produto
    ? await ctx.supabase.from("estoque_movimentos").select("id, tipo, quantidade, observacao, em, pedido_id").eq("produto_id", id).order("em", { ascending: false }).limit(15)
    : { data: null };
  const fmt = (n: unknown) => Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  return (
    <>
      <nav className="migalha"><Link href={`/cadastros/${e.slug}`}>{e.grupo ?? "Cadastros"}</Link> › <Link href={`/cadastros/${e.slug}`}>{e.plural[0].toUpperCase() + e.plural.slice(1)}</Link> › Editar</nav>
      <div className="head"><div><h1>{Nome}: {(data as any).nome ?? (data as any).sigla}</h1><p className="sub">Altere as informações e clique em Salvar</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      {produto && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <h2>Estoque: {fmt(produto.estoque)} {produto.unid_producao}</h2>
          <p className="note" style={{ marginTop: -6 }}>O estoque muda pelos pedidos de compra e saída. Para corrigir depois de uma contagem, informe a quantidade real e o motivo; fica registrado no histórico.</p>
          <form action={ajustarEstoque.bind(null, id)} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
            <label>Quantidade contada ({produto.unid_producao})<input name="quantidade" inputMode="decimal" required defaultValue={fmt(produto.estoque)} /></label>
            <label style={{ flex: 1, minWidth: 200 }}>Motivo<input name="motivo" required placeholder="Ex.: inventário mensal, perda, quebra" /></label>
            <button className="btn">Ajustar estoque</button>
          </form>
          {!!movs?.length && <div className="scroll mt"><table>
            <thead><tr><th>Quando</th><th>Tipo</th><th className="r">Quantidade</th><th>Observação</th></tr></thead>
            <tbody>{movs.map((m: any) => <tr key={m.id}><td className="note">{dataHora(m.em)}</td><td>{TIPO_MOV[m.tipo] ?? m.tipo}</td><td className="r num">{m.tipo === "saida" || Number(m.quantidade) < 0 ? "−" : "+"}{fmt(Math.abs(Number(m.quantidade)))}</td><td className="note">{m.observacao ?? (m.pedido_id ? "Pedido" : "")}</td></tr>)}</tbody>
          </table></div>}
        </div>
      )}
      <Formulario e={e} registro={data as any} />
    </>
  );
}
