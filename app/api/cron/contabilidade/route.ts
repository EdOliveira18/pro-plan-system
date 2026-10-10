import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { enviarContabilidade } from "@/lib/contabilidade";

// Disparado pela Vercel todo dia 1º (vercel.json). A Vercel envia "Authorization: Bearer CRON_SECRET".
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const sb = supabaseAdmin();
  const { data: cfgs } = await sb.from("config_fiscal").select("empresa_id").eq("envio_contabilidade", true).not("email_contabilidade", "is", null);
  const resultado: any[] = [];
  for (const c of cfgs ?? []) {
    try { resultado.push({ empresa: c.empresa_id, ...(await enviarContabilidade(sb, c.empresa_id)) }); }
    catch (e: any) { resultado.push({ empresa: c.empresa_id, erro: e.message }); }
  }
  return NextResponse.json({ enviados: resultado.length, resultado });
}
