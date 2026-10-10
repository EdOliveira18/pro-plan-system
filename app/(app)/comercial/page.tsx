import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";

async function novoOrcamento(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const sb = ctx.supabase;
  let clienteId = String(fd.get("cliente_id") || "");
  if (!clienteId) {
    const nome = String(fd.get("novo_cliente") || "").trim();
    if (!nome) redirect("/comercial?erro=" + encodeURIComponent("Escolha um cliente ou digite o nome de um novo."));
    const { data: c, error } = await sb.from("clientes").insert({ empresa_id: ctx.empresa.id, nome, created_by: ctx.userId }).select("id").single();
    if (error) redirect("/comercial?erro=" + encodeURIComponent(error.message));
    clienteId = c!.id;
  }
  const parceiroId = String(fd.get("parceiro_id") || "") || null;
  let rt = 0;
  if (parceiroId) {
    const { data: p } = await sb.from("parceiros").select("rt_pct").eq("id", parceiroId).single();
    rt = Number(p?.rt_pct ?? 0);
  }
  const { data: o, error } = await sb.from("orcamentos").insert({
    empresa_id: ctx.empresa.id, cliente_id: clienteId, nome_projeto: String(fd.get("nome_projeto")),
    vendedor_id: ctx.userId, parceiro_id: parceiroId, rt_pct: rt, forma_pagamento: "cartao", parcelas: 10,
  }).select("id").single();
  if (error) redirect("/comercial?erro=" + encodeURIComponent(error.message));
  redirect(`/comercial/${o!.id}`);
}

async function novoParceiro(fd: FormData) {
  "use server";
  const ctx = await contexto();
  await ctx.supabase.from("parceiros").insert({ empresa_id: ctx.empresa.id, nome: String(fd.get("nome")), tipo: String(fd.get("tipo")), rt_pct: Number(fd.get("rt_pct") || 10) });
  revalidatePath("/comercial");
}
async function novaCampanha(fd: FormData) {
  "use server";
  const ctx = await contexto();
  await ctx.supabase.from("campanhas").insert({ empresa_id: ctx.empresa.id, nome: String(fd.get("nome")), canal: String(fd.get("canal")), investimento: Number(fd.get("investimento") || 0) });
  revalidatePath("/comercial");
}
async function salvarConfig(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const campos = ["pontuacao_minima", "frete_pct", "comissao_loja_pct", "montagem_pct", "impostos_pct", "outros_pct", "boleto_pct"];
  const upd: Record<string, number> = {};
  campos.forEach((k) => (upd[k] = Number(String(fd.get(k)).replace(",", "."))));
  const { error } = await ctx.supabase.from("configuracoes").update(upd).eq("empresa_id", ctx.empresa.id);
  if (error) redirect("/comercial?erro=" + encodeURIComponent("Só dono ou gerente pode alterar as premissas."));
  revalidatePath("/comercial");
}

const STATUS: Record<string, [string, string]> = { rascunho: ["Rascunho", "p-neu"], apresentado: ["Apresentado", "p-info"], fechado: ["Contrato gerado", "p-good"], perdido: ["Perdido", "p-bad"] };

