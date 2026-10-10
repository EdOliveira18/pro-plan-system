import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import NavOrc from "../NavOrc";
import { moverOrcamento } from "../acoes-status";

export default async function Perdidos({ searchParams }: { searchParams: Promise<{ q?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: rows } = await ctx.supabase.from("orcamentos").select("id, numero, nome_projeto, created_at, perdido_em, motivo_perda, calculo, cliente:clientes(nome)")
    .eq("empresa_id", ctx.empresa.id).eq("status", "perdido").order("perdido_em", { ascending: false }).limit(1000);
  const t = (sp.q ?? "").toLowerCase().trim();
  const lista = ((rows ?? []) as any[]).filter((o) => !t || [o.cliente?.nome, o.nome_projeto, String(o.numero), o.motivo_perda].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const valor = (o: any) => Number(o.calculo?.valorProposta ?? 0);
  const total = lista.reduce((a, o) => a + valor(o), 0);
  const dias = lista.filter((o) => o.perdido_em).map((o) => (new Date(o.perdido_em).getTime() - new Date(o.created_at).getTime()) / 864e5);
  const motivos = Object.entries(lista.reduce((m: Record<string, number>, o) => { const k = (o.motivo_perda ?? "Sem motivo").split(":")[0]; m[k] = (m[k] ?? 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
  return (
    <>
      <div className="head"><div><h1>Orçamentos Perdidos</h1><p className="sub">Todos os orçamentos que foram perdidos e o motivo</p></div></div>
      <NavOrc atual="/comercial/perdidos" />
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="panel kpi kcard"><span className="tg p-neu">Perdidos</span><div className="v">{lista.length}</div><div className="l">Orçamentos perdidos</div></div>
        <div className="panel kpi kcard"><span className="tg p-neu">Valor perdido</span><div className="v">{brl(total)}</div><div className="l">Valor total perdido</div></div>
        <div className="panel kpi kcard"><span className="tg p-info">Média</span><div className="v">{brl(lista.length ? total / lista.length : 0)}</div><div className="l">Ticket médio</div></div>
        <div className="panel kpi kcard"><span className="tg p-warn">Tempo</span><div className="v">{dias.length ? Math.round(dias.reduce((a, b) => a + b, 0) / dias.length) : 0} dias</div><div className="l">Tempo médio até a perda</div></div>
      </div>
      {!!motivos.length && <div className="panel" style={{ marginBottom: 16 }}><h2>Por que estamos perdendo</h2>
        {motivos.map(([m, n]) => <div key={m} className="row"><span>{m}</span><span className="num">{n} ({Math.round((n / lista.length) * 100)}%)</span></div>)}</div>}
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
        <div className="cad-rod note">Mostrando {lista.length} registro(s)</div>
      </div>
    </>
  );
}
