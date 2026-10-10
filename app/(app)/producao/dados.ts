import "server-only";
import type { Contexto } from "@/lib/contexto";
import { atrasada } from "@/lib/producao";
import { idsContratos, juntarOr, limparTermo } from "@/lib/busca";

export async function carregarOPs(ctx: Contexto, status?: string[]) {
  let q = ctx.supabase.from("ordens_producao")
    .select("*, contrato:contratos(id, codigo, cliente:clientes(nome)), responsavel:pessoas(id, nome), tipo:tipos_servico(id, nome)")
    .eq("empresa_id", ctx.empresa.id).order("numero", { ascending: false }).limit(1000);
  if (status) q = q.in("status", status);
  const { data } = await q;
  return ((data ?? []) as any[]).map((o) => ({ ...o, atrasada: atrasada(o) }));
}

export function filtrar(ops: any[], q?: string) {
  const t = (q ?? "").toLowerCase().trim();
  return !t ? ops : ops.filter((o) => [String(o.numero), o.contrato?.codigo, o.contrato?.cliente?.nome, o.descricao].some((x) => String(x ?? "").toLowerCase().includes(t)));
}

/** Listas que só crescem (finalizadas, canceladas): busca e paginação no banco */
export async function carregarOPsPagina(ctx: Contexto, status: string[], termo: string | undefined, de: number, ate: number) {
  let q = ctx.supabase.from("ordens_producao")
    .select("*, contrato:contratos(id, codigo, cliente:clientes(nome)), responsavel:pessoas(id, nome), tipo:tipos_servico(id, nome)", { count: "exact" })
    .eq("empresa_id", ctx.empresa.id).in("status", status);
  const t = limparTermo(termo);
  if (t) {
    const ks = await idsContratos(ctx.supabase, ctx.empresa.id, t);
    q = q.or(juntarOr([/^\d{1,9}$/.test(t) && `numero.eq.${t}`, `descricao.ilike.%${t}%`, ks.length && `contrato_id.in.(${ks.join(",")})`]));
  }
  const { data, count } = await q.order("numero", { ascending: false }).range(de, ate);
  return { ops: ((data ?? []) as any[]).map((o) => ({ ...o, atrasada: atrasada(o) })), count: count ?? 0 };
}
