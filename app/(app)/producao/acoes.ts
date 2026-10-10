"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";

export async function criarOP(fd: FormData) {
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "") || null;
  const { error } = await ctx.supabase.from("ordens_producao").insert({
    empresa_id: ctx.empresa.id, contrato_id: s("contrato_id"), descricao: s("descricao"), tipo_servico_id: s("tipo_servico_id"),
    responsavel_id: s("responsavel_id"), previsao_inicio: s("previsao_inicio"), previsao_fim: s("previsao_fim"),
  });
  if (error) redirect("/producao/nova?erro=" + encodeURIComponent(error.message));
  revalidatePath("/producao", "layout");
  redirect("/producao?msg=" + encodeURIComponent("Ordem de produção criada na coluna Agendada."));
}

export async function moverOP(id: string, etapa: string) {
  const ctx = await contexto();
  const { data: op } = await ctx.supabase.from("ordens_producao").select("status, iniciada_em").eq("id", id).single();
  const upd: Record<string, unknown> = { etapa };
  // tirar de "Agendada" já conta como início da produção
  if (op?.status === "aguardando" && etapa !== "agendada") { upd.status = "em_producao"; upd.iniciada_em = op.iniciada_em ?? new Date().toISOString(); }
  await ctx.supabase.from("ordens_producao").update(upd).eq("id", id).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/producao", "layout");
}

export async function statusOP(id: string, status: "em_producao" | "pausada" | "finalizada" | "cancelada" | "aguardando", fd?: FormData) {
  const ctx = await contexto();
  const agora = new Date().toISOString();
  const upd: Record<string, unknown> = { status };
  const { data: op } = await ctx.supabase.from("ordens_producao").select("iniciada_em").eq("id", id).single();
  if (status === "em_producao" && !op?.iniciada_em) upd.iniciada_em = agora;
  if (status === "finalizada") { upd.finalizada_em = agora; upd.iniciada_em = op?.iniciada_em ?? agora; }
  if (status === "cancelada") { upd.cancelada_em = agora; upd.motivo_cancelamento = fd ? String(fd.get("motivo") || "") || null : null; }
  if (status === "aguardando") { upd.cancelada_em = null; upd.finalizada_em = null; }
  await ctx.supabase.from("ordens_producao").update(upd).eq("id", id).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/producao", "layout");
}
