import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";

// Link de confirmação de e-mail do Supabase cai aqui e vira sessão
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServidor();
    await supabase.auth.exchangeCodeForSession(code);
  }
  const next = req.nextUrl.searchParams.get("next") ?? "";
  const destino = next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  return NextResponse.redirect(new URL(destino, req.url));
}
