"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { hojeISO } from "@/lib/financeiro";

const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const reval = () => revalidatePath("/financeiro", "layout");

export async function salvarLancamento(id: string | null, fd: FormData) {
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "").trim() || null;
  const tipo = s("tipo") === "receita" ? 1 : -1;
  const valor = Math.abs(num(fd.get("valor")));
  const volta = id ? `/financeiro/lancamentos/${id}` : "/financeiro/lancamentos/novo";
  if (!s("descricao") || !valor || !s("data")) redirect(volta + "?erro=" + encodeURIComponent("Preencha descrição, valor e vencimento."));
  const plano = s("plano_conta");
  const pago = fd.get("pago") === "on";
  const base = {
    descricao: s("descricao")!, entidade: s("entidade"), valor: tipo * valor, data: s("data")!, competencia: s("competencia") ? s("competencia") + "-01" : null,
    forma_pagamento: s("forma_pagamento"), plano_conta: plano, conta_id: s("conta_id"), contrato_id: s("contrato_id"), documento: s("documento"), observacoes: s("observacoes"),
    categoria: s("categoria") ?? (tipo > 0 ? "recebimento" : plano?.startsWith("2.") ? "custo" : plano === "3.2.1" ? "comissao_vendedor" : plano === "3.2.2" ? "comissao_rt" : "despesa"),
    realizado: pago, pago_em: pago ? s("pago_em") ?? hojeISO() : null,
  };
  if (id) {
    const { error } = await ctx.supabase.from("lancamentos").update(base).eq("id", id).eq("empresa_id", ctx.empresa.id);
    if (error) redirect(volta + "?erro=" + encodeURIComponent(error.message));
  } else {
    const vezes = Math.min(60, Math.max(1, Math.round(num(fd.get("repetir")) || 1)));
    const linhas = Array.from({ length: vezes }, (_, i) => {
      const d = new Date(base.data + "T12:00:00"); d.setMonth(d.getMonth() + i);
      return { ...base, empresa_id: ctx.empresa.id, data: d.toISOString().slice(0, 10), descricao: vezes > 1 ? `${base.descricao} (${i + 1}/${vezes})` : base.descricao, realizado: i === 0 && pago, pago_em: i === 0 ? base.pago_em : null };
    });
    const { error } = await ctx.supabase.from("lancamentos").insert(linhas);
    if (error) redirect(volta + "?erro=" + encodeURIComponent(/row-level/i.test(error.message) ? "Seu perfil não tem acesso ao financeiro." : error.message));
  }
  reval();
  redirect(`/financeiro/lancamentos?tipo=${tipo > 0 ? "receber" : "pagar"}&msg=` + encodeURIComponent(id ? "Lançamento atualizado." : "Lançamento cadastrado."));
}

export async function marcarPago(ids: string[], pago: boolean) {
  const ctx = await contexto();
  if (!ids.length) return;
  await ctx.supabase.from("lancamentos").update({ realizado: pago, pago_em: pago ? hojeISO() : null }).in("id", ids).eq("empresa_id", ctx.empresa.id);
  reval();
}
export async function pagarSelecionados(fd: FormData) { await marcarPago(fd.getAll("ids").map(String), true); }
export async function pagarUm(id: string) { await marcarPago([id], true); }
export async function estornarUm(id: string) { await marcarPago([id], false); }

export async function excluirLancamento(id: string) {
  const ctx = await contexto();
  await ctx.supabase.from("lancamentos").update({ excluido_em: new Date().toISOString(), excluido_por: ctx.userId }).eq("id", id).eq("empresa_id", ctx.empresa.id);
  reval();
}
export async function restaurarLancamento(id: string) {
  const ctx = await contexto();
  await ctx.supabase.from("lancamentos").update({ excluido_em: null, excluido_por: null }).eq("id", id).eq("empresa_id", ctx.empresa.id);
  reval();
}

