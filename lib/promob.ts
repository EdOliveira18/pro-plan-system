// Leitura de arquivos exportados do Promob (XML ou TXT).
// O layout exato varia entre versões e configurações de exportação da fábrica, então o leitor é tolerante:
// procura nós de ambiente e soma o custo das peças dentro de cada um. Ajuste MAPA_* quando tiver arquivos reais.
import { XMLParser } from "fast-xml-parser";

export type PecaImportada = { codigo?: string; descricao: string; quantidade: number; custo_unitario: number };
export type AmbienteImportado = { nome: string; descricao?: string; custo_fabrica: number; pecas: PecaImportada[] };

const MAPA_AMBIENTE = /^(ambient|ambiente|environment|room|ambientes)$/i;
const MAPA_NOME = ["DESCRIPTION", "DESCRICAO", "NAME", "NOME", "description", "descricao", "name", "nome"];
const MAPA_PRECO = /^(price|preco|preço|custo|cost|valor|unitprice|precounitario|total|totalprice)$/i;
const MAPA_QTD = /^(quantity|quantidade|qtd|qty|qtde)$/i;
const MAPA_CODIGO = /^(reference|referencia|codigo|code|ref|id)$/i;

function num(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "").trim();
  if (!s) return 0;
  // aceita 1.234,56 e 1234.56
  const br = /,\d{1,4}$/.test(s);
  const limpo = br ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const x = parseFloat(limpo);
  return isFinite(x) ? x : 0;
}

type No = Record<string, unknown>;
const ehObj = (v: unknown): v is No => !!v && typeof v === "object" && !Array.isArray(v);

function atributo(no: No, re: RegExp): unknown {
  for (const [k, v] of Object.entries(no)) {
    const chave = k.replace(/^@_/, "");
    if (re.test(chave) && (typeof v === "string" || typeof v === "number")) return v;
  }
  return undefined;
}
function nomeDe(no: No): string | undefined {
  for (const k of MAPA_NOME) {
    const v = no["@_" + k] ?? no[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

// percorre a árvore coletando peças (nós que têm preço) sem contar duas vezes um total e seus filhos
function coletarPecas(no: unknown, saida: PecaImportada[]) {
  if (Array.isArray(no)) { no.forEach((x) => coletarPecas(x, saida)); return; }
  if (!ehObj(no)) return;
  const preco = atributo(no, MAPA_PRECO);
  const filhos = Object.entries(no).filter(([k, v]) => !k.startsWith("@_") && (ehObj(v) || Array.isArray(v)));
  const filhosComPreco = filhos.some(([, v]) => JSON.stringify(v).match(/"@_(price|preco|custo|cost|valor|total)/i));
  if (preco !== undefined && num(preco) > 0 && !filhosComPreco) {
    const qtd = num(atributo(no, MAPA_QTD) ?? 1) || 1;
    saida.push({
      codigo: atributo(no, MAPA_CODIGO) ? String(atributo(no, MAPA_CODIGO)) : undefined,
      descricao: nomeDe(no) ?? "Item",
      quantidade: qtd,
      custo_unitario: num(preco),
    });
    return;
  }
  filhos.forEach(([, v]) => coletarPecas(v, saida));
}

function acharAmbientes(no: unknown, saida: { nome: string; no: No }[], tag = "") {
  if (Array.isArray(no)) { no.forEach((x) => acharAmbientes(x, saida, tag)); return; }
  if (!ehObj(no)) return;
  if (MAPA_AMBIENTE.test(tag) && tag.toLowerCase() !== "ambientes") {
    saida.push({ nome: nomeDe(no) ?? `Ambiente ${saida.length + 1}`, no });
    return;
  }
  for (const [k, v] of Object.entries(no)) if (!k.startsWith("@_")) acharAmbientes(v, saida, k);
}

export function lerPromobXML(xml: string): AmbienteImportado[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", parseAttributeValue: false });
  const arvore = parser.parse(xml);
  const nos: { nome: string; no: No }[] = [];
  acharAmbientes(arvore, nos);
  // sem nó de ambiente: o arquivo inteiro é um ambiente só
  if (!nos.length) nos.push({ nome: "Projeto importado", no: arvore });
  return nos
    .map(({ nome, no }) => {
      const pecas: PecaImportada[] = [];
      coletarPecas(no, pecas);
      const custo = pecas.reduce((s, p) => s + p.quantidade * p.custo_unitario, 0);
      return { nome, custo_fabrica: Math.round(custo * 100) / 100, pecas };
    })
    .filter((a) => a.custo_fabrica > 0);
}

// TXT: uma linha por item, separada por ; ou tab. Formatos aceitos:
// Ambiente;Descrição;Quantidade;CustoUnitário  ou  Ambiente;Descrição;Custo  ou  Ambiente;Custo
export function lerPromobTXT(txt: string): AmbienteImportado[] {
  const mapa = new Map<string, AmbienteImportado>();
  for (const linha of txt.split(/\r?\n/)) {
    const p = linha.split(/[;\t]/).map((s) => s.trim());
    if (p.length < 2 || !p[0]) continue;
    const ultimo = num(p[p.length - 1]);
    if (ultimo <= 0) continue; // cabeçalho ou linha sem custo
    let descricao = p.length > 2 ? p[1] : p[0];
    let qtd = 1;
    if (p.length >= 4) { qtd = num(p[2]) || 1; }
    const amb = mapa.get(p[0]) ?? { nome: p[0], custo_fabrica: 0, pecas: [] };
    amb.pecas.push({ descricao, quantidade: qtd, custo_unitario: ultimo });
    amb.custo_fabrica = Math.round((amb.custo_fabrica + qtd * ultimo) * 100) / 100;
    mapa.set(p[0], amb);
  }
  return [...mapa.values()];
}

export function lerPromob(conteudo: string, nomeArquivo: string): AmbienteImportado[] {
  const ehXML = /\.xml$/i.test(nomeArquivo) || conteudo.trimStart().startsWith("<");
  return ehXML ? lerPromobXML(conteudo) : lerPromobTXT(conteudo);
}
