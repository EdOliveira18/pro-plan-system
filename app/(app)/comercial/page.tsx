import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import Confirmar from "@/components/Confirmar";
import NavOrc from "./NavOrc";
import { moverOrcamento } from "./acoes-status";
import { MOTIVOS_PERDA } from "@/lib/motivos";

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
    vendedor_id: String(fd.get("vendedor_id") || "") || ctx.userId, parceiro_id: parceiroId, rt_pct: rt, forma_pagamento: "cartao", parcelas: 10,
    data_entrega: String(fd.get("data_entrega") || "") || null,
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

const STATUS: Record<string, [string, string]> = { rascunho: ["Em elaboração", "p-neu"], apresentado: ["Apresentado", "p-info"] };

export default async function Comercial({ searchParams }: { searchParams: Promise<{ erro?: string; cliente?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: todos }, { data: clientes }, { data: parceiros }, { data: campanhas }, { data: cfg }] = await Promise.all([
    ctx.supabase.from("orcamentos").select("id, numero, nome_projeto, status, created_at, data_entrega, calculo, vendedor_id, cliente:clientes(nome)").eq("empresa_id", eid).in("status", ["rascunho", "apresentado"]).order("numero", { ascending: false }).limit(1000),
    ctx.supabase.from("clientes").select("id, nome").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("parceiros").select("id, nome, tipo, rt_pct").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("campanhas").select("id, nome, canal, investimento").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("configuracoes").select("*").eq("empresa_id", eid).single(),
  ]);
  const { data: membros } = await ctx.supabase.from("membros").select("user_id, nome, papel").eq("empresa_id", eid).eq("ativo", true).order("nome");
  const nomeVend = Object.fromEntries((membros ?? []).map((m: any) => [m.user_id, m.nome]));
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  const valor = (o: any) => Number(o.calculo?.valorProposta ?? 0);
  const pend = ((todos ?? []) as any[]).filter((o) => ["rascunho", "apresentado"].includes(o.status));
  const totalPend = pend.reduce((a, o) => a + valor(o), 0);
  const comValor = pend.filter((o) => valor(o) > 0);
  const termo = (sp.q ?? "").toLowerCase().trim();
  const orcs = ((todos ?? []) as any[]).filter((o) =>
    !termo || [o.nome_projeto, o.cliente?.nome, String(o.numero)].some((x) => String(x ?? "").toLowerCase().includes(termo)));
  return (
    <>
      <div className="head"><div><h1>Lista de Orçamentos</h1><p className="sub">Orçamentos com olhinho, importação Promob e geração de contrato</p></div>
        <a className="btn primary" href="#novo">Cadastrar</a></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid k3" style={{ marginBottom: 16 }}>
        <div className="panel kpi kcard"><span className="tg p-warn">Pendentes</span><div className="v">{pend.length}</div><div className="l">Orçamentos pendentes</div></div>
        <div className="panel kpi kcard"><span className="tg p-warn">Em aberto</span><div className="v">{brl(totalPend)}</div><div className="l">Valor total pendente</div></div>
        <div className="panel kpi kcard"><span className="tg p-info">Média</span><div className="v">{brl(comValor.length ? totalPend / comValor.length : 0)}</div><div className="l">Ticket médio dos pendentes</div></div>
      </div>
      <NavOrc atual="/comercial" />
      <div className="grid two">
        <div className="panel" style={{ padding: 0 }}>
          <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar orçamento, cliente ou número" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
          <div className="scroll"><table className="cad-tab">
            <thead><tr><th>Nº</th><th>Cliente / projeto</th><th>Vendedor</th><th>Data início</th><th>Entrega</th><th className="r">Valor total</th><th>Status</th><th className="r">Ações</th></tr></thead>
            <tbody>
              {orcs.map((o: any) => (
                <tr key={o.id}>
                  <td className="num"><Link href={`/comercial/${o.id}`}><b>{o.numero}</b></Link></td>
                  <td><b>{o.cliente?.nome}</b><div className="note">{o.nome_projeto}</div></td>
                  <td className="note">{nomeVend[o.vendedor_id] ?? "n/a"}</td>
                  <td className="num note">{data(o.created_at)}</td>
                  <td className="num note">{o.data_entrega ? data(o.data_entrega) : "n/a"}</td>
                  <td className="r num">{o.calculo ? brl(valor(o)) : "n/a"}</td>
                  <td><span className={"pill " + STATUS[o.status][1]}>{STATUS[o.status][0]}</span></td>
                  <td className="r" style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn sm" href={`/comercial/${o.id}`}>Abrir</Link>{" "}
                    <details className="cad-imp" style={{ display: "inline-block" }}>
                      <summary className="btn sm">Perdido</summary>
                      <form action={moverOrcamento.bind(null, o.id, "perdido", "/comercial")} className="panel" style={{ display: "grid", gap: 8, textAlign: "left" }}>
                        <label>Motivo da perda<select name="motivo" required defaultValue="">{[["", "Selecione"], ...MOTIVOS_PERDA.map((m) => [m, m])].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                        <label>Detalhe (opcional)<input name="detalhe" placeholder="Ex.: fechou com a loja X por 10% menos" /></label>
                        <button className="btn primary sm">Marcar como perdido</button>
                      </form>
                    </details>{" "}
                    <form action={moverOrcamento.bind(null, o.id, "excluido", "/comercial")} style={{ display: "inline" }}><Confirmar className="btn sm" texto="Mover este orçamento para Excluídos?">Excluir</Confirmar></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          {!orcs.length && <div className="vazio"><b>Nenhum orçamento encontrado.</b></div>}
          <div className="cad-rod note">Mostrando {orcs.length} registro(s)</div>
        </div>
        <div className="panel" id="novo">
          <h2>Novo orçamento</h2>
          <form action={novoOrcamento} className="grid" style={{ gap: 12 }}>
            <p className="cad-aviso" style={{ margin: 0 }}>Campos com <i className="obr">*</i> são obrigatórios.</p>
            <label>Cliente<i className="obr">*</i><select name="cliente_id" defaultValue={sp.cliente ?? ""}><option value="">Novo cliente (digite abaixo)</option>{(clientes ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select>
              <Link href="/cadastros/clientes/novo" className="note">+ Novo cliente com cadastro completo</Link></label>
            <label>Nome do novo cliente<input name="novo_cliente" placeholder="Só se não escolheu acima" /></label>
            <label>Nome do projeto<input name="nome_projeto" required placeholder="Ex.: Apartamento Jardins" /></label>
            <label>Vendedor<i className="obr">*</i><select name="vendedor_id" required defaultValue={ctx.userId}>{(membros ?? []).map((m: any) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}</select></label>
            <label>Arquiteto / parceiro (RT)<select name="parceiro_id" defaultValue=""><option value="">Sem parceiro</option>{(parceiros ?? []).map((p) => <option key={p.id} value={p.id}>{p.nome} ({String(p.rt_pct).replace(".", ",")}%)</option>)}</select>
              <Link href="/cadastros/arquitetos/novo" className="note">+ Novo arquiteto</Link></label>
            <label>Previsão de entrega<input type="date" name="data_entrega" /></label>
            <button className="btn primary">Criar e abrir</button>
          </form>
          <p className="note">Arquitetos completos (CAU, dados bancários, Pix) ficam em <Link href="/cadastros/arquitetos">Cadastros › Arquitetos</Link>.</p>
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
            <h2>Origens de clientes</h2>
            {(campanhas ?? []).map((c) => <div key={c.id} className="row"><span>{c.nome}</span><span className="num">{brl(c.investimento)}</span></div>)}
            <form action={novaCampanha} className="grid mt" style={{ gap: 8 }}>
              <input name="nome" placeholder="Ex.: Tráfego pago" required />
              <div style={{ display: "flex", gap: 8 }}>
                <select name="canal" defaultValue="meta"><option value="meta">Meta Ads</option><option value="google">Google Ads</option><option value="indicacao">Indicação</option><option value="organico">Orgânico</option></select>
                <input name="investimento" type="number" step="0.01" placeholder="Investido R$" aria-label="Investimento" />
              </div>
              <button className="btn sm">Adicionar origem</button>
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
