import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, pct } from "@/lib/formato";
import { inicioPeriodo } from "@/lib/lucratividade";
import { hojeISO } from "@/lib/tempo";
import NavOrc from "../NavOrc";

const PERIODOS: [string, string][] = [["1", "1 mês"], ["3", "3 meses"], ["6", "6 meses"], ["12", "12 meses"]];

export default async function DashOrc({ searchParams }: { searchParams: Promise<{ v?: string; p?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const meses = Number(sp.p ?? 3) || 3;
  const desde = inicioPeriodo(meses).toISOString();
  const vend = sp.v && /^[0-9a-f-]{36}$/i.test(sp.v) ? sp.v : null;
  // tudo somado no banco: não depende de quantos orçamentos a loja tem
  const [{ data: d }, { data: fat }, { data: ms }, { data: lr }] = await Promise.all([
    ctx.supabase.rpc("dashboard_orcamentos", { p_empresa: eid, p_desde: desde, p_vendedor: vend }),
    ctx.supabase.rpc("faturado_por_mes", { p_empresa: eid, p_desde: desde, p_vendedor: vend }),
    ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", eid).order("nome"),
    ctx.financeiro ? ctx.supabase.rpc("lucro_resumo", { p_empresa: eid, p_de: desde, p_ate: new Date(Date.now() + 864e5).toISOString(), p_minima: 0 }) : Promise.resolve({ data: null }),
  ]);
  const D = (d ?? {}) as any;
  const n = (k: string) => Number(D[k] ?? 0);
  const total = n("total"), ganhos = n("ganhos"), perdidos = n("perdidos"), pend = n("pendentes");
  const valorTotal = n("valor_total"), valorGanhos = n("valor_ganhos");
  const LR = (lr ?? null) as any;
  const vplT = Number(LR?.vpl ?? 0), lucroT = vplT - Number(LR?.custo ?? 0), qtdLucro = Number(LR?.qtd ?? 0);

  const status: [string, number, string][] = [["Em elaboração", n("rascunho"), "var(--muted)"], ["Apresentados", n("apresentado"), "var(--info)"],
    ["Faturados", ganhos, "var(--good)"], ["Perdidos", perdidos, "var(--bad)"]];
  const maxS = Math.max(1, ...status.map((s) => s[1]));
  const F = (fat ?? {}) as Record<string, number>;
  const hist: [string, number][] = [];
  const [ay, am] = hojeISO().split("-").map(Number);
  for (let i = meses - 1; i >= 0; i--) {
    const dt = new Date(Date.UTC(ay, am - 1 - i, 1));
    const chave = dt.toISOString().slice(0, 7);
    hist.push([dt.toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }), Number(F[chave] ?? 0)]);
  }
  const maxH = Math.max(1, ...hist.map((h) => h[1]));
  return (
    <>
      <div className="head"><div><h1>Dashboard de Orçamentos</h1><p className="sub">Métricas e indicadores de orçamentos</p></div></div>
      <NavOrc atual="/comercial/dashboard" />
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select name="v" defaultValue={sp.v ?? ""} aria-label="Vendedor"><option value="">Todos os vendedores</option>{(ms ?? []).map((m: any) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}</select>
        <select name="p" defaultValue={String(meses)} aria-label="Período">{PERIODOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <button className="btn">Aplicar</button>
      </form>
      <div className="grid kpis">
        <div className="panel kpi"><div className="l">Total de orçamentos</div><div className="v">{total}</div><div className="s">Ganhos {ganhos} · Perdidos {perdidos} · Pendentes {pend}</div></div>
        <div className="panel kpi"><div className="l">Total em valores</div><div className="v">{brl(valorTotal)}</div><div className="s">Ganhos {brl(valorGanhos)}</div></div>
        <div className="panel kpi"><div className="l">Tempo médio até ganhar</div><div className="v">{n("dias_ganho")} dias</div><div className="s">Até perder: {n("dias_perda")} dias</div></div>
        <div className="panel kpi"><div className="l">Ticket médio</div><div className="v">{brl(ganhos ? valorGanhos / ganhos : 0)}</div>
          <div className="s">Conversão {pct(total ? ganhos / total : 0)} em quantidade · {pct(valorTotal ? valorGanhos / valorTotal : 0)} em valor</div></div>
      </div>
      {ctx.financeiro && <div className="panel mt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: "4px solid var(--accent)" }}>
        <div><div className="note">Margem real dos faturados no período</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{vplT > 0 ? pct(lucroT / vplT) : "n/a"}</div>
          <div className="note">{qtdLucro ? `${brl(lucroT)} de lucro sobre ${brl(vplT)} de VPL em ${qtdLucro} contrato(s)${vend ? " (loja toda)" : ""}` : "nenhum orçamento faturado no período"}</div></div>
        <Link className="btn primary" href="/lucratividade">Ver lucratividade</Link>
      </div>}
      <div className="grid two mt">
        <div className="panel"><h2>Status dos orçamentos</h2>
          {status.map(([n, v, c]) => <div key={n} style={{ margin: "10px 0" }}><div className="row" style={{ padding: 0 }}><span>{n}</span><span className="num">{v}</span></div>
            <div className="bar"><span style={{ width: `${(v / maxS) * 100}%`, background: c }} /></div></div>)}</div>
        <div className="panel"><h2>Histórico de valores faturados</h2>
          <div className="colunas">{hist.map(([m, v]) => <div key={m} className="col" title={brl(v)}><span className="cv num">{v ? brl(v).replace("R$", "").trim() : ""}</span><div style={{ height: `${(v / maxH) * 100}%` }} /><span className="cm">{m}</span></div>)}</div></div>
      </div>
    </>
  );
}
