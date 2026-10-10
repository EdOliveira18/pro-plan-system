import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import NavFin from "../NavFin";
import { restaurarLancamento } from "../fin-acoes";

export default async function Excluidos({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  let q = ctx.supabase.from("lancamentos").select("id, descricao, entidade, documento, valor, data, competencia, categoria, contrato_id, recorrencia_id, excluido_em, excluido_por").eq("empresa_id", ctx.empresa.id).not("excluido_em", "is", null);
  if (sp.de) q = q.gte("excluido_em", sp.de);
  if (sp.ate) q = q.lte("excluido_em", sp.ate + "T23:59:59");
  const [{ data: rows }, { data: ms }] = await Promise.all([q.order("excluido_em", { ascending: false }).limit(1000), ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", ctx.empresa.id)]);
  const nomes = Object.fromEntries((ms ?? []).map((m: any) => [m.user_id, m.nome]));
  const t = (sp.q ?? "").toLowerCase().trim();
  const L = ((rows ?? []) as any[]).filter((l) => !t || [l.descricao, l.entidade, l.documento, String(Math.abs(l.valor))].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const origem = (l: any) => (l.recorrencia_id ? "Recorrente" : l.categoria === "compra_material" ? "Almoxarifado" : l.contrato_id ? "Contrato" : "Manual");
  return (<>
    <div className="head"><div><h1>Lançamentos excluídos</h1><p className="sub">O que saiu do financeiro, quando e por quem. Restaurar devolve o lançamento como estava.</p></div></div>
    <NavFin atual="/financeiro/excluidos" />
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Entidade, descrição, nº do documento ou valor" style={{ flex: 1 }} aria-label="Buscar" />
        <span className="note" style={{ alignSelf: "center" }}>Data de exclusão</span><input type="date" name="de" defaultValue={sp.de ?? ""} aria-label="De" /><span className="note" style={{ alignSelf: "center" }}>até</span><input type="date" name="ate" defaultValue={sp.ate ?? ""} aria-label="Até" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Lançamento</th><th>Origem</th><th className="r">Valor</th><th>Vencimento</th><th>Competência</th><th>Excluído em</th><th>Excluído por</th><th className="r">Ações</th></tr></thead>
        <tbody>{L.map((l) => (
          <tr key={l.id}><td><b>{l.descricao}</b><div className="note">{l.entidade}</div></td><td>{origem(l)}</td>
            <td className="r num" style={{ color: l.valor < 0 ? "var(--bad)" : "var(--good)" }}>{brl(l.valor)}</td><td className="num note">{data(l.data)}</td>
            <td className="num note">{l.competencia ? l.competencia.slice(0, 7).split("-").reverse().join("/") : "n/a"}</td>
            <td className="num note">{new Date(l.excluido_em).toLocaleString("pt-BR")}</td><td className="note">{nomes[l.excluido_por] ?? "n/a"}</td>
            <td className="r"><form action={restaurarLancamento.bind(null, l.id)}><button className="btn sm">Restaurar</button></form></td></tr>))}</tbody>
      </table></div>
      {!L.length && <div className="vazio"><b>Nenhum lançamento excluído.</b></div>}
    </div>
  </>);
}
