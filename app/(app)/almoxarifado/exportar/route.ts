import { NextResponse } from "next/server";
import { contexto } from "@/lib/contexto";

export async function GET() {
  const ctx = await contexto();
  const { data } = await ctx.supabase.from("produtos").select("codigo, nome, tipo, referencia, marca, unid_producao, estoque, estoque_minimo, valor_compra, outras_despesas, valor_final, ncm, categoria:categorias_produto(nome), fornecedor:pessoas(nome)")
    .eq("empresa_id", ctx.empresa.id).is("excluido_em", null).order("nome");
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const n = (v: unknown) => String(Number(v ?? 0)).replace(".", ",");
  const csv = [["Código", "Nome", "Tipo", "Categoria", "Referência", "Marca", "Unidade", "Estoque", "Estoque mínimo", "Valor compra", "Outras despesas", "Valor final", "NCM", "Fornecedor"].join(";"),
    ...((data ?? []) as any[]).map((p) => [esc(p.codigo), esc(p.nome), esc(p.tipo), esc(p.categoria?.nome), esc(p.referencia), esc(p.marca), esc(p.unid_producao), n(p.estoque), n(p.estoque_minimo), n(p.valor_compra), n(p.outras_despesas), n(p.valor_final), esc(p.ncm), esc(p.fornecedor?.nome)].join(";"))].join("\r\n");
  return new NextResponse("﻿" + csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="almoxarifado.csv"' } });
}
