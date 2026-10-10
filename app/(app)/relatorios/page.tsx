import { contexto } from "@/lib/contexto";
import { brl, pct } from "@/lib/formato";
import { periodo, nomeMembro } from "@/lib/periodo";
import { ETAPAS_LEAD } from "@/lib/score";
import SeletorMes from "@/components/SeletorMes";

function Barra({ rotulo, valor, max, texto }: { rotulo: string; valor: number; max: number; texto: string }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(110px,1fr) 2fr minmax(110px,auto)", gap: 10, alignItems: "center", padding: "5px 0" }}>
      <span style={{ fontSize: 13 }}>{rotulo}</span>
      <div className="bar" style={{ margin: 0 }}><span style={{ width: `${max ? (valor / max) * 100 : 0}%` }} /></div>
      <span className="num" style={{ textAlign: "right", fontSize: 13 }}>{texto}</span>
    </div>
  );
}

export default async function Relatorios({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const p = periodo(sp.mes);
  const ctx = await contexto();
  const sb = ctx.supabase;
  const eid = ctx.empresa.id;
  const [{ data: contratos }, { data: campanhas }, { data: leads }, { data: membros }] = await Promise.all([
    sb.from("contratos").select("id, orcamento_id, campanha_id, vendedor_id, valor_total, vpl, lucro_previsto").eq("empresa_id", eid).gte("data_venda", p.inicio).lt("data_venda", p.fim),
    sb.from("campanhas").select("id, nome, canal, investimento").eq("empresa_id", eid),
    sb.from("leads").select("etapa, campanha_id").eq("empresa_id", eid).gte("created_at", p.inicio).lt("created_at", p.fim),
    sb.from("membros").select("user_id, nome").eq("empresa_id", eid),
  ]);
  const K = contratos ?? [];
  const orcIds = K.map((k) => k.orcamento_id).filter(Boolean) as string[];
  const { data: ambs } = orcIds.length ? await sb.from("ambientes").select("nome, custo_fabrica, pontuacao").in("orcamento_id", orcIds).eq("versao", 1) : { data: [] as any[] };

  const vendido = K.reduce((s, k) => s + Number(k.valor_total), 0);
  const vpl = K.reduce((s, k) => s + Number(k.vpl), 0);
  const lucro = K.reduce((s, k) => s + Number(k.lucro_previsto), 0);

  const camp = (campanhas ?? []).map((c) => {
    const cs = K.filter((k) => k.campanha_id === c.id);
    const luc = cs.reduce((s, k) => s + Number(k.lucro_previsto), 0);
    const inv = Number(c.investimento);
    return { ...c, leads: (leads ?? []).filter((l) => l.campanha_id === c.id).length, vendas: cs.length, fat: cs.reduce((s, k) => s + Number(k.valor_total), 0), luc, inv, cac: cs.length && inv ? inv / cs.length : 0, roi: inv ? luc / inv : null };
  }).sort((a, b) => b.luc - a.luc);

  // ambientes agrupados pela primeira palavra (Cozinha, Closet, Dormitório...)
  const porAmb = new Map<string, number>();
  (ambs ?? []).forEach((a: any) => { const k = String(a.nome).trim().split(/\s+/)[0] || "Outros"; porAmb.set(k, (porAmb.get(k) ?? 0) + Number(a.custo_fabrica) * Number(a.pontuacao)); });
  const ambOrd = [...porAmb.entries()].sort((a, b) => b[1] - a[1]);

  const porVend = new Map<string, number>();
  K.forEach((k) => porVend.set(k.vendedor_id, (porVend.get(k.vendedor_id) ?? 0) + Number(k.vpl)));
  const vendOrd = [...porVend.entries()].sort((a, b) => b[1] - a[1]);

  const L = leads ?? [];
  const ordem = [...ETAPAS_LEAD.map(([k]) => k), "ganho"];
  const funil = ordem.map((k, i) => ({ k, nome: ETAPAS_LEAD[i]?.[1] ?? "Ganho", n: L.filter((l) => ordem.indexOf(l.etapa) >= i && l.etapa !== "perdido").length }));

  return (
    <>
      <div className="head"><div><h1>Relatórios</h1><p className="sub">Do anúncio ao lucro, por campanha, vendedor e ambiente</p></div><SeletorMes base="/relatorios" mes={p.chave} /></div>
      <div className="grid kpis">
        <div className="panel kpi"><div className="l">Vendido</div><div className="v">{brl(vendido)}</div><div className="s">{K.length} contrato(s)</div></div>
        <div className="panel kpi"><div className="l">Ticket médio</div><div className="v">{K.length ? brl(vendido / K.length) : "n/a"}</div></div>
        <div className="panel kpi"><div className="l">Lucro previsto</div><div className="v">{brl(lucro)}</div></div>
        <div className="panel kpi"><div className="l">Margem sobre VPL</div><div className="v">{vpl ? pct(lucro / vpl) : "n/a"}</div></div>
      </div>

      <div className="panel mt">
        <h2>Lucro por campanha</h2>
        <div className="scroll"><table>
          <thead><tr><th>Campanha</th><th className="r">Investido</th><th className="r">Leads no mês</th><th className="r">Vendas</th><th className="r">CAC</th><th className="r">Faturado</th><th className="r">Lucro previsto</th><th className="r">Retorno</th></tr></thead>
          <tbody>{camp.map((c) => (
            <tr key={c.id}><td>{c.nome}</td><td className="r num">{brl(c.inv)}</td><td className="r num">{c.leads}</td><td className="r num">{c.vendas}</td>
              <td className="r num">{c.cac ? brl(c.cac) : "n/a"}</td><td className="r num">{brl(c.fat)}</td><td className="r num">{brl(c.luc)}</td>
              <td className="r">{c.roi === null ? <span className="pill p-neu">sem mídia paga</span> : <span className={"pill " + (c.roi >= 5 ? "p-good" : "p-warn")}>{c.roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x</span>}</td></tr>))}
          </tbody>
        </table></div>
        <p className="note" style={{ marginBottom: 0 }}>O investimento é o total cadastrado na campanha, em Comercial. O retorno é o lucro previsto das vendas dividido por esse investimento.</p>
      </div>

      <div className="grid two mt">
        <div className="panel">
          <h2>Funil de leads do mês</h2>
          {L.length ? funil.map((f) => <Barra key={f.k} rotulo={f.nome} valor={f.n} max={funil[0].n || 1} texto={`${f.n} · ${funil[0].n ? Math.round((f.n / funil[0].n) * 100) : 0}%`} />)
            : <p className="note">Nenhum lead criado neste mês. Os leads entram pelo CRM.</p>}
          {L.some((l) => l.etapa === "perdido") && <p className="note">{L.filter((l) => l.etapa === "perdido").length} lead(s) perdido(s) no mês.</p>}
        </div>
        <div className="panel">
          <h2>VPL por vendedor</h2>
          {vendOrd.length ? vendOrd.map(([id, v]) => <Barra key={id} rotulo={nomeMembro(membros, id)} valor={v} max={vendOrd[0][1]} texto={brl(v)} />)
            : <p className="note">Nenhuma venda neste mês.</p>}
        </div>
      </div>

      <div className="panel mt">
        <h2>Vendas por tipo de ambiente</h2>
        {ambOrd.length ? ambOrd.map(([k, v]) => <Barra key={k} rotulo={k} valor={v} max={ambOrd[0][1]} texto={brl(v)} />)
          : <p className="note">Nenhum ambiente vendido neste mês.</p>}
        <p className="note" style={{ marginBottom: 0 }}>Valor de tabela de cada ambiente (custo de fábrica vezes pontuação), antes do desconto.</p>
      </div>
    </>
  );
}
