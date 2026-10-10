import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import Paginacao, { pagina } from "@/components/Paginacao";
import { idsContratos, limparTermo } from "@/lib/busca";

async function incluirContratos() {
  "use server";
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: ks }, { data: ents }, { data: st }] = await Promise.all([
    ctx.supabase.from("contratos").select("id, marcos(tipo, previsto_em)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(1000),
    ctx.supabase.from("entregas").select("contrato_id").eq("empresa_id", eid),
    ctx.supabase.from("status_entrega").select("id").eq("empresa_id", eid).order("ordem").limit(1),
  ]);
  const tem = new Set((ents ?? []).map((e: any) => e.contrato_id));
  const novos = ((ks ?? []) as any[]).filter((k) => !tem.has(k.id)).map((k) => ({
    empresa_id: eid, contrato_id: k.id, status_id: st?.[0]?.id ?? null,
    data_entrega: (k.marcos ?? []).find((m: any) => m.tipo === "material")?.previsto_em ?? null,
    data_montagem: (k.marcos ?? []).find((m: any) => m.tipo === "montagem")?.previsto_em ?? null,
  }));
  if (novos.length) await ctx.supabase.from("entregas").insert(novos);
  revalidatePath("/entregas");
  redirect("/entregas?msg=" + encodeURIComponent(novos.length ? `${novos.length} contrato(s) incluído(s) com as datas do Radar de Prazos.` : "Todos os contratos já estão na lista."));
}

async function atualizar(id: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "") || null;
  await ctx.supabase.from("entregas").update({ status_id: s("status_id"), data_entrega: s("data_entrega"), data_montagem: s("data_montagem"), transportadora_id: s("transportadora_id"), observacoes: s("observacoes") }).eq("id", id).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/entregas");
}

export default async function Entregas({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; msg?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const pg = pagina(sp.pag);
  let q = ctx.supabase.from("entregas").select("*, status:status_entrega(id, nome, cor, final), contrato:contratos(id, codigo, orcamento:orcamentos(numero), cliente:clientes(nome))", { count: "exact" }).eq("empresa_id", eid);
  if (sp.s && /^[0-9a-f-]{36}$/i.test(sp.s)) q = q.eq("status_id", sp.s);
  const t = limparTermo(sp.q);
  if (t) { const ks = await idsContratos(ctx.supabase, eid, t); q = ks.length ? q.in("contrato_id", ks) : q.is("id", null); }
  const [{ data: rows, count }, { data: res }, { data: sts }, { data: transp }] = await Promise.all([
    q.order("data_entrega", { ascending: true, nullsFirst: false }).order("id").range(pg.de, pg.ate),
    ctx.supabase.rpc("resumo_entregas", { p_empresa: eid }),
    ctx.supabase.from("status_entrega").select("id, nome, cor, final, ordem").eq("empresa_id", eid).order("ordem"),
    ctx.supabase.from("pessoas").select("id, nome, nome_fantasia").eq("empresa_id", eid).eq("categoria", "transportadora").order("nome"),
  ]);
  const lista = (rows ?? []) as any[];
  const R = (res ?? {}) as any;
  const total = Number(R.total ?? 0), entregues = Number(R.entregues ?? 0);
  return (<>
    <div className="head"><div><h1>Lista de Entregas</h1><p className="sub">Acompanhe cada contrato da fábrica até a casa do cliente</p></div>
      <div style={{ display: "flex", gap: 8 }}><Link className="btn" href="/cadastros/status-entrega">Status</Link><form action={incluirContratos}><button className="btn primary">Incluir contratos</button></form></div></div>
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <div className="grid kpis" style={{ marginBottom: 16 }}>
      <div className="panel kpi kcard"><span className="tg p-info">Total</span><div className="v">{total}</div><div className="l">Total</div></div>
      <div className="panel kpi kcard"><span className="tg p-good">Entregues</span><div className="v">{entregues}</div><div className="l">Entregues</div></div>
      <div className="panel kpi kcard"><span className="tg p-warn">Pendentes</span><div className="v">{total - entregues}</div><div className="l">Pendentes</div></div>
      {ctx.papel !== "montador" && <div className="panel kpi kcard"><span className="tg p-info">Faturado</span><div className="v">{brl(Number(R.valor ?? 0))}</div><div className="l">Valor total</div></div>}
    </div>
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por nome do cliente ou nº do contrato" style={{ flex: 1 }} aria-label="Buscar" />
        <select name="s" defaultValue={sp.s ?? ""} aria-label="Status"><option value="">Todos os status</option>{(sts ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Cliente</th><th>Data entrega</th><th>Data montagem</th><th>Nº contrato</th><th>Status</th><th className="r">Ações</th></tr></thead>
        <tbody>{lista.map((e) => (
          <tr key={e.id}>
            <td><b>{e.contrato?.cliente?.nome}</b>{e.observacoes && <div className="note">{e.observacoes}</div>}</td>
            <td className="num note">{e.data_entrega ? data(e.data_entrega) : "a definir"}</td>
            <td className="num note">{e.data_montagem ? data(e.data_montagem) : "a definir"}</td>
            <td><Link className="idc" href={`/contratos/${e.contrato?.id}`}>#{e.contrato?.codigo}</Link>{e.contrato?.orcamento?.numero && <div className="note">orç. {e.contrato.orcamento.numero}</div>}</td>
            <td>{e.status ? <span className="pill" style={{ background: e.status.cor, color: "#fff" }}>{e.status.nome}</span> : "n/a"}</td>
            <td className="r"><details className="cad-imp" style={{ display: "inline-block" }}><summary className="btn sm">Atualizar</summary>
              <form action={atualizar.bind(null, e.id)} className="panel" style={{ display: "grid", gap: 8, textAlign: "left" }}>
                <label>Status<select name="status_id" defaultValue={e.status_id ?? ""}>{(sts ?? []).map((s: any) => <option key={s.id} value={s.id}>{s.ordem}. {s.nome}</option>)}</select></label>
                <label>Data entrega<input type="date" name="data_entrega" defaultValue={e.data_entrega ?? ""} /></label>
                <label>Data montagem<input type="date" name="data_montagem" defaultValue={e.data_montagem ?? ""} /></label>
                <label>Transportadora<select name="transportadora_id" defaultValue={e.transportadora_id ?? ""}><option value="">Própria</option>{(transp ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.nome_fantasia || x.nome}</option>)}</select></label>
                <label>Observações<input name="observacoes" defaultValue={e.observacoes ?? ""} /></label>
                <button className="btn primary sm">Salvar</button>
              </form></details></td>
          </tr>))}</tbody>
      </table></div>
      {!lista.length && <div className="vazio"><b>Nenhuma entrega encontrada.</b><p>Clique em Incluir contratos para trazer os contratos vendidos com as datas do Radar de Prazos.</p></div>}
      <Paginacao total={count ?? 0} pag={pg.pag} base="/entregas" params={sp} />
    </div>
  </>);
}
