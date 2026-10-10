import { contexto } from "@/lib/contexto";
import { inicioPeriodo } from "@/lib/lucratividade";
import { ETAPAS_OP, NOME_ETAPA, dias } from "@/lib/producao";
import NavProd from "../NavProd";
import { carregarOPs } from "../dados";

export default async function DashProd({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const sp = await searchParams;
  const meses = Number(sp.p ?? 1) || 1;
  const desde = inicioPeriodo(meses).toISOString();
  const ctx = await contexto();
  const todas = (await carregarOPs(ctx)).filter((o) => o.created_at >= desde || !["finalizada", "cancelada"].includes(o.status));
  const { data: etapas } = await ctx.supabase.from("op_etapas").select("etapa, entrou_em, saiu_em").eq("empresa_id", ctx.empresa.id).gte("entrou_em", desde).not("saiu_em", "is", null);
  const grupos: [string, string, string, any[]][] = [
    ["Finalizadas", "p-good", "Total finalizadas", todas.filter((o) => o.status === "finalizada")],
    ["Em produção", "p-info", "Total em produção", todas.filter((o) => o.status === "em_producao")],
    ["Agendadas", "p-neu", "Total agendadas", todas.filter((o) => o.status === "aguardando")],
    ["Pausadas", "p-warn", "Total pausadas", todas.filter((o) => o.status === "pausada")],
  ];
  const media = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
  const fin = grupos[0][3];
  const tFin = media(fin.map((o) => dias(o.iniciada_em ?? o.created_at, o.finalizada_em) ?? 0));
  const tAtr = media(fin.filter((o) => o.atrasada).map((o) => dias(o.previsao_fim, o.finalizada_em) ?? 0));
  const porEtapa = ETAPAS_OP.map(([k]) => { const xs = (etapas ?? []).filter((e: any) => e.etapa === k).map((e: any) => (new Date(e.saiu_em).getTime() - new Date(e.entrou_em).getTime()) / 36e5); return [k, xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0, xs.length] as [string, number, number]; });
  const maxE = Math.max(1, ...porEtapa.map((e) => e[1]));
  const func: Record<string, { n: number; t: number[] }> = {};
  fin.forEach((o) => { const k = o.responsavel?.nome ?? "Sem responsável"; func[k] ??= { n: 0, t: [] }; func[k].n++; func[k].t.push(dias(o.iniciada_em ?? o.created_at, o.finalizada_em) ?? 0); });
  const h = (x: number) => (x >= 24 ? `${(x / 24).toFixed(1).replace(".", ",")} dias` : `${x.toFixed(1).replace(".", ",")} h`);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Dashboard</nav><h1>Dashboard de Produção</h1><p className="sub">Métricas e indicadores de produção</p></div></div>
    <NavProd atual="/producao/dashboard" />
    <form style={{ display: "flex", gap: 8, marginBottom: 14 }}><select name="p" defaultValue={String(meses)} aria-label="Período">{[["1", "1 mês"], ["3", "3 meses"], ["6", "6 meses"], ["12", "12 meses"]].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select><button className="btn">Aplicar</button></form>
    <div className="grid kpis">{grupos.map(([n, c, l, xs]) => (
      <div key={n} className="panel kpi kcard"><span className={"tg " + c}>{n}</span><div className="v">{xs.length}</div><div className="l">{l}</div>
        <div style={{ borderTop: "1px solid var(--line)", marginTop: 10, paddingTop: 8 }} className="note">Dentro da previsão: <b>{xs.filter((o) => !o.atrasada).length}</b><br />Em atraso: <b style={{ color: "var(--bad)" }}>{xs.filter((o) => o.atrasada).length}</b></div></div>))}</div>
    <div className="grid two mt">
      <div>
        <div className="panel"><h2>Tempo médio de produção</h2><div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div><div className="note">Finalizadas (do início ao fim)</div><div className="num" style={{ fontSize: 24, color: "var(--info)" }}>{tFin} dias</div></div>
          <div><div className="note">Atraso médio das atrasadas</div><div className="num" style={{ fontSize: 24 }}>{tAtr} dias</div></div></div></div>
        <div className="panel mt"><h2>Produção por funcionário</h2><div className="scroll"><table>
          <thead><tr><th>Funcionário</th><th className="r">Qtd de produções</th><th className="r">Tempo médio</th><th className="r">Tempo total</th></tr></thead>
          <tbody>{Object.entries(func).map(([n, v]) => <tr key={n}><td>{n}</td><td className="r num">{v.n}</td><td className="r num">{media(v.t)} dias</td><td className="r num">{v.t.reduce((a, b) => a + b, 0)} dias</td></tr>)}
            {!Object.keys(func).length && <tr><td colSpan={4} className="note">Nenhuma produção finalizada no período.</td></tr>}</tbody></table></div></div>
      </div>
      <div className="panel"><h2>Tempo médio por etapa da produção</h2>
        {porEtapa.map(([k, v, n]) => <div key={k} style={{ margin: "10px 0" }}><div className="row" style={{ padding: 0 }}><span>{NOME_ETAPA[k]}</span><span className="num note">{n ? h(v) : "sem dados"}</span></div>
          <div className="bar"><span style={{ width: `${(v / maxE) * 100}%` }} /></div></div>)}
        <p className="note">Medido pelo tempo que cada OP ficou em cada coluna do kanban.</p></div>
    </div>
  </>);
}
