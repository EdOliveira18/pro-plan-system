import type { SupabaseClient } from "@supabase/supabase-js";

/** Limpa o termo para usar dentro de filtros do PostgREST (vírgula e parênteses quebram o .or) */
export const limparTermo = (t?: string) => (t ?? "").trim().replace(/[%,()*\\]/g, " ").replace(/\s+/g, " ").slice(0, 80);

/**
 * Filtro .or() para orçamentos: projeto, número e nome do cliente.
 * O nome do cliente está em outra tabela, então buscamos os ids antes (no máximo 300).
 */
export async function filtroOrcamentos(sb: SupabaseClient, empresa: string, termo: string, extra: string[] = []) {
  const t = limparTermo(termo);
  if (!t) return null;
  const { data } = await sb.from("clientes").select("id").eq("empresa_id", empresa).ilike("nome", `%${t}%`).limit(300);
  const ids = (data ?? []).map((c: any) => c.id);
  const partes = [`nome_projeto.ilike.%${t}%`, ...extra.map((c) => `${c}.ilike.%${t}%`)];
  if (/^\d{1,9}$/.test(t)) partes.push(`numero.eq.${t}`);
  if (ids.length) partes.push(`cliente_id.in.(${ids.join(",")})`);
  return partes.join(",");
}

/** Início e fim de um dia de Brasília, para filtrar colunas timestamptz */
export const inicioDia = (d: string) => `${d}T00:00:00-03:00`;
export const fimDia = (d: string) => `${d}T23:59:59.999-03:00`;

/** Ids de contratos cujo código ou nome do cliente batem com o termo (para filtrar listas ligadas a contrato) */
export async function idsContratos(sb: SupabaseClient, empresa: string, termo: string) {
  const t = limparTermo(termo);
  if (!t) return [];
  const { data: cs } = await sb.from("clientes").select("id").eq("empresa_id", empresa).ilike("nome", `%${t}%`).limit(300);
  const cli = (cs ?? []).map((c: any) => c.id);
  const { data: ks } = await sb.from("contratos").select("id").eq("empresa_id", empresa)
    .or([`codigo.ilike.%${t}%`, ...(cli.length ? [`cliente_id.in.(${cli.join(",")})`] : [])].join(",")).limit(300);
  return (ks ?? []).map((k: any) => k.id as string);
}

/** Monta o .or() a partir de partes opcionais; devolve um filtro que não casa nada se não houver partes */
export const juntarOr = (partes: (string | number | false | null | undefined)[]) => {
  const p = partes.filter((x): x is string => typeof x === "string" && !!x);
  return p.length ? p.join(",") : "id.is.null";
};
