import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import NavOrc from "../NavOrc";
import Paginacao, { pagina } from "@/components/Paginacao";
import { filtroOrcamentos, limparTermo } from "@/lib/busca";
import { moverOrcamento } from "../acoes-status";

export default async function Perdidos({ searchParams }: { searchParams: Promise<{ q?: string; erro?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const pg = pagina(sp.pag);
  let q = ctx.supabase.from("orcamentos").select("id, numero, nome_projeto, created_at, perdido_em, motivo_perda, calculo, cliente:clientes(nome)", { count: "exact" })
    .eq("empresa_id", ctx.empresa.id).eq("status", "perdido");
  const filtro = await filtroOrcamentos(ctx.supabase, ctx.empresa.id, sp.q ?? "", ["motivo_perda"]);
  if (filtro) q = q.or(filtro);
  const termo = limparTermo(sp.q);
  const [{ data: rows, count }, { data: res }, { data: geral }] = await Promise.all([
    q.order("perdido_em", { ascending: false }).order("id").range(pg.de, pg.ate),
    ctx.supabase.rpc("resumo_orcamentos_f", { p_empresa: ctx.empresa.id, p_status: ["perdido"], p_termo: termo || null }),
    ctx.supabase.rpc("resumo_perdidos", { p_empresa: ctx.empresa.id }),
  ]);
  const lista = (rows ?? []) as any[];
  const valor = (o: any) => Number(o.calculo?.valorProposta ?? 0);
  const R = (res ?? {}) as any, G = (geral ?? {}) as any;
  const qtd = Number(R.qtd ?? 0), total = Number(R.valor ?? 0), diasMedio = Number(R.dias_perda ?? 0);
  const motivos = ((G.motivos ?? []) as { motivo: string; qtd: number }[]).map((m) => [m.motivo, Number(m.qtd)] as [string, number]);
  const totalMotivos = motivos.reduce((a, [, n]) => a + n, 0);
  return (
    <>
      <div className="head"><div><h1>Orçamentos Perdidos</h1><p className="sub">Todos os orçamentos que foram perdidos e o motivo</p></div></div>
      <NavOrc atual="/comercial/perdidos" />
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="panel kpi kcard"><span className="tg p-neu">Perdidos</span><div className="v">{qtd}</div><div className="l">Orçamentos perdidos</div></div>
        <div className="panel kpi kcard"><span className="tg p-neu">Valor perdido</span><div className="v">{brl(total)}</div><div className="l">Valor total perdido</div></div>
        <div className="panel kpi kcard"><span className="tg p-info">Média</span><div className="v">{brl(qtd ? total / qtd : 0)}</div><div className="l">Ticket médio</div></div>
        <div className="panel kpi kcard"><span className="tg p-warn">Tempo</span><div className="v">{diasMedio} dias</div><div className="l">Tempo médio até a perda</div></div>
      </div>
      {!!motivos.length && <div className="panel" style={{ marginBottom: 16 }}><h2>Por que estamos perdendo</h2>
        {motivos.map(([m, n]) => <div key={m} className="row"><span>{m}</span><span className="num">{n} ({Math.round((n / totalMotivos) * 100)}%)</span></div>)}</div>}
      <div className="panel" style={{ padding: 0 }}>
        <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar cliente, número ou motivo" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Nº</th><th>Cliente</th><th>Motivo</th><th>Data cadastro</th><th>Data perda</th><th className="r">Valor total</th><th className="r">Ações</th></tr></thead>
          <tbody>{lista.map((o) => (
            <tr key={o.id}>
              <td className="num"><Link href={`/comercial/${o.id}`}><b>{o.numero}</b></Link></td>
              <td><b>{o.cliente?.nome}</b><div className="note">{o.nome_projeto}</div></td>
              <td>{o.motivo_perda ?? <span className="note">não informado</span>}</td>
              <td className="num note">{data(o.created_at)}</td>
              <td className="num note">{o.perdido_em ? data(o.perdido_em) : "n/a"}</td>
              <td className="r num">{brl(valor(o))}</td>
              <td className="r"><form action={moverOrcamento.bind(null, o.id, "rascunho", "/comercial/perdidos")}><button className="btn sm">Reabrir</button></form></td>
            </tr>))}</tbody>
        </table></div>
        {!lista.length && <div className="vazio"><b>Nenhum orçamento perdido.</b></div>}
        <Paginacao total={count ?? 0} pag={pg.pag} base="/comercial/perdidos" params={sp} />
      </div>
    </>
  );
}
