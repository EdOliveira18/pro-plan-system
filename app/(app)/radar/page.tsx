import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { data, diasAte, MARCOS, ETAPAS_WF } from "@/lib/formato";
import { concluirMarco, avancarWorkflow } from "../contratos/[id]/actions";

export default async function Radar({ searchParams }: { searchParams: Promise<{ aba?: string; filtro?: string }> }) {
  const sp = await searchParams;
  const aba = sp.aba ?? "prazos";
  const filtro = sp.filtro ?? "todos";
  const ctx = await contexto();
  const { data: contratos } = await ctx.supabase
    .from("contratos")
    .select("id, codigo, marco_atual, etapa_workflow, vendedor_id, cliente:clientes(nome), marcos(tipo, previsto_em, sla_dias, concluido_em)")
    .eq("empresa_id", ctx.empresa.id).eq("encerrado", false).order("created_at");

  const linhas = (contratos ?? []).map((c: any) => {
    const m = c.marcos.find((x: any) => x.tipo === c.marco_atual);
    const d = m ? diasAte(m.previsto_em) : 0;
    return { ...c, marco: m, dias: d, st: d < 0 ? "bad" : d === 0 ? "hoje" : d <= 5 ? "warn" : "ok" };
  }).sort((a, b) => a.dias - b.dias);
  const cont = { bad: linhas.filter((l) => l.st === "bad").length, warn: linhas.filter((l) => l.st === "warn").length, hoje: linhas.filter((l) => l.st === "hoje").length };
  const vis = linhas.filter((l) => filtro === "todos" || (filtro === "atrasados" && l.st === "bad") || (filtro === "atencao" && (l.st === "warn" || l.st === "hoje")) || l.marco_atual === filtro);
  const chip = (v: string, n: string) => (
    <Link key={v} href={`/radar?filtro=${v}`} className="btn sm" style={filtro === v ? { background: "var(--accent)", color: "var(--accent-fg)", borderColor: "var(--accent)" } : {}}>{n}</Link>
  );

  return (
    <>
      <div className="head"><div><h1>Radar de Prazos</h1><p className="sub">6 marcos com SLA contados a partir da venda, e o workflow da fábrica</p></div></div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16 }}>
        {[["prazos", "Prazos e SLA"], ["workflow", "Workflow industrial"]].map(([a, n]) => (
          <Link key={a} href={`/radar?aba=${a}`} style={{ padding: "9px 14px", fontWeight: 600, textDecoration: "none", color: aba === a ? "var(--fg)" : "var(--muted)", borderBottom: "2px solid " + (aba === a ? "var(--gold)" : "transparent") }}>{n}</Link>
        ))}
      </div>

      {aba === "prazos" ? (<>
        <div className="grid kpis">
          <div className="panel kpi" style={{ borderLeft: "4px solid var(--bad)" }}><div className="l">Atrasados</div><div className="v" style={{ color: "var(--bad)" }}>{cont.bad}</div></div>
          <div className="panel kpi" style={{ borderLeft: "4px solid var(--warn)" }}><div className="l">Vencem em até 5 dias</div><div className="v" style={{ color: "var(--warn)" }}>{cont.warn}</div></div>
          <div className="panel kpi" style={{ borderLeft: "4px solid var(--accent)" }}><div className="l">Vencem hoje</div><div className="v">{cont.hoje}</div></div>
          <div className="panel kpi"><div className="l">Contratos em andamento</div><div className="v">{linhas.length}</div></div>
        </div>
        <div className="panel mt">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {chip("todos", "Todos")}{chip("atrasados", "Atrasados")}{chip("atencao", "Atenção")}{Object.entries(MARCOS).map(([k, n]) => chip(k, n))}
          </div>
          <div className="scroll"><table>
            <thead><tr><th>Vencimento</th><th>Contrato</th><th>Marco atual</th><th>Situação</th><th></th></tr></thead>
            <tbody>
              {vis.map((l) => (
                <tr key={l.id}>
                  <td className="num">{l.marco ? data(l.marco.previsto_em) : "n/a"}</td>
                  <td><Link className="idc" href={`/contratos/${l.id}`}>#{l.codigo}</Link> <b>{l.cliente?.nome}</b></td>
                  <td>{MARCOS[l.marco_atual]}<div className="note">SLA {l.marco?.sla_dias} dias</div></td>
                  <td>{l.st === "bad" ? <span className="pill p-bad">{-l.dias} d de atraso</span> : l.st === "hoje" ? <span className="pill p-warn">Vence hoje</span> : <span className={"pill " + (l.st === "warn" ? "p-warn" : "p-good")}>{l.dias} d restantes</span>}</td>
                  <td><form action={concluirMarco.bind(null, l.id)}><button className="btn sm">Concluir marco</button></form></td>
                </tr>
              ))}
              {!vis.length && <tr><td colSpan={5} className="note">Nenhum contrato nesse filtro.</td></tr>}
            </tbody>
          </table></div>
        </div>
      </>) : (
        <div className="kanban">
          {ETAPAS_WF.map(([k, nome], i) => {
            const cs = linhas.filter((l) => l.etapa_workflow === k);
            return (
              <div key={k} className="col">
                <div className="col-h"><span>{nome}</span><span>{cs.length}</span></div>
                {cs.map((c) => (
                  <div key={c.id} className="card">
                    <Link className="idc" href={`/contratos/${c.id}`}>#{c.codigo}</Link>
                    <span>{c.cliente?.nome}</span>
                    {i < 6 && <form action={avancarWorkflow.bind(null, c.id)}><button className="btn sm">Avançar</button></form>}
                  </div>
                ))}
                {!cs.length && <span className="note">Vazio</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
