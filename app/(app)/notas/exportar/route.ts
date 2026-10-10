import { NextResponse, type NextRequest } from "next/server";
import { contexto } from "@/lib/contexto";

// Planilha (CSV, abre no Excel) das notas com os mesmos filtros da tela
export async function GET(req: NextRequest) {
  const ctx = await contexto();
  const sp = req.nextUrl.searchParams;
  const { data } = await ctx.supabase.from("notas_fiscais").select("*, contrato:contratos(codigo, cliente:clientes(nome))").eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false });
  const q = (sp.get("q") ?? "").toLowerCase();
  const linhas = ((data ?? []) as any[]).filter((n) =>
    (!q || [n.destinatario, n.contrato?.cliente?.nome, n.chave, n.numero].some((x) => String(x ?? "").toLowerCase().includes(q))) &&
    (!sp.get("tipo") || n.tipo === sp.get("tipo")) && (!sp.get("status") || n.status === sp.get("status")));
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [
    ["Tipo", "Série", "Número", "Chave", "Destinatário", "Contrato", "Emissão", "Situação", "Valor"].join(";"),
    ...linhas.map((n) => [n.tipo, n.serie, n.numero, n.chave, n.destinatario ?? n.contrato?.cliente?.nome, n.contrato?.codigo,
      n.emitida_em ? new Date(n.emitida_em).toLocaleDateString("pt-BR") : "", n.status, Number(n.valor).toFixed(2).replace(".", ",")].map(esc).join(";")),
  ].join("\r\n");
  return new NextResponse("﻿" + csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="notas-fiscais.csv"` },
  });
}
