import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarEmail, moldura, esc, type Anexo } from "./email";

// Monta e envia ao contador as notas do mês de referência (padrão: mês anterior), com planilha, XML e DANFE anexos.
export async function enviarContabilidade(sb: SupabaseClient, empresaId: string, ref?: { ano: number; mes: number }) {
  const hoje = new Date();
  const alvo = ref ?? (() => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1); return { ano: d.getFullYear(), mes: d.getMonth() + 1 }; })();
  const ini = new Date(Date.UTC(alvo.ano, alvo.mes - 1, 1, 3)).toISOString();
  const fim = new Date(Date.UTC(alvo.ano, alvo.mes, 1, 3)).toISOString();
  const rotulo = `${String(alvo.mes).padStart(2, "0")}/${alvo.ano}`;

  const [{ data: emp }, { data: cfg }, { data: notas }] = await Promise.all([
    sb.from("empresas").select("nome, razao_social, cnpj, email_fiscal").eq("id", empresaId).single(),
    sb.from("config_fiscal").select("email_contabilidade").eq("empresa_id", empresaId).maybeSingle(),
    sb.from("notas_fiscais").select("tipo, serie, numero, chave, destinatario, valor, status, emitida_em, xml_path, pdf_path")
      .eq("empresa_id", empresaId).in("status", ["autorizada", "cancelada"]).gte("emitida_em", ini).lt("emitida_em", fim).order("emitida_em"),
  ]);
  const para = cfg?.email_contabilidade;
  if (!para) throw new Error("Informe o e-mail do contador nas configurações fiscais.");
  const lista = (notas ?? []) as any[];

  const anexos: Anexo[] = [];
  const csv = ["Tipo;Série;Número;Chave;Destinatário;Emissão;Situação;Valor",
    ...lista.map((n) => [n.tipo, n.serie, n.numero, n.chave, n.destinatario, n.emitida_em?.slice(0, 10), n.status, Number(n.valor).toFixed(2).replace(".", ",")]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))].join("\r\n");
  anexos.push({ filename: `notas-${alvo.ano}-${String(alvo.mes).padStart(2, "0")}.csv`, content: Buffer.from("﻿" + csv).toString("base64") });
  let bytes = 0;
  for (const n of lista) for (const p of [n.xml_path, n.pdf_path].filter(Boolean)) {
    const { data: f } = await sb.storage.from("arquivos").download(p);
    if (!f) continue;
    const b = Buffer.from(await f.arrayBuffer());
    bytes += b.length;
    if (bytes > 30 * 1024 * 1024) break; // limite de anexos do provedor (40 MB) com folga
    anexos.push({ filename: p.split("/").pop()!, content: b.toString("base64") });
  }

  const total = lista.filter((n) => n.status === "autorizada").reduce((a, n) => a + Number(n.valor), 0);
  const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const linhas = lista.map((n) => `<tr><td>${esc(n.tipo)}</td><td>${esc(n.serie)}-${esc(n.numero)}</td><td>${esc(n.destinatario)}</td><td>${esc(n.status)}</td><td style="text-align:right">${brl(Number(n.valor))}</td></tr>`).join("");
  const html = moldura(`Notas fiscais de ${rotulo}`, `
    <p>Olá! Seguem as notas fiscais de <b>${esc(emp?.razao_social || emp?.nome)}</b> (CNPJ ${esc(emp?.cnpj)}) referentes a <b>${rotulo}</b>.</p>
    ${lista.length ? `<table style="width:100%;border-collapse:collapse;font-size:13px" cellpadding="6"><tr style="background:#F3F2EE;text-align:left"><th>Tipo</th><th>Nº</th><th>Destinatário</th><th>Situação</th><th style="text-align:right">Valor</th></tr>${linhas}</table>
    <p><b>Total autorizado: ${brl(total)}</b> em ${lista.filter((n) => n.status === "autorizada").length} nota(s).</p>`
    : `<p>Não houve notas fiscais emitidas neste período.</p>`}
    <p style="font-size:12px;color:#67706B">Em anexo: planilha do período${anexos.length > 1 ? ", XML e DANFE de cada nota" : ""}.</p>`);
  await enviarEmail({ para: para.split(/[;,\s]+/).filter(Boolean), assunto: `Notas fiscais ${rotulo}, ${emp?.razao_social || emp?.nome}`, html, anexos, responderPara: emp?.email_fiscal ?? undefined });
  return { rotulo, quantidade: lista.length, para };
}
