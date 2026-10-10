"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { entidade, camposDe, converter } from "@/lib/cadastros";

const voltar = (slug: string, chave: "erro" | "msg", txt: string, extra = "") =>
  redirect(`/cadastros/${slug}${extra}?${chave}=${encodeURIComponent(txt)}`);

function enderecoTexto(r: Record<string, any>) {
  const l1 = [r.logradouro, r.numero].filter(Boolean).join(", ");
  const l2 = [r.complemento, r.bairro].filter(Boolean).join(", ");
  const l3 = [r.cidade, r.uf].filter(Boolean).join("/");
  return [l1, l2, l3, r.cep].filter(Boolean).join(" · ") || null;
}

export async function salvarCadastro(slug: string, id: string | null, fd: FormData) {
  const e = entidade(slug);
  if (!e) redirect("/dashboard");
  const ctx = await contexto();
  const row: Record<string, unknown> = {};
  const faltando: string[] = [];
  for (const c of camposDe(e)) {
    const v = converter(c, fd.get(c.n));
    if (c.obrig && (v === null || v === "")) faltando.push(c.label);
    row[c.n] = v;
  }
  const destino = id ? `/${id}` : "/novo";
  if (faltando.length) voltar(slug, "erro", "Preencha os campos obrigatórios: " + faltando.join(", "), destino);
  if (e.tabela === "clientes") row.endereco = enderecoTexto(row);
  Object.assign(row, e.filtro ?? {});

  const sb = ctx.supabase;
  const q = id
    ? sb.from(e.tabela).update(row).eq("id", id).eq("empresa_id", ctx.empresa.id)
    : sb.from(e.tabela).insert({ ...row, empresa_id: ctx.empresa.id, ...(e.tabela === "clientes" ? { created_by: ctx.userId } : {}), ...(e.tabela === "leads" ? { vendedor_id: ctx.userId } : {}) });
  const { error } = await q;
  if (error) {
    const msg = error.code === "42501" || /row-level security/i.test(error.message)
      ? "Seu perfil não tem permissão para gravar este cadastro. Peça ao dono, gerente ou financeiro."
      : error.code === "23505" ? `Já existe ${e.artigo === "a" ? "uma" : "um"} ${e.singular} com esses dados.` : error.message;
    voltar(slug, "erro", msg, destino);
  }
  revalidatePath(`/cadastros/${slug}`);
  voltar(slug, "msg", `${e.singular[0].toUpperCase() + e.singular.slice(1)} ${id ? "atualizad" : "cadastrad"}${e.artigo} com sucesso.`);
}

export async function excluirCadastro(slug: string, id: string) {
  const e = entidade(slug);
  if (!e) return;
  const ctx = await contexto();
  const { error } = await ctx.supabase.from(e.tabela).delete().eq("id", id).eq("empresa_id", ctx.empresa.id);
  if (error) {
    voltar(slug, "erro", error.code === "23503"
      ? `Não dá para excluir: há contratos ou orçamentos ligados a ${e.artigo === "a" ? "esta" : "este"} ${e.singular}. Marque como inativo.`
      : error.message);
  }
  revalidatePath(`/cadastros/${slug}`);
  voltar(slug, "msg", "Registro excluído.");
}

// Importação de clientes por planilha (CSV salvo do Excel, separado por ; ou ,)
export async function importarClientes(fd: FormData) {
  const ctx = await contexto();
  const f = fd.get("arquivo");
  if (!(f instanceof File) || !f.size) voltar("clientes", "erro", "Escolha o arquivo CSV.");
  let txt = await (f as File).text();
  txt = txt.replace(/^﻿/, "");
  const linhas = txt.split(/\r?\n/).filter((l) => l.trim());
  if (linhas.length < 2) voltar("clientes", "erro", "A planilha precisa de uma linha de títulos e ao menos um cliente.");
  const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const partir = (l: string) => {
    const out: string[] = []; let cur = "", aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((x) => x.trim());
  };
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
  const MAPA: Record<string, string> = { nome: "nome", cliente: "nome", cpf: "cpf_cnpj", cnpj: "cpf_cnpj", cpfcnpj: "cpf_cnpj", documento: "cpf_cnpj",
    celular: "celular", whatsapp: "celular", telefone: "telefone", fone: "telefone", email: "email", cep: "cep", endereco: "logradouro", logradouro: "logradouro",
    numero: "numero", bairro: "bairro", cidade: "cidade", uf: "uf", estado: "uf", observacoes: "observacoes" };
  const cab = partir(linhas[0]).map((h) => MAPA[norm(h)]);
  if (!cab.includes("nome")) voltar("clientes", "erro", "Não encontrei a coluna Nome na primeira linha da planilha.");
  const regs = linhas.slice(1).map((l) => {
    const v = partir(l); const r: Record<string, any> = { empresa_id: ctx.empresa.id, created_by: ctx.userId };
    cab.forEach((k, i) => { if (k && v[i]) r[k] = v[i]; });
    if (r.uf) r.uf = String(r.uf).toUpperCase().slice(0, 2);
    r.endereco = enderecoTexto(r);
    return r;
  }).filter((r) => r.nome);
  for (let i = 0; i < regs.length; i += 500) {
    const { error } = await ctx.supabase.from("clientes").insert(regs.slice(i, i + 500));
    if (error) voltar("clientes", "erro", "Erro ao importar: " + error.message);
  }
  revalidatePath("/cadastros/clientes");
  voltar("clientes", "msg", `${regs.length} cliente(s) importado(s).`);
}
