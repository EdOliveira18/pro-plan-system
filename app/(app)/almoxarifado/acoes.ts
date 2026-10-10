"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { lerNFe } from "@/lib/nfe-xml";

const num = (v: FormDataEntryValue | null) => { const s = String(v ?? "").trim(); const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s); return Number.isFinite(n) ? n : 0; };
const ir = (url: string, chave: "erro" | "msg", txt: string) => redirect(url + (url.includes("?") ? "&" : "?") + chave + "=" + encodeURIComponent(txt));
const erroBanco = (m: string) => m.includes("ESTOQUE_INSUFICIENTE") ? "Estoque insuficiente para " + m.split("ESTOQUE_INSUFICIENTE:")[1]?.trim()
  : m.includes("PEDIDO_SEM_ITENS") ? "Adicione ao menos um item antes de finalizar." : m.includes("PEDIDO_JA_FECHADO") ? "Este pedido já foi finalizado ou cancelado."
  : m.includes("SEM_PERMISSAO") || /row-level/i.test(m) ? "Seu perfil não tem permissão para isso." : m;

export async function criarPedido(tipo: "compra" | "saida", fd: FormData) {
  const ctx = await contexto();
  const volta = tipo === "compra" ? "/almoxarifado/novo?tipo=compra" : "/almoxarifado/novo?tipo=saida";
  const forn = String(fd.get("fornecedor_id") || "") || null;
  if (tipo === "compra" && !forn) ir(volta, "erro", "Escolha o fornecedor.");
  const { data, error } = await ctx.supabase.from("pedidos_estoque").insert({
    empresa_id: ctx.empresa.id, tipo, data: String(fd.get("data") || "") || undefined, fornecedor_id: forn,
    contrato_id: String(fd.get("contrato_id") || "") || null, responsavel_id: String(fd.get("responsavel_id") || "") || ctx.userId,
    documento: String(fd.get("documento") || "") || null, natureza_id: String(fd.get("natureza_id") || "") || null,
    tipo_saida: String(fd.get("tipo_saida") || "") || null, vencimento: String(fd.get("vencimento") || "") || null,
    gerar_financeiro: fd.get("gerar_financeiro") === "on", observacoes: String(fd.get("observacoes") || "") || null,
  }).select("id").single();
  if (error) ir(volta, "erro", erroBanco(error.message));
  redirect(`/almoxarifado/pedido/${data!.id}`);
}

export async function adicionarItem(pid: string, fd: FormData) {
  const ctx = await contexto();
  const produto = String(fd.get("produto_id") || "");
  const qtd = num(fd.get("quantidade"));
  if (!produto || qtd <= 0) ir(`/almoxarifado/pedido/${pid}`, "erro", "Escolha o produto e a quantidade.");
  const { data: pr } = await ctx.supabase.from("produtos").select("valor_compra").eq("id", produto).single();
  const unit = fd.get("valor_unit") ? num(fd.get("valor_unit")) : Number(pr?.valor_compra ?? 0);
  const { error } = await ctx.supabase.from("pedido_itens").insert({ empresa_id: ctx.empresa.id, pedido_id: pid, produto_id: produto, quantidade: qtd, valor_unit: unit });
  if (error) ir(`/almoxarifado/pedido/${pid}`, "erro", erroBanco(error.message));
  revalidatePath(`/almoxarifado/pedido/${pid}`);
}

export async function removerItem(pid: string, itemId: string) {
  const ctx = await contexto();
  await ctx.supabase.from("pedido_itens").delete().eq("id", itemId).eq("empresa_id", ctx.empresa.id);
  revalidatePath(`/almoxarifado/pedido/${pid}`);
}

export async function finalizarPedido(pid: string) {
  const ctx = await contexto();
  const { error } = await ctx.supabase.rpc("finalizar_pedido_estoque", { p_id: pid });
  if (error) ir(`/almoxarifado/pedido/${pid}`, "erro", erroBanco(error.message));
  revalidatePath("/almoxarifado", "layout");
  ir(`/almoxarifado/pedido/${pid}`, "msg", "Pedido finalizado. O estoque foi atualizado.");
}

export async function cancelarPedido(pid: string) {
  const ctx = await contexto();
  await ctx.supabase.from("pedidos_estoque").update({ status: "cancelado" }).eq("id", pid).eq("status", "aberto");
  revalidatePath("/almoxarifado", "layout");
}

