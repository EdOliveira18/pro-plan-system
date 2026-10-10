import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl } from "@/lib/formato";
import { ETAPAS_LEAD, pontuarLead } from "@/lib/score";

const voltar = (sel?: string, erro?: string) => {
  revalidatePath("/crm");
  redirect(`/crm?${sel ? "lead=" + sel : ""}${erro ? "&erro=" + encodeURIComponent(erro) : ""}`);
};

async function novoLead(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { data, error } = await ctx.supabase.from("leads").insert({
    empresa_id: ctx.empresa.id, nome: String(fd.get("nome")).trim(), telefone: String(fd.get("telefone") || "") || null,
    ambientes: String(fd.get("ambientes") || "") || null, valor_estimado: Number(fd.get("valor") || 0) || null,
    campanha_id: String(fd.get("campanha_id") || "") || null, vendedor_id: ctx.userId, ultimo_contato: new Date().toISOString(),
  }).select("id").single();
  voltar(data?.id, error?.message);
}

async function moverLead(id: string, etapa: string) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("leads").update({ etapa, ultimo_contato: new Date().toISOString() }).eq("id", id);
  voltar(id, error?.message);
}

async function registrarContato(id: string) {
  "use server";
  const ctx = await contexto();
  await ctx.supabase.from("leads").update({ ultimo_contato: new Date().toISOString() }).eq("id", id);
  voltar(id);
}

// cria (ou reaproveita) o cliente e abre um orçamento ligado ao lead
async function gerarOrcamento(id: string) {
  "use server";
  const ctx = await contexto();
  const sb = ctx.supabase;
  const { data: l } = await sb.from("leads").select("*").eq("id", id).single();
  if (!l) return voltar(undefined, "Lead não encontrado.");
  let clienteId = l.cliente_id as string | null;
  if (!clienteId) {
    const { data: c, error } = await sb.from("clientes").insert({ empresa_id: ctx.empresa.id, nome: l.nome, telefone: l.telefone, campanha_id: l.campanha_id, created_by: ctx.userId }).select("id").single();
    if (error) return voltar(id, error.message);
    clienteId = c.id;
    await sb.from("leads").update({ cliente_id: clienteId }).eq("id", id);
  }
  const { data: o, error } = await sb.from("orcamentos").insert({
    empresa_id: ctx.empresa.id, cliente_id: clienteId, lead_id: id, nome_projeto: l.ambientes || `Projeto ${l.nome}`,
    vendedor_id: l.vendedor_id ?? ctx.userId, forma_pagamento: "cartao", parcelas: 10,
  }).select("id").single();
  if (error) return voltar(id, error.message);
  if (["novo", "qualificado", "briefing"].includes(l.etapa)) await sb.from("leads").update({ etapa: "projeto" }).eq("id", id);
  redirect(`/comercial/${o.id}`);
}

const cls = (s: number) => (s >= 70 ? "p-good" : s >= 45 ? "p-warn" : "p-bad");

