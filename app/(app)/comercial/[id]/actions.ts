"use server";
import { revalidatePath } from "next/cache";
import { contexto, configuracaoEmpresa, type Contexto } from "@/lib/contexto";
import { calcularOlhinho } from "@/lib/olhinho";
import { importarArquivoPromob } from "@/lib/importacao";

type Resp = { ok: true; id?: string } | { ok: false; erro: string };

async function recalcularSnapshot(ctx: Contexto, orcId: string) {
  const [{ data: o }, { data: ambs }, cfg] = await Promise.all([
    ctx.supabase.from("orcamentos").select("desconto_pct, forma_pagamento, parcelas, rt_pct").eq("id", orcId).single(),
    ctx.supabase.from("ambientes").select("custo_fabrica, pontuacao").eq("orcamento_id", orcId).eq("versao", 1),
    configuracaoEmpresa(ctx),
  ]);
  if (!o) return null;
  const r = calcularOlhinho(
    (ambs ?? []).map((a) => ({ custo_fabrica: Number(a.custo_fabrica), pontuacao: Number(a.pontuacao) })),
    { desconto_pct: Number(o.desconto_pct), forma_pagamento: o.forma_pagamento, parcelas: o.parcelas, rt_pct: Number(o.rt_pct) },
    cfg,
  );
  await ctx.supabase.from("orcamentos").update({ calculo: r }).eq("id", orcId);
  return r;
}

export async function salvarCondicoes(orcId: string, c: { desconto_pct: number; forma_pagamento: string; parcelas: number; rt_pct: number }): Promise<Resp> {
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("orcamentos").update({
    desconto_pct: c.desconto_pct, forma_pagamento: c.forma_pagamento, parcelas: Math.max(1, Math.min(24, c.parcelas)), rt_pct: c.rt_pct,
  }).eq("id", orcId);
  if (error) return { ok: false, erro: error.message };
  await recalcularSnapshot(ctx, orcId);
  return { ok: true };
}

export async function salvarAmbiente(orcId: string, ambId: string, campos: { pontuacao?: number; nome?: string; custo_fabrica?: number; prazo_dias?: number }): Promise<Resp> {
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("ambientes").update(campos).eq("id", ambId);
  if (error) return { ok: false, erro: error.message };
  await recalcularSnapshot(ctx, orcId);
  return { ok: true };
}

export async function adicionarAmbiente(orcId: string, a: { nome: string; custo_fabrica: number; prazo_dias: number }): Promise<Resp> {
  const ctx = await contexto();
  const { data, error } = await ctx.supabase.from("ambientes").insert({
    empresa_id: ctx.empresa.id, orcamento_id: orcId, nome: a.nome, custo_fabrica: a.custo_fabrica, prazo_dias: a.prazo_dias, pontuacao: 3, origem: "manual",
  }).select("id").single();
  if (error) return { ok: false, erro: error.message };
  await recalcularSnapshot(ctx, orcId);
  revalidatePath(`/comercial/${orcId}`);
  return { ok: true, id: data.id };
}

export async function removerAmbiente(orcId: string, ambId: string): Promise<Resp> {
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("ambientes").delete().eq("id", ambId);
  if (error) return { ok: false, erro: error.message };
  await recalcularSnapshot(ctx, orcId);
  revalidatePath(`/comercial/${orcId}`);
  return { ok: true };
}

export async function importarPromob(orcId: string, fd: FormData): Promise<Resp & { qtd?: number }> {
  const ctx = await contexto();
  const arquivo = fd.get("arquivo");
  if (!(arquivo instanceof File) || !arquivo.size) return { ok: false, erro: "Escolha um arquivo XML ou TXT do Promob." };
  try {
    const qtd = await importarArquivoPromob(ctx, orcId, arquivo, 1);
    await recalcularSnapshot(ctx, orcId);
    revalidatePath(`/comercial/${orcId}`);
    return { ok: true, qtd };
  } catch (e) {
    return { ok: false, erro: (e as Error).message };
  }
}

// Fechamento: recalcula no servidor (fonte da verdade) e chama a função do banco, que revalida a trava
export async function fecharContrato(orcId: string, endereco: string, liberar: boolean): Promise<Resp> {
  const ctx = await contexto();
  const r = await recalcularSnapshot(ctx, orcId);
  if (!r) return { ok: false, erro: "Orçamento não encontrado." };
  const fabrica = r.custos.find((c) => c.chave === "fabrica")?.valor ?? 0;
  const { data, error } = await ctx.supabase.rpc("fechar_orcamento", {
    p_orcamento_id: orcId, p_valor_total: r.valorProposta, p_vpl: r.vpl, p_custo_previsto: r.custoTotal, p_lucro_previsto: r.lucro,
    p_custo_fabrica: fabrica, p_valor_rt: r.valorRT, p_endereco_obra: endereco || null, p_liberar_abaixo_minimo: liberar,
  });
  if (error) {
    const msg = error.message.startsWith("TRAVA_PONTUACAO")
      ? "Venda travada: a pontuação média está abaixo do mínimo da loja. Reduza o desconto ou peça liberação a um gerente."
      : error.message;
    return { ok: false, erro: msg };
  }
  revalidatePath("/comercial");
  return { ok: true, id: String(data) };
}
