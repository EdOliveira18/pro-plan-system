"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";


// muda a situação de um orçamento (nunca de um já faturado); quem e quando ficam registrados pelo banco
export async function moverOrcamento(id: string, status: "excluido" | "rascunho" | "perdido", volta: string, fd?: FormData) {
  const ctx = await contexto();
  const motivo = fd ? String(fd.get("motivo") || "").trim() : "";
  const detalhe = fd ? String(fd.get("detalhe") || "").trim() : "";
  const { error } = await ctx.supabase.from("orcamentos")
    .update({ status, updated_at: new Date().toISOString(), ...(status === "perdido" ? { motivo_perda: [motivo, detalhe].filter(Boolean).join(": ") || null } : {}) })
    .eq("id", id).eq("empresa_id", ctx.empresa.id).neq("status", "fechado");
  if (error) redirect(volta + "?erro=" + encodeURIComponent(error.message));
  revalidatePath("/comercial", "layout");
}
