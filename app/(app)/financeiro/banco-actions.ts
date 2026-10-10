"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { lerOFX } from "@/lib/banco/ofx";
import { conciliarEmpresa, pluggy, sincronizarConexao } from "@/lib/banco/processar";
import { headers } from "next/headers";

const ir = (q: string) => {
  revalidatePath("/financeiro");
  redirect(`/financeiro?aba=banco&${q}`);
};
const msg = (m: string) => ir("msg=" + encodeURIComponent(m));
const erro = (m: string) => ir("erro=" + encodeURIComponent(m));

async function conciliarPendentes(): Promise<number> {
  const ctx = await contexto();
  return conciliarEmpresa(ctx.supabase, ctx.empresa.id);
}

export async function importarOFX(fd: FormData) {
  const ctx = await contexto();
  const sb = ctx.supabase;
  const arq = fd.get("arquivo");
  if (!(arq instanceof File) || !arq.size) return erro("Escolha o arquivo OFX exportado do internet banking.");
  // OFX costuma vir em Latin-1; se o UTF-8 der caractere inválido, relê
  const bytes = new Uint8Array(await arq.arrayBuffer());
  let texto = new TextDecoder("utf-8").decode(bytes);
  if (texto.includes("�")) texto = new TextDecoder("latin1").decode(bytes);
  const ext = lerOFX(texto);
  if (!ext.transacoes.length) return erro("Não encontrei movimentações nesse arquivo. Confira se exportou no formato OFX (Money).");

  const banco = ext.banco ?? "banco", conta = ext.conta ?? "conta";
  let { data: c } = await sb.from("contas_bancarias").select("id").eq("empresa_id", ctx.empresa.id).eq("banco", banco).eq("conta", conta).maybeSingle();
  if (!c) {
    const nome = String(fd.get("nome") || "").trim() || `Banco ${banco} · conta ${conta}`;
    const ins = await sb.from("contas_bancarias").insert({ empresa_id: ctx.empresa.id, nome, banco, agencia: ext.agencia ?? null, conta, origem: "ofx" }).select("id").single();
    if (ins.error) return erro("Não foi possível cadastrar a conta. Montador não tem acesso ao financeiro.");
    c = ins.data;
  }
  if (ext.saldo !== undefined) await sb.from("contas_bancarias").update({ saldo: ext.saldo, saldo_em: ext.saldoEm ?? new Date().toISOString() }).eq("id", c!.id);

  const linhas = ext.transacoes.map((t) => ({ empresa_id: ctx.empresa.id, conta_id: c!.id, fitid: t.fitid, data: t.data, valor: t.valor, descricao: t.descricao }));
  const { data: novas, error } = await sb.from("extrato").upsert(linhas, { onConflict: "conta_id,fitid", ignoreDuplicates: true }).select("id");
  if (error) return erro(error.message);
  const conciliadas = await conciliarPendentes();
  const repetidas = linhas.length - (novas?.length ?? 0);
  msg(`${novas?.length ?? 0} movimentações importadas${repetidas ? ` (${repetidas} já estavam no sistema)` : ""}. ${conciliadas} conciliadas automaticamente com os lançamentos.`);
}

export async function vincular(extratoId: string, lancId: string) {
  const ctx = await contexto();
  const { data: m } = await ctx.supabase.from("extrato").select("data, conta_id").eq("id", extratoId).single();
  if (!m) return erro("Movimentação não encontrada.");
  await ctx.supabase.from("lancamentos").update({ realizado: true, data: m.data, conta_id: m.conta_id }).eq("id", lancId);
  await ctx.supabase.from("extrato").update({ status: "conciliado", lancamento_id: lancId }).eq("id", extratoId);
  msg("Movimentação conciliada.");
}