export default async function CRM({ searchParams }: { searchParams: Promise<{ lead?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: leads }, { data: campanhas }, { data: membros }] = await Promise.all([
    ctx.supabase.from("leads").select("*, campanha:campanhas(nome, canal), orcamentos(id, status)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(500),
    ctx.supabase.from("campanhas").select("id, nome").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", eid),
  ]);
  const L = (leads ?? []).map((l: any) => ({ ...l, ...pontuarLead({ ...l, canal: l.campanha?.canal }) }));
  const ativos = L.filter((l) => !["ganho", "perdido"].includes(l.etapa));
  const sel = L.find((l) => l.id === sp.lead);
  const ganhos = L.filter((l) => l.etapa === "ganho").length, perdidos = L.filter((l) => l.etapa === "perdido").length;
  const pipeline = ativos.reduce((s, l) => s + Number(l.valor_estimado || 0), 0);
  const nomeVend = (id: string) => membros?.find((m) => m.user_id === id)?.nome ?? "";

  return (
    <>
      <div className="head"><div><h1>CRM Pro</h1><p className="sub">Funil consultivo de planejados com score de fechamento e próximo passo</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="panel kpi"><div className="l">Leads em andamento</div><div className="v">{ativos.length}</div></div>
        <div className="panel kpi"><div className="l">Valor no funil</div><div className="v">{brl(pipeline)}</div></div>
        <div className="panel kpi"><div className="l">Ganhos</div><div className="v" style={{ color: "var(--good)" }}>{ganhos}</div></div>
        <div className="panel kpi"><div className="l">Conversão</div><div className="v">{ganhos + perdidos ? Math.round((ganhos / (ganhos + perdidos)) * 100) + "%" : "n/a"}</div><div className="s">ganhos sobre encerrados</div></div>
      </div>

      <div className="grid two" style={{ marginBottom: 16 }}>
        {sel ? (
          <div className="panel">
            <h2>{sel.nome} <span className={"pill " + cls(sel.score)}>{sel.score}/100</span></h2>
            <div className="row"><span className="note">Etapa</span><span>{ETAPAS_LEAD.find(([k]) => k === sel.etapa)?.[1] ?? sel.etapa}</span></div>
            <div className="row"><span className="note">Ambientes</span><span>{sel.ambientes ?? "n/a"}</span></div>
            <div className="row"><span className="note">Valor estimado</span><span className="num">{sel.valor_estimado ? brl(sel.valor_estimado) : "n/a"}</span></div>
            <div className="row"><span className="note">Origem</span><span>{sel.campanha?.nome ?? "n/a"}</span></div>
            <div className="row"><span className="note">Telefone</span><span>{sel.telefone ?? "n/a"}</span></div>
            <div className="row"><span className="note">Vendedor</span><span>{nomeVend(sel.vendedor_id)}</span></div>
            <div className="row"><span className="note">Sem contato há</span><span className="num">{sel.parado} dia(s)</span></div>
            <div style={{ background: "var(--info-soft)", borderRadius: 10, padding: "10px 12px", margin: "10px 0", fontSize: 13 }}>
              <b style={{ color: "var(--info)" }}>Próximo passo</b><p style={{ margin: "4px 0 0" }}>{sel.passo}</p>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <form action={registrarContato.bind(null, sel.id)}><button className="btn sm">Registrar contato hoje</button></form>
              {sel.orcamentos?.length ? <Link className="btn sm primary" href={`/comercial/${sel.orcamentos[0].id}`}>Abrir orçamento</Link>
                : <form action={gerarOrcamento.bind(null, sel.id)}><button className="btn sm primary">Criar orçamento</button></form>}
              <form action={moverLead.bind(null, sel.id, "perdido")}><button className="btn sm">Marcar perdido</button></form>
            </div>
          </div>
        ) : <div className="panel"><h2>Selecione um lead</h2><p className="note">Clique em um card do funil para ver o score, o próximo passo e criar o orçamento.</p></div>}
        <div className="panel">
          <h2>Novo lead</h2>
          <form action={novoLead} className="form">
            <label>Nome<input name="nome" required /></label>
            <label>Telefone / WhatsApp<input name="telefone" /></label>
            <label>Ambientes<input name="ambientes" placeholder="Ex.: Cozinha e lavanderia" /></label>
            <label>Valor estimado (R$)<input name="valor" type="number" min="0" step="100" /></label>
            <label style={{ gridColumn: "1 / -1" }}>Origem<select name="campanha_id" defaultValue=""><option value="">Não informada</option>{(campanhas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <div><button className="btn primary">Adicionar ao funil</button></div>
          </form>
        </div>
      </div>

      <div className="kanban">
        {ETAPAS_LEAD.map(([k, nome], i) => {
          const cs = ativos.filter((l) => l.etapa === k);
          return (
            <div key={k} className="col">
              <div className="col-h"><span>{nome}</span><span>{cs.length}</span></div>
              {cs.map((l) => (
                <div key={l.id} className="card" style={l.id === sp.lead ? { borderColor: "var(--gold)" } : undefined}>
                  <Link href={`/crm?lead=${l.id}`} style={{ textDecoration: "none", color: "var(--fg)", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <b>{l.nome}</b><span className={"pill " + cls(l.score)}>{l.score}</span>
                  </Link>
                  <span className="note">{l.ambientes ?? "Ambientes não informados"}{l.valor_estimado ? ` · ${brl(l.valor_estimado)}` : ""}</span>
                  {l.parado >= 7 && <span className="pill p-bad" style={{ alignSelf: "flex-start" }}>{l.parado} d sem contato</span>}
                  <div style={{ display: "flex", gap: 4 }}>
                    {i > 0 && <form action={moverLead.bind(null, l.id, ETAPAS_LEAD[i - 1][0])}><button className="btn sm" aria-label="Voltar etapa">‹</button></form>}
                    {i < ETAPAS_LEAD.length - 1
                      ? <form action={moverLead.bind(null, l.id, ETAPAS_LEAD[i + 1][0])}><button className="btn sm">Avançar ›</button></form>
                      : <form action={moverLead.bind(null, l.id, "ganho")}><button className="btn sm primary">Ganho</button></form>}
                  </div>
                </div>
              ))}
              {!cs.length && <span className="note">Vazio</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
