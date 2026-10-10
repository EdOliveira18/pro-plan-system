import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, pct } from "@/lib/formato";
import { periodo } from "@/lib/periodo";
import SeletorMes from "@/components/SeletorMes";

async function salvarMetas(mes: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const p = periodo(mes);
  const linhas = [...fd.entries()].filter(([k]) => k.startsWith("meta_")).map(([k, v]) => ({
    empresa_id: ctx.empresa.id, user_id: k.slice(5), mes: p.inicio, meta_vpl: Number(String(v).replace(/\./g, "").replace(",", ".")) || 0,
  }));
  const { error } = await ctx.supabase.from("metas").upsert(linhas, { onConflict: "empresa_id,user_id,mes" });
  const loja = Number(String(fd.get("meta_loja") ?? "").replace(/\./g, "").replace(",", "."));
  if (!error && fd.get("meta_loja") !== null) await ctx.supabase.from("configuracoes").update({ meta_mensal_loja: loja || 0 }).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/ranking");
  redirect(`/ranking?mes=${mes}${error ? "&erro=" + encodeURIComponent("Somente dono ou gerente define metas.") : ""}`);
}

const MEDALHA = ["🥇", "🥈", "🥉"];

export default async function Ranking({ searchParams }: { searchParams: Promise<{ mes?: string; erro?: string }> }) {
  const sp = await searchParams;
  const p = periodo(sp.mes);
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  const [{ data: membros }, { data: contratos }, { data: metas }, { data: cfg }, { data: leads }] = await Promise.all([
    ctx.supabase.from("membros").select("user_id, nome, papel").eq("empresa_id", eid).eq("ativo", true),
    ctx.supabase.from("contratos").select("vendedor_id, valor_total, vpl, lucro_previsto").eq("empresa_id", eid).gte("data_venda", p.inicio).lt("data_venda", p.fim),
    ctx.supabase.from("metas").select("user_id, meta_vpl").eq("empresa_id", eid).eq("mes", p.inicio),
    ctx.supabase.from("configuracoes").select("faixas_comissao, meta_mensal_loja").eq("empresa_id", eid).single(),
    ctx.supabase.from("leads").select("vendedor_id, etapa").eq("empresa_id", eid).gte("created_at", p.inicio).lt("created_at", p.fim),
  ]);
  const faixas = ((cfg?.faixas_comissao ?? []) as { nome: string; a_partir_de: number; pct: number }[]).sort((a, b) => a.a_partir_de - b.a_partir_de);
  const vendedores = (membros ?? []).filter((m) => m.papel !== "montador");
  const linhas = vendedores.map((m) => {
    const cs = (contratos ?? []).filter((c) => c.vendedor_id === m.user_id);
    const vpl = cs.reduce((s, c) => s + Number(c.vpl), 0);
    const meta = Number(metas?.find((x) => x.user_id === m.user_id)?.meta_vpl ?? 0);
    const ls = (leads ?? []).filter((l) => l.vendedor_id === m.user_id);
    return {
      ...m, n: cs.length, vendido: cs.reduce((s, c) => s + Number(c.valor_total), 0), vpl, lucro: cs.reduce((s, c) => s + Number(c.lucro_previsto), 0),
      meta, faixa: faixas.filter((f) => vpl >= f.a_partir_de).pop()?.nome ?? "n/a", leads: ls.length, ganhos: ls.filter((l) => l.etapa === "ganho").length,
    };
  }).sort((a, b) => b.vpl - a.vpl);
  const totVpl = linhas.reduce((s, l) => s + l.vpl, 0);
  const metaLoja = Number(cfg?.meta_mensal_loja ?? 0);

  return (
    <>
      <div className="head"><div><h1>Ranking / Metas</h1><p className="sub">Ranking pelo VPL, que é o que a venda deixa de verdade na loja</p></div><SeletorMes base="/ranking" mes={p.chave} /></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid k3">
        <div className="panel kpi"><div className="l">VPL vendido pela loja</div><div className="v">{brl(totVpl)}</div>
          {metaLoja > 0 && <><div className="bar"><span style={{ width: `${Math.min(100, (totVpl / metaLoja) * 100)}%`, background: "var(--gold)" }} /></div><div className="s">{pct(totVpl / metaLoja)} da meta de {brl(metaLoja)}</div></>}
          {!metaLoja && <div className="s">Defina a meta da loja abaixo</div>}
        </div>
        <div className="panel kpi"><div className="l">Contratos no mês</div><div className="v">{(contratos ?? []).length}</div></div>
        <div className="panel kpi"><div className="l">Lucro previsto no mês</div><div className="v">{brl((contratos ?? []).reduce((s, c) => s + Number(c.lucro_previsto), 0))}</div></div>
      </div>
      <form action={salvarMetas.bind(null, p.chave)} className="panel mt">
        <div className="scroll"><table>
          <thead><tr><th>#</th><th>Vendedor</th><th className="r">Leads</th><th className="r">Contratos</th><th className="r">Vendido</th><th className="r">VPL</th><th style={{ minWidth: 170 }}>Meta de VPL</th><th>Faixa</th></tr></thead>
          <tbody>{linhas.map((l, i) => (
            <tr key={l.user_id}>
              <td className="num"><b>{l.vpl > 0 && i < 3 ? MEDALHA[i] : `${i + 1}º`}</b></td>
              <td><b>{l.nome}</b><div className="note">{l.papel}</div></td>
              <td className="r num">{l.leads}{l.ganhos ? <span className="note"> ({l.ganhos} ganhos)</span> : null}</td>
              <td className="r num">{l.n}</td><td className="r num">{brl(l.vendido)}</td><td className="r num"><b>{brl(l.vpl)}</b></td>
              <td>{gestor ? <input name={`meta_${l.user_id}`} inputMode="decimal" defaultValue={l.meta ? String(l.meta) : ""} placeholder="R$ 0" style={{ width: 120 }} aria-label={`Meta de ${l.nome}`} /> : <span className="num">{brl(l.meta)}</span>}
                {l.meta > 0 && <><div className="bar" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (l.vpl / l.meta) * 100)}%`, background: l.vpl >= l.meta ? "var(--good)" : "var(--gold)" }} /></div><span className="note">{pct(l.vpl / l.meta)}</span></>}</td>
              <td><span className={"pill " + (l.faixa === "Ouro" ? "p-warn" : l.faixa === "Prata" ? "p-info" : "p-neu")}>{l.faixa}</span></td>
            </tr>))}</tbody>
        </table></div>
        {gestor && (
          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 12 }}>
            <label>Meta de VPL da loja no mês<input name="meta_loja" inputMode="decimal" defaultValue={metaLoja ? String(metaLoja) : ""} placeholder="R$ 0" /></label>
            <button className="btn primary">Salvar metas de {p.nome}</button>
          </div>
        )}
      </form>
    </>
  );
}
