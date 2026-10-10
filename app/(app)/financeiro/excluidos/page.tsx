import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import NavFin from "../NavFin";
import { restaurarLancamento } from "../fin-acoes";
import { dataHora } from "@/lib/tempo";
import Paginacao, { pagina } from "@/components/Paginacao";
import { limparTermo, inicioDia, fimDia } from "@/lib/busca";

export default async function Excluidos({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  let q = ctx.supabase.from("lancamentos").select("id, descricao, entidade, documento, valor, data, competencia, categoria, contrato_id, recorrencia_id, excluido_em, excluido_por", { count: "exact" }).eq("empresa_id", ctx.empresa.id).not("excluido_em", "is", null);
  const pg = pagina(sp.pag);
  const okd = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
  if (okd(sp.de)) q = q.gte("excluido_em", inicioDia(sp.de!));
  if (okd(sp.ate)) q = q.lte("excluido_em", fimDia(sp.ate!));
  const t = limparTermo(sp.q);
  if (t) q = q.or(`descricao.ilike.%${t}%,entidade.ilike.%${t}%,documento.ilike.%${t}%`);
  const [{ data: rows, count }, { data: ms }] = await Promise.all([q.order("excluido_em", { ascending: false }).order("id").range(pg.de, pg.ate), ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", ctx.empresa.id)]);
  const nomes = Object.fromEntries((ms ?? []).map((m: any) => [m.user_id, m.nome]));
  const L = (rows ?? []) as any[];
  const origem = (l: any) => (l.recorrencia_id ? "Recorrente" : l.categoria === "compra_material" ? "Almoxarifado" : l.contrato_id ? "Contrato" : "Manual");
  return (<>
    <div className="head"><div><h1>Lançamentos excluídos</h1><p className="sub">O que saiu do financeiro, quando e por quem. Restaurar devolve o lançamento como estava.</p></div></div>
    <NavFin atual="/financeiro/excluidos" />
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Entidade, descrição ou nº do documento" style={{ flex: 1 }} aria-label="Buscar" />
        <span className="note" style={{ alignSelf: "center" }}>Data de exclusão</span><input type="date" name="de" defaultValue={sp.de ?? ""} aria-label="De" /><span className="note" style={{ alignSelf: "center" }}>até</span><input type="date" name="ate" defaultValue={sp.ate ?? ""} aria-label="Até" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Lançamento</th><th>Origem</th><th className="r">Valor</th><th>Vencimento</th><th>Competência</th><th>Excluído em</th><th>Excluído por</th><th className="r">Ações</th></tr></thead>
        <tbody>{L.map((l) => (
          <tr key={l.id}><td><b>{l.descricao}</b><div className="note">{l.entidade}</div></td><td>{origem(l)}</td>
            <td className="r num" style={{ color: l.valor < 0 ? "var(--bad)" : "var(--good)" }}>{brl(l.valor)}</td><td className="num note">{data(l.data)}</td>
            <td className="num note">{l.competencia ? l.competencia.slice(0, 7).split("-").reverse().join("/") : "n/a"}</td>
            <td className="num note">{dataHora(l.excluido_em)}</td><td className="note">{nomes[l.excluido_por] ?? "n/a"}</td>
            <td className="r"><form action={restaurarLancamento.bind(null, l.id)}><button className="btn sm">Restaurar</button></form></td></tr>))}</tbody>
      </table></div>
      {!L.length && <div className="vazio"><b>Nenhum lançamento excluído.</b></div>}
      <Paginacao total={count ?? 0} pag={pg.pag} base="/financeiro/excluidos" params={sp} />
    </div>
  </>);
}
