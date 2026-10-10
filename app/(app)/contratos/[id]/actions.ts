"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { importarArquivoPromob } from "@/lib/importacao";
import { hojeISO, dataHora, somaDias } from "@/lib/tempo";

const voltar = (id: string, erro?: string) => {
  revalidatePath(`/contratos/${id}`);
  if (erro) redirect(`/contratos/${id}?erro=${encodeURIComponent(erro)}`);
};

export async function concluirMarco(id: string) {
  const ctx = await contexto();
  const { error } = await ctx.supabase.rpc("concluir_marco", { p_contrato_id: id });
  voltar(id, error?.message);
  revalidatePath("/radar");
}

export async function avancarWorkflow(id: string) {
  const ctx = await contexto();
  const { error } = await ctx.supabase.rpc("avancar_workflow", { p_contrato_id: id });
  voltar(id, error?.message);
  revalidatePath("/radar");
}

export async function marcarAssinatura(id: string, lado: "empresa" | "cliente", status: string) {
  const ctx = await contexto();
  const campo = lado === "empresa" ? "assinatura_empresa" : "assinatura_cliente";
  const { error } = await ctx.supabase.from("contratos").update({ [campo]: status }).eq("id", id);
  voltar(id, error?.message);
}

export async function marcarRealizado(contratoId: string, lancId: string, realizado: boolean) {
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("lancamentos").update({ realizado, pago_em: realizado ? hojeISO() : null }).eq("id", lancId);
  voltar(contratoId, error?.message);
}

export async function novoLancamento(contratoId: string, fd: FormData) {
  const ctx = await contexto();
  const valor = Number(String(fd.get("valor")).replace(/\./g, "").replace(",", "."));
  const sinal = fd.get("tipo") === "saida" ? -1 : 1;
  const { error } = await ctx.supabase.from("lancamentos").insert({
    empresa_id: ctx.empresa.id, contrato_id: contratoId, data: String(fd.get("data")), descricao: String(fd.get("descricao")),
    categoria: String(fd.get("categoria")), valor: sinal * Math.abs(valor), realizado: fd.get("realizado") === "on",
  });
  voltar(contratoId, error?.message);
}

export async function importarRevisao(contratoId: string, fd: FormData) {
  const ctx = await contexto();
  const arquivo = fd.get("arquivo");
  const { data: c } = await ctx.supabase.from("contratos").select("orcamento_id").eq("id", contratoId).single();
  if (!c?.orcamento_id) return voltar(contratoId, "Contrato sem orçamento de origem.");
  if (!(arquivo instanceof File) || !arquivo.size) return voltar(contratoId, "Escolha o XML ou TXT revisado do Promob.");
  // substitui a revisão anterior (versão 2)
  await ctx.supabase.from("ambientes").delete().eq("orcamento_id", c.orcamento_id).eq("versao", 2);
  try {
    await importarArquivoPromob(ctx, c.orcamento_id, arquivo, 2, contratoId);
  } catch (e) {
    return voltar(contratoId, (e as Error).message);
  }
  voltar(contratoId);
}

export async function abrirChamado(contratoId: string, fd: FormData) {
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("chamados").insert({ empresa_id: ctx.empresa.id, contrato_id: contratoId, descricao: String(fd.get("descricao")) });
  voltar(contratoId, error?.message);
}
