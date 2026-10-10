import Link from "next/link";
import { contexto } from "@/lib/contexto";
import NavProd from "../NavProd";
import { carregarOPs } from "../dados";

const SEM = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default async function Calendario({ searchParams }: { searchParams: Promise<{ desde?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const ops = await carregarOPs(ctx);
  const ini = sp.desde ? new Date(sp.desde + "T12:00:00") : (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })();
  const diasL = Array.from({ length: 35 }, (_, i) => { const d = new Date(ini); d.setDate(d.getDate() + i); return d; });
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const hoje = iso(new Date());
  const desloca = (n: number) => { const d = new Date(ini); d.setDate(d.getDate() + n); return iso(d); };
  const cont = { aguardando: ops.filter((o) => o.status === "aguardando").length, em: ops.filter((o) => o.status === "em_producao").length,
    atr: ops.filter((o) => o.atrasada && !["finalizada", "cancelada"].includes(o.status)).length, pausa: ops.filter((o) => o.status === "pausada").length, fin: ops.filter((o) => o.status === "finalizada").length };
  const visiveis = ops.filter((o) => o.status !== "cancelada" && (o.previsao_inicio || o.previsao_fim) && (o.previsao_fim ?? o.previsao_inicio) >= iso(diasL[0]) && (o.previsao_inicio ?? o.previsao_fim) <= iso(diasL[34]));
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Calendário</nav><h1>Calendário de Produção</h1><p className="sub">Cronograma das ordens de produção pela previsão inicial e final</p></div></div>
    <NavProd atual="/producao/calendario" />
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", marginBottom: 16 }}>
      <div className="panel kpi kcard"><span className="tg p-neu">Aguardando</span><div className="v">{cont.aguardando}</div><div className="l">Aguardando início</div></div>
      <div className="panel kpi kcard"><span className="tg p-info">Ativo</span><div className="v">{cont.em}</div><div className="l">Em produção</div></div>
      <div className="panel kpi kcard"><span className="tg p-bad">Atrasado</span><div className="v">{cont.atr}</div><div className="l">Atrasado</div></div>
      <div className="panel kpi kcard"><span className="tg p-warn">Pausado</span><div className="v">{cont.pausa}</div><div className="l">Pausado</div></div>
      <div className="panel kpi kcard"><span className="tg p-good">Finalizado</span><div className="v">{cont.fin}</div><div className="l">Finalizado</div></div>
    </div>
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
        <h2 style={{ margin: 0 }}>Calendário das ordens de produção</h2>
        <div style={{ display: "flex", gap: 6 }}><Link className="btn sm" href={`/producao/calendario?desde=${desloca(-28)}`}>← 4 semanas</Link><Link className="btn sm" href="/producao/calendario">Hoje</Link><Link className="btn sm" href={`/producao/calendario?desde=${desloca(28)}`}>4 semanas →</Link></div>
      </div>
      <div className="gantt"><table>
        <thead><tr><th>OP / cliente</th>{diasL.map((d) => <th key={iso(d)} className={iso(d) === hoje ? "hoje" : undefined}>{String(d.getDate()).padStart(2, "0")}/{String(d.getMonth() + 1).padStart(2, "0")}<br />{SEM[d.getDay()]}</th>)}</tr></thead>
        <tbody>{visiveis.map((o) => {
          const a = o.previsao_inicio ?? o.previsao_fim, b = o.previsao_fim ?? o.previsao_inicio;
          return (<tr key={o.id}><td className="nome"><Link href={`/producao?op=${o.id}`}><b>OP {o.numero}</b></Link> {o.contrato?.cliente?.nome ?? ""}</td>
            {diasL.map((d) => { const x = iso(d); const on = x >= a && x <= b; return <td key={x} className={[on ? "on" : "", on && o.atrasada ? "atr" : "", x === hoje ? "hoje" : ""].join(" ")} title={on ? `OP ${o.numero}` : undefined} />; })}</tr>);
        })}</tbody>
      </table></div>
      {!visiveis.length && <div className="vazio"><b>Nenhuma OP com previsão neste período.</b><p>Defina previsão inicial e final ao criar a OP para ela aparecer aqui.</p></div>}
    </div>
  </>);
}
