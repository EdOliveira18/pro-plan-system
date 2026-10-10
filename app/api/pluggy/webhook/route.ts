import { NextResponse, after, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sincronizarConexao } from "@/lib/banco/processar";

export const runtime = "nodejs";
export const maxDuration = 60;

function segredoOk(recebido: string | null) {
  const esperado = process.env.PLUGGY_WEBHOOK_SECRET ?? "";
  if (!recebido || !esperado || recebido.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));
}

// A Pluggy avisa aqui quando o banco tem movimentação nova ou a conexão muda.
// Respondemos 200 na hora (limite de 10 s da Pluggy) e processamos logo em seguida.
export async function POST(req: NextRequest) {
  if (!segredoOk(req.nextUrl.searchParams.get("s"))) return NextResponse.json({ ok: false }, { status: 401 });
  const ev = await req.json().catch(() => null);
  if (!ev?.event) return NextResponse.json({ ok: false }, { status: 400 });

  after(async () => {
    try {
      const sb = supabaseAdmin();
      if (String(ev.event).startsWith("transactions/") && ev.accountId) {
        // acha a conexão pela conta que recebeu a movimentação
        const { data: conta } = await sb.from("contas_bancarias").select("conexao_id").eq("externo_id", ev.accountId).maybeSingle();
        const { data: cx } = conta?.conexao_id
          ? await sb.from("conexoes_bancarias").select("id, empresa_id, item_id").eq("id", conta.conexao_id).maybeSingle()
          : ev.itemId ? await sb.from("conexoes_bancarias").select("id, empresa_id, item_id").eq("item_id", ev.itemId).maybeSingle() : { data: null };
        if (cx && ev.event !== "transactions/deleted") {
          await sincronizarConexao(sb, cx, { contaExterna: ev.accountId, ids: Array.isArray(ev.transactionIds) && ev.transactionIds.length <= 500 ? ev.transactionIds : undefined });
        }
      } else if (String(ev.event).startsWith("item/") && ev.itemId) {
        const { data: cx } = await sb.from("conexoes_bancarias").select("id, empresa_id, item_id").eq("item_id", ev.itemId).maybeSingle();
        if (!cx) return;
        if (ev.event === "item/deleted") {
          await sb.from("conexoes_bancarias").update({ status: "DELETED" }).eq("id", cx.id);
        } else if (ev.event === "item/error") {
          await sb.from("conexoes_bancarias").update({ status: "ERROR", erro: ev.error?.message ?? "Erro na conexão com o banco" }).eq("id", cx.id);
        } else {
          await sincronizarConexao(sb, cx, { desde: new Date(Date.now() - 15 * 864e5).toISOString().slice(0, 10) });
        }
      }
    } catch (e) {
      console.error("[pluggy-webhook]", ev.event, (e as Error).message);
    }
  });
  return NextResponse.json({ ok: true });
}