export default async function Comercial({ searchParams }: { searchParams: Promise<{ erro?: string; cliente?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: orcs }, { data: clientes }, { data: parceiros }, { data: campanhas }, { data: cfg }] = await Promise.all([
    ctx.supabase.from("orcamentos").select("id, nome_projeto, status, created_at, calculo, cliente:clientes(nome)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(100),
    ctx.supabase.from("clientes").select("id, nome").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("parceiros").select("id, nome, tipo, rt_pct").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("campanhas").select("id, nome, canal, investimento").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("configuracoes").select("*").eq("empresa_id", eid).single(),
  ]);
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  return (
    <>
      <div className="head"><div><h1>Comercial</h1><p className="sub">Orçamentos com olhinho, importação Promob e geração de contrato</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid two">
        <div className="panel">
          <h2>Orçamentos</h2>
          <div className="scroll"><table>
            <thead><tr><th>Projeto</th><th>Cliente</th><th className="r">Proposta</th><th className="r">Margem</th><th>Situação</th><th>Criado</th></tr></thead>
            <tbody>
              {(orcs ?? []).map((o: any) => (
                <tr key={o.id}>
                  <td><Link href={`/comercial/${o.id}`}><b>{o.nome_projeto}</b></Link></td>
                  <td>{o.cliente?.nome}</td>
                  <td className="r num">{o.calculo ? brl(o.calculo.valorProposta) : "n/a"}</td>
                  <td className="r num">{o.calculo ? (o.calculo.margem * 100).toFixed(1).replace(".", ",") + "%" : "n/a"}</td>
                  <td><span className={"pill " + STATUS[o.status][1]}>{STATUS[o.status][0]}</span></td>
                  <td className="num note">{data(o.created_at)}</td>
                </tr>
              ))}
              {!orcs?.length && <tr><td colSpan={6} className="note">Nenhum orçamento ainda.</td></tr>}
            </tbody>
          </table></div>
        </div>
        <div className="panel">
          <h2>Novo orçamento</h2>
          <form action={novoOrcamento} className="grid" style={{ gap: 12 }}>
            <label>Cliente<select name="cliente_id" defaultValue={sp.cliente ?? ""}><option value="">Novo cliente (digite abaixo)</option>{(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
            <label>Nome do novo cliente<input name="novo_cliente" placeholder="Só se não escolheu acima" /></label>
            <label>Nome do projeto<input name="nome_projeto" required placeholder="Ex.: Apartamento Jardins" /></label>
            <label>Parceiro (arquiteto / RT)<select name="parceiro_id" defaultValue=""><option value="">Sem parceiro</option>{(parceiros ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome} ({String(p.rt_pct).replace(".", ",")}%)</option>)}</select></label>
            <button className="btn primary">Criar e abrir</button>
          </form>
        </div>
      </div>

      <details className="panel mt">
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent)" }}>Cadastros comerciais: parceiros, campanhas e premissas do olhinho</summary>
        <div className="grid k3 mt">
          <div>
            <h2>Parceiros</h2>
            {(parceiros ?? []).map((p) => <div key={p.id} className="row"><span>{p.nome} <span className="note">{p.tipo}</span></span><span className="num">{String(p.rt_pct).replace(".", ",")}%</span></div>)}
            <form action={novoParceiro} className="grid mt" style={{ gap: 8 }}>
              <input name="nome" placeholder="Nome do parceiro" required />
              <div style={{ display: "flex", gap: 8 }}>
                <select name="tipo" defaultValue="arquiteto"><option value="arquiteto">Arquiteto</option><option value="indicador">Indicador</option></select>
                <input name="rt_pct" type="number" step="0.5" defaultValue={10} style={{ width: 80 }} aria-label="RT %" />
              </div>
              <button className="btn sm">Adicionar parceiro</button>
            </form>
          </div>
          <div>
            <h2>Campanhas</h2>
            {(campanhas ?? []).map((c) => <div key={c.id} className="row"><span>{c.nome}</span><span className="num">{brl(c.investimento)}</span></div>)}
            <form action={novaCampanha} className="grid mt" style={{ gap: 8 }}>
              <input name="nome" placeholder="Ex.: Meta · Cozinhas outubro" required />
              <div style={{ display: "flex", gap: 8 }}>
                <select name="canal" defaultValue="meta"><option value="meta">Meta Ads</option><option value="google">Google Ads</option><option value="indicacao">Indicação</option><option value="organico">Orgânico</option></select>
                <input name="investimento" type="number" step="0.01" placeholder="Investido R$" aria-label="Investimento" />
              </div>
              <button className="btn sm">Adicionar campanha</button>
            </form>
          </div>
          <div>
            <h2>Premissas do olhinho</h2>
            {cfg && (
              <form action={salvarConfig} className="grid" style={{ gap: 8 }}>
                {[["pontuacao_minima", "Pontuação mínima"], ["frete_pct", "Frete (% fábrica)"], ["comissao_loja_pct", "Comissão loja (% VPL)"], ["montagem_pct", "Montagem (% VPL)"], ["impostos_pct", "Impostos (% VPL)"], ["outros_pct", "Outros (% VPL)"], ["boleto_pct", "Custo boleto (%)"]].map(([k, l]) => (
                  <label key={k} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>{l}<input name={k} type="number" step="0.01" defaultValue={cfg[k]} style={{ width: 90 }} disabled={!gestor} /></label>
                ))}
                {gestor ? <button className="btn sm">Salvar premissas</button> : <span className="note">Somente dono ou gerente altera.</span>}
              </form>
            )}
          </div>
        </div>
      </details>
    </>
  );
}
