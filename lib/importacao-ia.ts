import "server-only";
import type { AmbienteImportado } from "./promob";

// Lê qualquer orçamento/projeto (PDF, foto, print, CSV, planilha colada) e devolve os ambientes.
// O texto do PDF é extraído no navegador; páginas escaneadas e fotos chegam como imagem.

const INSTRUCAO = `Você recebe o orçamento ou projeto de uma loja de móveis planejados (relatório do Promob, PDF de fábrica, planilha, print ou foto).
Extraia cada AMBIENTE (cozinha, dormitório casal, banheiro social, lavanderia, home theater, closet etc.).
Para cada ambiente devolva:
- nome: nome do ambiente
- custo_fabrica: custo de fábrica / custo do pedido / valor de compra da fábrica, em reais (número). 0 se o documento não trouxer custo.
- valor_venda: preço de venda / valor ao cliente / valor vendido daquele ambiente, em reais (número). 0 se não houver.
- prazo_dias: prazo de entrega em dias se houver, senão 0
- descricao: até 120 caracteres resumindo o que tem no ambiente (opcional)
Regras: não invente valores; não some o total geral como se fosse um ambiente; se o documento só tiver o valor total do projeto, devolva um único ambiente "Projeto completo" com esse total; valores em formato brasileiro (20.000,00) devem virar 20000.
Responda só com JSON no formato {"ambientes":[{"nome":"","custo_fabrica":0,"valor_venda":0,"prazo_dias":0,"descricao":""}],"valor_total_vendido":0}`;

type Entrada = { texto?: string; imagem?: { base64: string; mime: string } };

export async function extrairAmbientesIA(e: Entrada): Promise<{ ambientes: AmbienteImportado[]; valorTotal: number }> {
  const chave = process.env.OPENAI_API_KEY;
  if (!chave) throw new Error("A leitura por IA precisa da OPENAI_API_KEY configurada na Vercel.");

  const conteudo: unknown[] = [];
  if (e.texto) conteudo.push({ type: "text", text: e.texto.slice(0, 120_000) });
  if (e.imagem) conteudo.push({ type: "image_url", image_url: { url: `data:${e.imagem.mime};base64,${e.imagem.base64}` } });
  if (!conteudo.length) throw new Error("O arquivo está vazio.");

  const modelos = [...new Set([process.env.OPENAI_TEXT_MODEL || "gpt-4.1-mini", "gpt-4o-mini"])];
  let ultimoErro = "";
  for (const modelo of modelos) {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: INSTRUCAO }, { role: "user", content: conteudo }],
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      ultimoErro = json?.error?.message || `HTTP ${resp.status}`;
      if (/model|not found|does not exist/i.test(ultimoErro)) continue;
      if (/credit|billing|quota|insufficient/i.test(ultimoErro)) throw new Error("A conta da OpenAI está sem créditos. Adicione créditos em platform.openai.com e tente de novo.");
      throw new Error(`A IA não conseguiu ler o arquivo: ${ultimoErro}`);
    }
    let dados: any = {};
    try { dados = JSON.parse(json.choices?.[0]?.message?.content || "{}"); } catch { /* resposta inválida */ }
    const num = (v: unknown) => { const x = Number(v); return isFinite(x) && x > 0 ? Math.round(x * 100) / 100 : 0; };
    const ambientes: AmbienteImportado[] = (Array.isArray(dados.ambientes) ? dados.ambientes : [])
      .filter((a: any) => a && String(a.nome || "").trim())
      .map((a: any) => ({
        nome: String(a.nome).trim().slice(0, 120),
        descricao: a.descricao ? String(a.descricao).slice(0, 200) : undefined,
        custo_fabrica: num(a.custo_fabrica),
        valor_venda: num(a.valor_venda) || undefined,
        prazo_dias: Math.round(num(a.prazo_dias)) || undefined,
        pecas: [],
      }));
    return { ambientes, valorTotal: num(dados.valor_total_vendido) };
  }
  throw new Error(`A IA não conseguiu ler o arquivo: ${ultimoErro}`);
}
