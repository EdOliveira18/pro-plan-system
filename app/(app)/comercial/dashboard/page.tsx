import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, pct } from "@/lib/formato";
import { inicioPeriodo, lucratividade } from "@/lib/lucratividade";
import NavOrc from "../NavOrc";

const PERIODOS: [string, string][] = [["1", "1 mês"], ["3", "3 meses"], ["6", "6 meses"], ["12", "12 meses"]];

export default async function DashOrc({ searchParams }: { searchParams: Promise<{ v?: string; p?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const meses = Number(sp.p ?? 3) || 3;
  const desde = inicioPeriodo(meses).toISOString();
  let q = ctx.supabase.from("orcamentos").select("id, status, created_at, faturado_em, perdido_em, calculo, vendedor_id, contratos(id, valor_total)").eq("empresa_id", eid).neq("status", "excluido").gte("created_at", desde);
  if (sp.v) q = q.eq("vendedor_id", sp.v);
  let qk = ctx.supabase.from("contratos").select("id, codigo, valor_total, vpl, custo_previsto, lucro_previsto, created_at, vendedor_id, cliente:clientes(nome)").eq("empresa_id", eid).gte("created_at", desde);
  if (sp.v) qk = qk.eq("vendedor_id", sp.v);
  const [{ data: orcs }, { data: ms }, { data: ks }] = await Promise.all([q, ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", eid).order("nome"), qk]);
  const ids = (ks ?? []).map((k: any) => k.id);
  const [{ data: lancs }, { data: movs }] = ids.length ? await Promise.all([
    ctx.supabase.from("lancamentos").select("contrato_id, valor, realizado, categoria, excluido_em").in("contrato_id", ids),
    ctx.supabase.from("estoque_movimentos").select("contrato_id, tipo, quantidade, custo_unit").in("contrato_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const lucro = lucratividade(ks ?? [], lancs ?? [], movs ?? []);

  const L = (orcs ?? []) as any[];
  const valor = (o: any) => Number(o.contratos?.[0]?.valor_total ?? o.calculo?.valorProposta ?? 0);
  const ganhos = L.filter((o) => o.status === "fechado"), perdidos = L.filter((o) => o.status === "perdido"), pend = L.filter((o) => ["rascunho", "apresentado"].includes(o.status));
  const soma = (a: any[]) => a.reduce((s, o) => s + valor(o), 0);
  const media = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
  const dias = (a: any[], campo: string) => media(a.filter((o) => o[campo]).map((o) => (new Date(o[campo]).getTime() - new Date(o.created_at).getTime()) / 864e5));
  const vplT = lucro.reduce((a, l) => a + l.vpl, 0), lucroT = lucro.reduce((a, l) => a + l.lucro, 0);

  const status: [string, number, string][] = [["Em elaboração", L.filter((o) => o.status === "rascunho").length, "var(--muted)"], ["Apresentados", L.filter((o) => o.status === "apresentado").length, "var(--info)"],
    ["Faturados", ganhos.length, "var(--good)"], ["Perdidos", perdidos.length, "var(--bad)"]];
  const maxS = Math.max(1, ...status.map((s) => s[1]));
  const hist: [string, number][] = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
    const chave = d.toISOString().slice(0, 7);
    hist.push([d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), (ks ?? []).filter((k: any) => k.created_at.slice(0, 7) === chave).reduce((a: number, k: any) => a + Number(k.valor_total), 0)]);
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
        <div className="panel kpi"><div className="l">Total de orçamentos</div><div className="v">{L.length}</div><div className="s">Ganhos {ganhos.length} · Perdidos {perdidos.length} · Pendentes {pend.length}</div></div>
        <div className="panel kpi"><div className="l">Total em valores</div><div className="v">{brl(soma(L))}</div><div className="s">Ganhos {brl(soma(ganhos))}</div></div>
        <div className="panel kpi"><div className="l">Tempo médio até ganhar</div><div className="v">{dias(ganhos, "faturado_em")} dias</div><div className="s">Até perder: {dias(perdidos, "perdido_em")} dias</div></div>
        <div className="panel kpi"><div className="l">Ticket médio</div><div className="v">{brl(ganhos.length ? soma(ganhos) / ganhos.length : 0)}</div>
          <div className="s">Conversão {pct(L.length ? ganhos.length / L.length : 0)} em quantidade · {pct(soma(L) ? soma(ganhos) / soma(L) : 0)} em valor</div></div>
      </div>
      <div className="panel mt" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", borderLeft: "4px solid var(--accent)" }}>
        <div><div className="note">Margem real dos faturados no período</div>
          <div className="num" style={{ fontSize: 22, fontWeight: 600 }}>{vplT > 0 ? pct(lucroT / vplT) : "n/a"}</div>
          <div className="note">{lucro.length ? `${brl(lucroT)} de lucro sobre ${brl(vplT)} de VPL em ${lucro.length} contrato(s)` : "nenhum orçamento faturado no período"}</div></div>
        <Link className="btn primary" href="/lucratividade">Ver lucratividade</Link>
      </div>
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
