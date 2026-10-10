import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PluggyClient } from "pluggy-sdk";
import { conciliar } from "./conciliar";

export function pluggy() {
  const clientId = process.env.PLUGGY_CLIENT_ID, clientSecret = process.env.PLUGGY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Open Finance ainda não configurado: faltam PLUGGY_CLIENT_ID e PLUGGY_CLIENT_SECRET no servidor.");
  return new PluggyClient({ clientId, clientSecret });
}

// Casa movimentações pendentes com lançamentos previstos e marca como realizados
export async function conciliarEmpresa(sb: SupabaseClient, empresaId: string): Promise<number> {
  const [{ data: movs }, { data: prev }] = await Promise.all([
    sb.from("extrato").select("id, data, valor, conta_id").eq("empresa_id", empresaId).eq("status", "pendente"),
    sb.from("lancamentos").select("id, data, valor").is("excluido_em", null).eq("empresa_id", empresaId).eq("realizado", false),
  ]);
  const pares = conciliar((movs ?? []).map((m) => ({ ...m, valor: Number(m.valor) })), (prev ?? []).map((p) => ({ ...p, valor: Number(p.valor) })));
  for (const [movId, lancId] of pares) {
    const m = movs!.find((x) => x.id === movId)!;
    await sb.from("lancamentos").update({ realizado: true, pago_em: m.data, conta_id: m.conta_id }).eq("id", lancId).eq("empresa_id", empresaId);
    await sb.from("extrato").update({ status: "conciliado", lancamento_id: lancId }).eq("id", movId).eq("empresa_id", empresaId);
  }
  return pares.size;
}

const isoData = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

// Traz contas, saldos e transações de um banco conectado pelo Open Finance e concilia
export async function sincronizarConexao(
  sb: SupabaseClient,
  conexao: { id: string; empresa_id: string; item_id: string },
  opcoes: { desde?: string; ids?: string[]; contaExterna?: string } = {},
) {
  const cli = pluggy();
  const item = await cli.fetchItem(conexao.item_id);
  const instituicao = (item as any).connector?.name ?? "Banco";
  const { results: contas } = await cli.fetchAccounts(conexao.item_id);
  let novas = 0;
  for (const a of contas) {
    if (opcoes.contaExterna && a.id !== opcoes.contaExterna) continue;
    if ((a as any).type && (a as any).type !== "BANK") continue; // cartão de crédito fica de fora por enquanto
    const { data: conta } = await sb.from("contas_bancarias").upsert({
      empresa_id: conexao.empresa_id, nome: `${instituicao} · ${a.name}`, banco: instituicao,
      conta: (a as any).number ?? a.id, origem: "pluggy", externo_id: a.id, conexao_id: conexao.id,
      saldo: a.balance, saldo_em: new Date().toISOString(),
    }, { onConflict: "externo_id" }).select("id").single();
    if (!conta) continue;
    const desde = opcoes.desde ?? isoData(new Date(Date.now() - 90 * 864e5));
    const txs = opcoes.ids?.length
      ? await cli.fetchAllTransactions(a.id, { ids: opcoes.ids })
      : await cli.fetchAllTransactions(a.id, { dateFrom: desde });
    const linhas = txs
      .filter((t) => !t.status || t.status === "POSTED")
      .map((t) => ({
        empresa_id: conexao.empresa_id, conta_id: conta.id, fitid: t.id, data: isoData(t.date),
        valor: Math.round((t.type === "DEBIT" ? -Math.abs(t.amount) : Math.abs(t.amount)) * 100) / 100,
        descricao: t.description || t.descriptionRaw || "Movimentação",
      }));
    for (let i = 0; i < linhas.length; i += 500) {
      const { data } = await sb.from("extrato").upsert(linhas.slice(i, i + 500), { onConflict: "conta_id,fitid", ignoreDuplicates: true }).select("id");
      novas += data?.length ?? 0;
    }
  }
  const conciliadas = await conciliarEmpresa(sb, conexao.empresa_id);
  await sb.from("conexoes_bancarias").update({ status: (item as any).status ?? null, erro: (item as any).error?.message ?? null, instituicao, ultimo_sync: new Date().toISOString() }).eq("id", conexao.id);
  return { novas, conciliadas };
}
