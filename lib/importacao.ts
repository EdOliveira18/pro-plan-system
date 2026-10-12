import "server-only";
import type { Contexto } from "./contexto";
import { lerPromob, type AmbienteImportado } from "./promob";

// Guarda o arquivo original e cria ambientes + peças (versão informada)
export async function gravarAmbientesImportados(
  ctx: Contexto, orcId: string, arquivo: File, lidos: AmbienteImportado[], versao: number,
  origem: "promob" | "ia", contratoId?: string,
) {
  const caminho = `${ctx.empresa.id}/orcamentos/${orcId}/${origem}/v${versao}-${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
  const up = await ctx.supabase.storage.from("arquivos").upload(caminho, arquivo, { contentType: arquivo.type || "application/octet-stream" });
  if (!up.error) {
    await ctx.supabase.from("arquivos").insert({
      empresa_id: ctx.empresa.id, orcamento_id: orcId, contrato_id: contratoId ?? null, tipo: origem === "promob" ? "promob" : "planta",
      nome: arquivo.name, storage_path: caminho, mime: arquivo.type, tamanho: arquivo.size, created_by: ctx.userId,
    });
  }
  const { count } = await ctx.supabase.from("ambientes").select("*", { count: "exact", head: true }).eq("orcamento_id", orcId).eq("versao", versao);
  for (const [i, a] of lidos.entries()) {
    const custo = a.custo_fabrica;
    // se o arquivo trouxe o valor vendido, a pontuação já nasce coerente com ele
    const pontuacao = a.valor_venda && custo > 0 ? Math.round((a.valor_venda / custo) * 1e6) / 1e6 : 3;
    const { data: amb, error } = await ctx.supabase.from("ambientes").insert({
      empresa_id: ctx.empresa.id, orcamento_id: orcId, versao, nome: a.nome,
      descricao: a.descricao ?? (a.pecas.length ? `${a.pecas.length} itens importados` : null),
      custo_fabrica: custo, pontuacao, prazo_dias: a.prazo_dias ?? null, origem, ordem: (count ?? 0) + i,
    }).select("id").single();
    if (error) throw new Error(error.message);
    if (a.pecas.length) {
      await ctx.supabase.from("pecas").insert(a.pecas.map((p) => ({
        empresa_id: ctx.empresa.id, ambiente_id: amb.id, codigo: p.codigo ?? null, descricao: p.descricao, quantidade: p.quantidade, custo_unitario: p.custo_unitario,
      })));
    }
  }
  return lidos.length;
}

// Importa XML/TXT do Promob
export async function importarArquivoPromob(ctx: Contexto, orcId: string, arquivo: File, versao: number, contratoId?: string) {
  const lidos = lerPromob(await arquivo.text(), arquivo.name);
  if (!lidos.length) throw new Error("Não encontrei ambientes com custo nesse arquivo. Confira se é a exportação de orçamento do Promob (XML ou TXT).");
  return gravarAmbientesImportados(ctx, orcId, arquivo, lidos, versao, "promob", contratoId);
}
