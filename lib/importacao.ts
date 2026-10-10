import "server-only";
import type { Contexto } from "./contexto";
import { lerPromob } from "./promob";

// Importa XML/TXT do Promob: guarda o arquivo original e cria ambientes + peças (versão informada)
export async function importarArquivoPromob(ctx: Contexto, orcId: string, arquivo: File, versao: number, contratoId?: string) {
  const texto = await arquivo.text();
  const lidos = lerPromob(texto, arquivo.name);
  if (!lidos.length) throw new Error("Não encontrei ambientes com custo nesse arquivo. Confira se é a exportação de orçamento do Promob (XML ou TXT).");

  const caminho = `${ctx.empresa.id}/orcamentos/${orcId}/promob/v${versao}-${Date.now()}-${arquivo.name.replace(/[^\w.\-]/g, "_")}`;
  const up = await ctx.supabase.storage.from("arquivos").upload(caminho, arquivo, { contentType: arquivo.type || "text/plain" });
  if (!up.error) {
    await ctx.supabase.from("arquivos").insert({
      empresa_id: ctx.empresa.id, orcamento_id: orcId, contrato_id: contratoId ?? null, tipo: "promob",
      nome: arquivo.name, storage_path: caminho, mime: arquivo.type, tamanho: arquivo.size, created_by: ctx.userId,
    });
  }
  const { count } = await ctx.supabase.from("ambientes").select("*", { count: "exact", head: true }).eq("orcamento_id", orcId).eq("versao", versao);
  for (const [i, a] of lidos.entries()) {
    const { data: amb, error } = await ctx.supabase.from("ambientes").insert({
      empresa_id: ctx.empresa.id, orcamento_id: orcId, versao, nome: a.nome, descricao: a.descricao ?? `${a.pecas.length} itens importados do Promob`,
      custo_fabrica: a.custo_fabrica, pontuacao: 3, origem: "promob", ordem: (count ?? 0) + i,
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

