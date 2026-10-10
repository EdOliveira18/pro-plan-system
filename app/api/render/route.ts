import { NextResponse, type NextRequest } from "next/server";
import { supabaseServidor } from "@/lib/supabase/server";
import { promptRender } from "@/lib/render-prompt";

export const runtime = "nodejs";
export const maxDuration = 300; // geração de imagem pode levar mais de um minuto

// Gera o render de um registro já criado em `renders`. A RLS garante que o usuário só processa renders da própria empresa.
export async function POST(req: NextRequest) {
  const sb = await supabaseServidor();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ erro: "Faça login." }, { status: 401 });

  const { renderId } = await req.json();
  const { data: r } = await sb.from("renders").select("*, origem:arquivos!renders_origem_arquivo_id_fkey(storage_path, mime)").eq("id", renderId).single();
  if (!r) return NextResponse.json({ erro: "Render não encontrado." }, { status: 404 });

  const falhar = async (erro: string, status = 500) => {
    await sb.from("renders").update({ status: "erro", erro }).eq("id", renderId);
    return NextResponse.json({ erro }, { status });
  };

  const chave = process.env.OPENAI_API_KEY;
  if (!chave) return falhar("A chave da IA de imagem (OPENAI_API_KEY) não está configurada no servidor.", 503);

  await sb.from("renders").update({ status: "processando", erro: null }).eq("id", renderId);

  const origem = (r as any).origem;
  const baixado = await sb.storage.from("arquivos").download(origem.storage_path);
  if (baixado.error) return falhar("Não consegui ler a imagem de origem: " + baixado.error.message);

  const imagem = new File([await baixado.data.arrayBuffer()], "origem.png", { type: origem.mime || "image/png" });
  const prompt = promptRender(r.tipo_origem, r.ambiente ?? "", r.estilo ?? "", r.instrucoes ?? "");
  // tenta o modelo configurado e, se a conta não tiver acesso a ele, cai para os modelos de imagem mais comuns
  const modelos = [...new Set([process.env.OPENAI_IMAGE_MODEL || "gpt-image-2", "gpt-image-1", "gpt-image-1-mini"])];
  let b64: string | undefined;
  let modelo = modelos[0];
  for (const m of modelos) {
    modelo = m;
    const fd = new FormData();
    fd.set("model", m);
    fd.set("prompt", prompt);
    fd.set("image", imagem);
    fd.set("size", "1536x1024");
    fd.set("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
    fd.set("n", "1");
    try {
      const resp = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${chave}` }, body: fd });
      const json = await resp.json();
      if (resp.ok) { b64 = json?.data?.[0]?.b64_json; break; }
      const msg = String(json?.error?.message ?? resp.statusText);
      const codigo = String(json?.error?.code ?? "");
      if (/credit|billing|quota|insufficient/i.test(msg + codigo)) return falhar("A conta da OpenAI está sem créditos. Adicione créditos em platform.openai.com, em Settings › Billing, e clique em Refazer.", 402);
      if (/invalid.?api.?key|incorrect api key/i.test(msg + codigo)) return falhar("A chave da OpenAI configurada na Vercel (OPENAI_API_KEY) é inválida ou foi revogada.", 401);
      if (/verif/i.test(msg)) return falhar("A OpenAI exige verificar a organização para usar modelos de imagem. Faça a verificação em platform.openai.com, em Settings › Organization › General, e clique em Refazer.", 403);
      if (/model|not found|does not exist|access/i.test(msg) && m !== modelos[modelos.length - 1]) continue;
      return falhar("A IA recusou o pedido: " + msg);
    } catch (e) {
      return falhar("Falha de conexão com a IA de imagem: " + (e as Error).message);
    }
  }
  if (!b64) return falhar("A IA não devolveu imagem.");

  const caminho = `${r.empresa_id}/renders/${r.id}-${Date.now()}.png`;
  const up = await sb.storage.from("arquivos").upload(caminho, Buffer.from(b64, "base64"), { contentType: "image/png" });
  if (up.error) return falhar("Não consegui salvar o render: " + up.error.message);

  const { data: arq, error } = await sb.from("arquivos").insert({
    empresa_id: r.empresa_id, contrato_id: r.contrato_id, orcamento_id: r.orcamento_id, tipo: "render",
    nome: `Render ${r.ambiente ?? ""}`.trim() + ".png", storage_path: caminho, mime: "image/png", created_by: user.id,
  }).select("id").single();
  if (error) return falhar(error.message);

  await sb.from("renders").update({ status: "concluido", resultado_arquivo_id: arq.id, provedor: "openai", modelo, concluido_em: new Date().toISOString() }).eq("id", renderId);
  return NextResponse.json({ ok: true });
}
