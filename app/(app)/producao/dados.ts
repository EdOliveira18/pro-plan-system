import "server-only";
import type { Contexto } from "@/lib/contexto";
import { atrasada } from "@/lib/producao";

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
