import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import NavOrc from "../NavOrc";
import { moverOrcamento } from "../acoes-status";
import { dataHora } from "@/lib/tempo";
import Paginacao, { pagina } from "@/components/Paginacao";
import { filtroOrcamentos } from "@/lib/busca";

export default async function Excluidos({ searchParams }: { searchParams: Promise<{ q?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const pg = pagina(sp.pag);
  let q = ctx.supabase.from("orcamentos").select("id, numero, nome_projeto, data_entrega, excluido_em, excluido_por, calculo, cliente:clientes(nome)", { count: "exact" })
    .eq("empresa_id", ctx.empresa.id).eq("status", "excluido");
  const filtro = await filtroOrcamentos(ctx.supabase, ctx.empresa.id, sp.q ?? "");
  if (filtro) q = q.or(filtro);
  const [{ data: rows, count }, { data: ms }] = await Promise.all([
    q.order("excluido_em", { ascending: false }).order("id").range(pg.de, pg.ate),
    ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", ctx.empresa.id),
  ]);
  const nomes = Object.fromEntries((ms ?? []).map((m: any) => [m.user_id, m.nome]));
  const lista = (rows ?? []) as any[];
  return (
    <>
      <div className="head"><div><h1>Orçamentos Excluídos</h1><p className="sub">O que foi excluído, quando e por quem. Restaurar devolve o orçamento para a lista.</p></div></div>
      <NavOrc atual="/comercial/excluidos" />
      <div className="panel" style={{ padding: 0 }}>
        <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar cliente ou número" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Nº</th><th>Cliente</th><th>Data entrega</th><th className="r">Valor</th><th>Excluído em</th><th>Excluído por</th><th className="r">Ações</th></tr></thead>
          <tbody>{lista.map((o) => (
            <tr key={o.id}>
              <td className="num"><Link href={`/comercial/${o.id}`}><b>{o.numero}</b></Link></td>
              <td><b>{o.cliente?.nome}</b><div className="note">{o.nome_projeto}</div></td>
              <td className="num note">{o.data_entrega ? data(o.data_entrega) : "n/a"}</td>
              <td className="r num">{o.calculo ? brl(o.calculo.valorProposta) : "n/a"}</td>
              <td className="num note">{o.excluido_em ? dataHora(o.excluido_em) : "n/a"}</td>
              <td className="note">{nomes[o.excluido_por] ?? "n/a"}</td>
              <td className="r"><form action={moverOrcamento.bind(null, o.id, "rascunho", "/comercial/excluidos")}><button className="btn sm">Restaurar</button></form></td>
            </tr>))}</tbody>
        </table></div>
        {!lista.length && <div className="vazio"><b>Nenhum orçamento excluído encontrado.</b></div>}
        <Paginacao total={count ?? 0} pag={pg.pag} base="/comercial/excluidos" params={sp} />
      </div>
    </>
  );
}
