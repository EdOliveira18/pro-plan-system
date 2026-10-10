import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import { ST_AT, STATUS_AT, MOD, MODALIDADES } from "@/lib/assistencia";
import NavAT from "./NavAT";
import Paginacao, { pagina } from "@/components/Paginacao";
import { idsContratos, juntarOr, limparTermo } from "@/lib/busca";

export default async function Assistencias({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; m?: string; msg?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  let q = ctx.supabase.from("chamados").select("id, numero, status, modalidade, agendado_para, hora_visita, aberto_em, descricao, responsavel, contrato:contratos(id, codigo, cliente:clientes(nome))", { count: "exact" })
    .eq("empresa_id", ctx.empresa.id);
  const pg = pagina(sp.pag);
  const t = limparTermo(sp.q);
  if (t) {
    const ks = await idsContratos(ctx.supabase, ctx.empresa.id, t);
    q = q.or(juntarOr([/^\d{1,9}$/.test(t) && `numero.eq.${t}`, ks.length && `contrato_id.in.(${ks.join(",")})`, `descricao.ilike.%${t}%`]));
  }
  if (sp.s) q = q.eq("status", sp.s);
  if (sp.m) q = q.eq("modalidade", sp.m);
  const { data: rows, count } = await q.order("numero", { ascending: false }).range(pg.de, pg.ate);
  const lista = (rows ?? []) as any[];
  return (<>
    <div className="head"><div><h1>Assistências Técnicas</h1><p className="sub">Gerencie todas as assistências técnicas, sempre ligadas ao contrato do cliente</p></div><Link className="btn primary" href="/assistencia/nova">Cadastrar</Link></div>
    <NavAT atual="/assistencia" />
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nome do cliente ou código" style={{ flex: 1 }} aria-label="Buscar" />
        <select name="s" defaultValue={sp.s ?? ""} aria-label="Status"><option value="">Todos os status</option>{STATUS_AT.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <select name="m" defaultValue={sp.m ?? ""} aria-label="Modalidade"><option value="">Todas as modalidades</option>{MODALIDADES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Código</th><th>Cliente</th><th>Data da visita</th><th>Hora</th><th>Modalidade</th><th>Status</th><th className="r">Ações</th></tr></thead>
        <tbody>{lista.map((c) => (
          <tr key={c.id}>
            <td className="num"><Link href={`/assistencia/${c.id}`}><b>{c.numero}</b></Link></td>
            <td><b>{c.contrato?.cliente?.nome}</b> {c.contrato && <Link className="idc" href={`/contratos/${c.contrato.id}`}>#{c.contrato.codigo}</Link>}<div className="note">{String(c.descricao).slice(0, 90)}</div></td>
            <td className="num note">{c.agendado_para ? data(c.agendado_para) : "a agendar"}</td>
            <td className="num note">{c.hora_visita?.slice(0, 5) ?? "n/a"}</td>
            <td>{MOD[c.modalidade] ?? c.modalidade}</td>
            <td><span className={"pill " + (ST_AT[c.status]?.[1] ?? "p-neu")}>{ST_AT[c.status]?.[0] ?? c.status}</span>{c.responsavel && <div className="note">{c.responsavel}</div>}</td>
            <td className="r"><Link className="btn sm" href={`/assistencia/${c.id}`}>Editar</Link></td>
          </tr>))}</tbody>
      </table></div>
      {!lista.length && <div className="vazio"><b>Nenhuma assistência técnica encontrada.</b></div>}
      <Paginacao total={count ?? 0} pag={pg.pag} base="/assistencia" params={sp} />
    </div>
  </>);
}
