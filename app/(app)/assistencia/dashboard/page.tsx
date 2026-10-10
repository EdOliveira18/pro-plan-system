import { contexto } from "@/lib/contexto";
import { pct } from "@/lib/formato";
import { STATUS_AT, MODALIDADES } from "@/lib/assistencia";
import NavAT from "../NavAT";

function Barras({ itens }: { itens: [string, number][] }) {
  const max = Math.max(1, ...itens.map((i) => i[1]));
  if (!itens.some((i) => i[1])) return <div className="vazio"><p>Nenhuma assistência registrada neste mês</p></div>;
  return <>{itens.filter((i) => i[1]).map(([n, v]) => <div key={n} style={{ margin: "10px 0" }}><div className="row" style={{ padding: 0 }}><span>{n}</span><span className="num">{v}</span></div><div className="bar"><span style={{ width: `${(v / max) * 100}%` }} /></div></div>)}</>;
}

export default async function DashAT({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const mes = sp.mes ?? new Date().toISOString().slice(0, 7);
  const [a, m] = mes.split("-").map(Number);
  const ini = new Date(a, m - 1, 1).toISOString(), fim = new Date(a, m, 1).toISOString(), iniAnt = new Date(a, m - 2, 1).toISOString();
  const ctx = await contexto();
  const { data: rows } = await ctx.supabase.from("chamados").select("status, modalidade, responsavel, aberto_em, contrato_id, contrato:contratos(cliente:clientes(nome))").eq("empresa_id", ctx.empresa.id).gte("aberto_em", iniAnt).lt("aberto_em", fim);
  const todos = (rows ?? []) as any[];
  const L = todos.filter((c) => c.aberto_em >= ini), ant = todos.filter((c) => c.aberto_em < ini);
  const variacao = ant.length ? (L.length - ant.length) / ant.length : 0;
  const porContrato = L.reduce((acc: Record<string, number>, c) => { acc[c.contrato_id] = (acc[c.contrato_id] ?? 0) + 1; return acc; }, {});
  const reinc = L.length ? Object.values(porContrato).filter((n) => n > 1).reduce((s, n) => s + n, 0) / L.length : 0;
  const contar = (f: (c: any) => string) => Object.entries(L.reduce((acc: Record<string, number>, c) => { const k = f(c); acc[k] = (acc[k] ?? 0) + 1; return acc; }, {})).sort((x, y) => y[1] - x[1]).slice(0, 8) as [string, number][];
  return (<>
    <div className="head"><div><h1>Dashboard de Assistências</h1><p className="sub">Visão geral e análise das assistências técnicas</p></div>
      <form style={{ display: "flex", gap: 6 }}><input type="month" name="mes" defaultValue={mes} aria-label="Mês" /><button className="btn">Ver</button></form></div>
    <NavAT atual="/assistencia/dashboard" />
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
      <div className="panel kpi kcard"><span className={"tg " + (variacao > 0 ? "p-bad" : "p-good")}>{variacao >= 0 ? "+" : ""}{pct(variacao)}</span><div className="v">{L.length}</div><div className="l">Total do mês</div></div>
      <div className="panel kpi kcard"><span className="tg p-warn">Aguardando agendamento</span><div className="v">{L.filter((c) => c.status === "aberto").length}</div><div className="l">Aguardando</div></div>
      <div className="panel kpi kcard"><span className="tg p-info">Agendado</span><div className="v">{L.filter((c) => ["agendado", "em_atendimento"].includes(c.status)).length}</div><div className="l">Agendadas</div></div>
      <div className="panel kpi kcard"><span className="tg p-good">{pct(L.length ? L.filter((c) => c.status === "resolvido").length / L.length : 0)}</span><div className="v">{L.filter((c) => c.status === "resolvido").length}</div><div className="l">Concluídas</div></div>
      <div className="panel kpi kcard"><span className={"tg " + (reinc > 0.2 ? "p-bad" : "p-good")}>{reinc > 0.2 ? "Alta" : "Baixa"}</span><div className="v">{pct(reinc)}</div><div className="l">Taxa de reincidência</div></div>
    </div>
    <div className="grid two mt">
      <div className="panel"><h2>Técnicos com mais assistências</h2><Barras itens={contar((c) => c.responsavel ?? "Sem técnico")} /></div>
      <div className="panel"><h2>Distribuição por status</h2><Barras itens={STATUS_AT.map(([k, n]) => [n, L.filter((c) => c.status === k).length])} /></div>
      <div className="panel"><h2>Clientes que mais solicitaram</h2><Barras itens={contar((c) => c.contrato?.cliente?.nome ?? "n/a")} /></div>
      <div className="panel"><h2>Distribuição por modalidade</h2><Barras itens={MODALIDADES.map(([k, n]) => [n, L.filter((c) => c.modalidade === k).length])} /></div>
    </div>
    <p className="note">Reincidência: parte das assistências do mês que são de clientes com mais de um chamado no mesmo mês.</p>
  </>);
}