// Recorrentes
export async function salvarRecorrencia(tipo: "receita" | "despesa", fd: FormData) {
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "").trim() || null;
  const { error } = await ctx.supabase.from("recorrencias").insert({
    empresa_id: ctx.empresa.id, tipo, descricao: s("descricao"), entidade: s("entidade"), valor: Math.abs(num(fd.get("valor"))), dia: Math.min(31, Math.max(1, Math.round(num(fd.get("dia")) || 5))),
    inicio: s("inicio") ?? hojeISO(), fim: s("fim"), forma_pagamento: s("forma_pagamento"), plano_conta: s("plano_conta"),
  });
  reval();
  redirect(`/financeiro/recorrentes?tipo=${tipo}&` + (error ? "erro=" + encodeURIComponent(error.message) : "msg=" + encodeURIComponent("Recorrência criada.")));
}
export async function alternarRecorrencia(id: string, ativa: boolean) {
  const ctx = await contexto();
  await ctx.supabase.from("recorrencias").update({ ativa }).eq("id", id).eq("empresa_id", ctx.empresa.id);
  reval();
}
export async function gerarRecorrentes(tipo: "receita" | "despesa", fd: FormData) {
  const ctx = await contexto();
  const mes = String(fd.get("mes") || hojeISO().slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const comp = `${mes}-01`, ult = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const { data: recs } = await ctx.supabase.from("recorrencias").select("*").eq("empresa_id", ctx.empresa.id).eq("tipo", tipo).eq("ativa", true);
  const { data: ja } = await ctx.supabase.from("lancamentos").select("recorrencia_id").eq("empresa_id", ctx.empresa.id).eq("competencia", comp).not("recorrencia_id", "is", null);
  const feitos = new Set((ja ?? []).map((x: any) => x.recorrencia_id));
  const novos = ((recs ?? []) as any[]).filter((r) => !feitos.has(r.id) && r.inicio <= `${mes}-${String(ult).padStart(2, "0")}` && (!r.fim || r.fim >= comp)).map((r) => ({
    empresa_id: ctx.empresa.id, recorrencia_id: r.id, competencia: comp, data: `${mes}-${String(Math.min(r.dia, ult)).padStart(2, "0")}`,
    descricao: r.descricao, entidade: r.entidade, valor: (tipo === "receita" ? 1 : -1) * Number(r.valor), forma_pagamento: r.forma_pagamento, plano_conta: r.plano_conta,
    categoria: tipo === "receita" ? "recebimento" : "despesa_fixa",
  }));
  if (novos.length) await ctx.supabase.from("lancamentos").insert(novos);
  reval();
  redirect(`/financeiro/recorrentes?tipo=${tipo}&msg=` + encodeURIComponent(novos.length ? `${novos.length} lançamento(s) de ${mes.split("-").reverse().join("/")} gerado(s).` : "Os lançamentos deste mês já tinham sido gerados."));
}

// Comissões de vendedores pelas faixas sobre o VPL do mês
export async function gerarComissoes(fd: FormData) {
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const mes = String(fd.get("mes") || hojeISO().slice(0, 7));
  const [a, m] = mes.split("-").map(Number);
  const ini = `${mes}-01`, fim = new Date(Date.UTC(a, m, 1)).toISOString().slice(0, 10);
  const [{ data: cfg }, { data: ks }, { data: ms }, { data: ja }] = await Promise.all([
    ctx.supabase.from("configuracoes").select("faixas_comissao").eq("empresa_id", eid).single(),
    ctx.supabase.from("contratos").select("id, codigo, vpl, vendedor_id").eq("empresa_id", eid).gte("data_venda", ini).lt("data_venda", fim),
    ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", eid),
    ctx.supabase.from("lancamentos").select("contrato_id").eq("empresa_id", eid).eq("categoria", "comissao_vendedor").is("excluido_em", null),
  ]);
  const faixas = ((cfg?.faixas_comissao ?? []) as any[]).sort((x, y) => x.a_partir_de - y.a_partir_de);
  const tem = new Set((ja ?? []).map((x: any) => x.contrato_id));
  const porV = new Map<string, number>();
  (ks ?? []).forEach((k: any) => porV.set(k.vendedor_id, (porV.get(k.vendedor_id) ?? 0) + Number(k.vpl)));
  const pag = new Date(Date.UTC(a, m, 5)).toISOString().slice(0, 10);
  const novos = ((ks ?? []) as any[]).filter((k) => k.vendedor_id && !tem.has(k.id)).map((k) => {
    const f = faixas.filter((x) => (porV.get(k.vendedor_id) ?? 0) >= x.a_partir_de).pop() ?? { pct: 0, nome: "" };
    return { empresa_id: eid, contrato_id: k.id, data: pag, competencia: ini, descricao: `Comissão ${f.nome} contrato #${k.codigo}`, categoria: "comissao_vendedor", plano_conta: "3.2.1",
      entidade: (ms ?? []).find((x: any) => x.user_id === k.vendedor_id)?.nome ?? "Vendedor", valor: -Math.round(Number(k.vpl) * Number(f.pct)) / 100 };
  }).filter((x) => x.valor < 0);
  if (novos.length) await ctx.supabase.from("lancamentos").insert(novos);
  reval();
  redirect("/financeiro/comissoes?msg=" + encodeURIComponent(novos.length ? `${novos.length} comissão(ões) lançada(s) em Contas a pagar.` : "Nenhuma comissão nova para lançar neste mês."));
}

// Contas financeiras: corrente, cartão, poupança, caixa
export async function salvarConta(fd: FormData) {
  const ctx = await contexto();
  const s = (k: string) => String(fd.get(k) || "").trim() || null;
  const tipo = s("tipo") ?? "corrente";
  const nome = s("nome") ?? (tipo === "caixa" ? "Caixa da loja" : s("banco") ?? "Conta");
  const { error } = await ctx.supabase.from("contas_bancarias").insert({
    empresa_id: ctx.empresa.id, tipo, nome, banco: s("banco"), agencia: s("agencia"), conta: s("conta") ?? (tipo === "cartao" ? "cartao-" + (s("ultimos4") ?? "") : tipo === "caixa" ? "caixa-" + Date.now() : null),
    bandeira: s("bandeira"), ultimos4: s("ultimos4"), dia_fechamento: s("dia_fechamento") ? Number(s("dia_fechamento")) : null, dia_vencimento: s("dia_vencimento") ? Number(s("dia_vencimento")) : null,
    conta_pagamento_id: s("conta_pagamento_id"), saldo_inicial: num(fd.get("saldo_inicial")), data_inicial: s("data_inicial"), origem: "manual",
  });
  if (error) redirect(`/financeiro/contas/nova?tipo=${tipo}&erro=` + encodeURIComponent(error.code === "23505" ? "Já existe uma conta com esses dados." : error.message));
  reval();
  redirect("/financeiro/contas?msg=" + encodeURIComponent("Conta cadastrada."));
}