export async function criarDaMovimentacao(extratoId: string, fd: FormData) {
  const ctx = await contexto();
  const { data: m } = await ctx.supabase.from("extrato").select("*").eq("id", extratoId).single();
  if (!m) return erro("Movimentação não encontrada.");
  const { data: l, error } = await ctx.supabase.from("lancamentos").insert({
    empresa_id: ctx.empresa.id, contrato_id: String(fd.get("contrato_id") || "") || null, conta_id: m.conta_id,
    data: m.data, descricao: String(fd.get("descricao") || m.descricao || "Movimentação bancária").trim(),
    categoria: String(fd.get("categoria")), valor: m.valor, realizado: true,
  }).select("id").single();
  if (error) return erro(error.message);
  await ctx.supabase.from("extrato").update({ status: "conciliado", lancamento_id: l.id }).eq("id", extratoId);
  msg("Lançamento criado a partir do extrato.");
}

export async function ignorar(extratoId: string) {
  const ctx = await contexto();
  await ctx.supabase.from("extrato").update({ status: "ignorado" }).eq("id", extratoId);
  msg("Movimentação ignorada.");
}

export async function desfazer(extratoId: string) {
  const ctx = await contexto();
  const { data: m } = await ctx.supabase.from("extrato").select("lancamento_id").eq("id", extratoId).single();
  if (m?.lancamento_id) await ctx.supabase.from("lancamentos").update({ realizado: false }).eq("id", m.lancamento_id);
  await ctx.supabase.from("extrato").update({ status: "pendente", lancamento_id: null }).eq("id", extratoId);
  msg("Conciliação desfeita. A movimentação voltou para a fila.");
}

export async function reconciliar() {
  const n = await conciliarPendentes();
  msg(`${n} movimentações conciliadas automaticamente.`);
}

// ===== Open Finance (Pluggy) =====
export async function tokenConexao(itemId?: string): Promise<{ ok: true; token: string } | { ok: false; erro: string }> {
  const ctx = await contexto();
  if (!["dono", "gerente", "financeiro"].includes(ctx.papel)) return { ok: false, erro: "Somente dono, gerente ou financeiro conecta contas bancárias." };
  try {
    const h = await headers();
    const origem = h.get("origin") ?? `https://${h.get("host")}`;
    const segredo = process.env.PLUGGY_WEBHOOK_SECRET;
    const { accessToken } = await pluggy().createConnectToken(itemId, {
      clientUserId: ctx.empresa.id,
      avoidDuplicates: true,
      ...(segredo && origem.startsWith("https://") ? { webhookUrl: `${origem}/api/pluggy/webhook?s=${segredo}` } : {}),
    });
    return { ok: true, token: accessToken };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

export async function registrarConexao(itemId: string): Promise<{ ok: boolean; erro?: string; resumo?: string }> {
  const ctx = await contexto();
  const { data: cx, error } = await ctx.supabase.from("conexoes_bancarias")
    .upsert({ empresa_id: ctx.empresa.id, item_id: itemId, provedor: "pluggy", criado_por: ctx.userId }, { onConflict: "item_id" })
    .select("id, empresa_id, item_id").single();
  if (error || !cx) return { ok: false, erro: error?.message ?? "Não foi possível salvar a conexão." };
  try {
    const r = await sincronizarConexao(ctx.supabase, cx);
    revalidatePath("/financeiro");
    return { ok: true, resumo: `${r.novas} movimentações trazidas do banco, ${r.conciliadas} conciliadas.` };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

export async function sincronizarAgora(conexaoId: string) {
  const ctx = await contexto();
  const { data: cx } = await ctx.supabase.from("conexoes_bancarias").select("id, empresa_id, item_id").eq("id", conexaoId).single();
  if (!cx) return erro("Conexão não encontrada.");
  try {
    // pede ao banco uma atualização nova (chega depois pelo webhook) e já traz o que está disponível
    await pluggy().updateItem(cx.item_id).catch(() => null);
    const r = await sincronizarConexao(ctx.supabase, cx, { desde: new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10) });
    msg(`Atualizado: ${r.novas} movimentações novas, ${r.conciliadas} conciliadas.`);
  } catch (e) {
    erro((e as Error).message);
  }
}