// Notas de compra: importa o XML que o fornecedor envia
export async function importarXML(fd: FormData) {
  const ctx = await contexto();
  const arquivos = fd.getAll("xml").filter((f): f is File => f instanceof File && f.size > 0);
  if (!arquivos.length) ir("/almoxarifado/notas-compra", "erro", "Escolha um ou mais arquivos XML.");
  let ok = 0; const falhas: string[] = [];
  for (const f of arquivos) {
    try {
      const n = lerNFe(await f.text());
      const { error } = await ctx.supabase.from("notas_compra").insert({
        empresa_id: ctx.empresa.id, chave: n.chave, numero: n.numero, serie: n.serie, emitente_nome: n.emitenteNome, emitente_cnpj: n.emitenteCnpj,
        emissao: n.emissao, valor: n.valor, itens: n.itens,
      });
      if (error) falhas.push(`${f.name}: ${error.code === "23505" ? "nota já importada" : error.message}`); else ok++;
    } catch (e: any) { falhas.push(`${f.name}: ${e.message}`); }
  }
  revalidatePath("/almoxarifado/notas-compra");
  ir("/almoxarifado/notas-compra", falhas.length ? "erro" : "msg", `${ok} nota(s) importada(s).${falhas.length ? " Problemas: " + falhas.join("; ") : ""}`);
}

export async function marcarNota(nid: string, status: "outra" | "pendente") {
  const ctx = await contexto();
  await ctx.supabase.from("notas_compra").update({ status }).eq("id", nid).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/almoxarifado/notas-compra");
}

// Transforma a nota em pedido de compra: acha ou cria o fornecedor e os produtos
export async function gerarPedidoDaNota(nid: string) {
  const ctx = await contexto();
  const sb = ctx.supabase, eid = ctx.empresa.id;
  const { data: n } = await sb.from("notas_compra").select("*").eq("id", nid).single();
  if (!n || n.status === "gerada") ir("/almoxarifado/notas-compra", "erro", "Nota não encontrada ou já gerada.");
  const doc = String(n.emitente_cnpj ?? "").replace(/\D/g, "");
  const { data: forns } = await sb.from("pessoas").select("id, cpf_cnpj").eq("empresa_id", eid).eq("categoria", "fornecedor");
  let fornId = (forns ?? []).find((f: any) => String(f.cpf_cnpj ?? "").replace(/\D/g, "") === doc && doc)?.id;
  if (!fornId) {
    const { data: f, error } = await sb.from("pessoas").insert({ empresa_id: eid, categoria: "fornecedor", tipo_pessoa: doc.length === 14 ? "pj" : "pf", nome: n.emitente_nome || "Fornecedor " + doc, cpf_cnpj: doc || null }).select("id").single();
    if (error) ir("/almoxarifado/notas-compra", "erro", "Não consegui cadastrar o fornecedor: " + error.message);
    fornId = f!.id;
  }
  const { data: nat } = await sb.from("naturezas").select("id").eq("empresa_id", eid).eq("cfop_estadual", "1101").maybeSingle();
  const { data: ped, error: e1 } = await sb.from("pedidos_estoque").insert({
    empresa_id: eid, tipo: "compra", data: n.emissao ?? undefined, fornecedor_id: fornId, responsavel_id: ctx.userId,
    documento: `NF-e ${n.numero}${n.serie ? "/" + n.serie : ""}`, natureza_id: nat?.id ?? null, gerar_financeiro: true,
  }).select("id").single();
  if (e1) ir("/almoxarifado/notas-compra", "erro", e1.message);
  const { data: prods } = await sb.from("produtos").select("id, codigo, referencia, nome").eq("empresa_id", eid);
  for (const it of (n.itens ?? []) as any[]) {
    let p = (prods ?? []).find((x: any) => (it.codigo && (x.referencia === it.codigo || x.codigo === it.codigo)) || x.nome.toLowerCase() === String(it.nome).toLowerCase());
    if (!p) {
      const { data: novo } = await sb.from("produtos").insert({
        empresa_id: eid, codigo: `${it.codigo || "NF"}-${Math.floor(Math.random() * 9000 + 1000)}`, nome: it.nome, tipo: "Matéria-prima", referencia: it.codigo || null,
        unid_compra: it.unidade.slice(0, 3), unid_producao: it.unidade.slice(0, 3), fornecedor_id: fornId, valor_compra: it.valorUnit, ncm: it.ncm || null,
      }).select("id, codigo, referencia, nome").single();
      p = novo ?? undefined; if (novo) prods?.push(novo);
    }
    if (p) await sb.from("pedido_itens").insert({ empresa_id: eid, pedido_id: ped!.id, produto_id: p.id, quantidade: it.quantidade, valor_unit: it.valorUnit });
  }
  await sb.from("notas_compra").update({ status: "gerada", pedido_id: ped!.id }).eq("id", nid);
  revalidatePath("/almoxarifado", "layout");
  ir(`/almoxarifado/pedido/${ped!.id}`, "msg", "Pedido criado a partir da nota. Confira os itens e clique em Finalizar para dar entrada no estoque.");
}
