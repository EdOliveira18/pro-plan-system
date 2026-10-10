"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";

export async function salvarChamado(id: string | null, fd: FormData) {
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "").trim() || null;
  const status = s("status") ?? "aberto";
  const row = {
    contrato_id: s("contrato_id"), modalidade: s("modalidade") ?? "reparo", status, descricao: s("descricao") ?? "",
    historico: s("historico"), observacoes: s("observacoes"), agendado_para: s("agendado_para"), hora_visita: s("hora_visita"),
    montador_id: s("montador_id"), resolvido_em: status === "resolvido" ? new Date().toISOString() : null,
  };
  if (!row.contrato_id || !row.descricao) redirect(`/assistencia/${id ?? "nova"}?erro=` + encodeURIComponent("Informe o contrato do cliente e o problema relatado."));
  if (row.montador_id) {
    const { data: m } = await ctx.supabase.from("pessoas").select("nome").eq("id", row.montador_id).single();
    (row as any).responsavel = m?.nome ?? null;
  }
  const { error } = id
    ? await ctx.supabase.from("chamados").update(row).eq("id", id).eq("empresa_id", ctx.empresa.id)
    : await ctx.supabase.from("chamados").insert({ ...row, empresa_id: ctx.empresa.id });
  if (error) redirect(`/assistencia/${id ?? "nova"}?erro=` + encodeURIComponent(error.message));
  revalidatePath("/assistencia", "layout");
  redirect("/assistencia?msg=" + encodeURIComponent(id ? "Assistência atualizada." : "Assistência cadastrada."));
}
