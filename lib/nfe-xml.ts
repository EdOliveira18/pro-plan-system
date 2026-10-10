import { XMLParser } from "fast-xml-parser";

export type ItemNFe = { codigo: string; nome: string; ncm: string; cfop: string; unidade: string; quantidade: number; valorUnit: number; valorTotal: number };
export type NFeCompra = { chave: string; numero: string; serie: string; emissao: string | null; emitenteNome: string; emitenteCnpj: string; destCnpj: string; valor: number; itens: ItemNFe[] };

const arr = <T,>(x: T | T[] | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

// Lê o XML de uma NF-e (com ou sem nfeProc) e devolve cabeçalho e itens
export function lerNFe(xml: string): NFeCompra {
  const p = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", parseTagValue: false, removeNSPrefix: true });
  const doc = p.parse(xml);
  const inf = doc?.nfeProc?.NFe?.infNFe ?? doc?.NFe?.infNFe;
  if (!inf) throw new Error("Arquivo não parece ser o XML de uma NF-e.");
  const chave = String(inf["@Id"] ?? "").replace(/^NFe/, "") || String(doc?.nfeProc?.protNFe?.infProt?.chNFe ?? "");
  const n = (v: unknown) => Number(String(v ?? "0")) || 0;
  const itens = arr<any>(inf.det).map((d) => ({
    codigo: String(d.prod?.cProd ?? ""), nome: String(d.prod?.xProd ?? ""), ncm: String(d.prod?.NCM ?? ""), cfop: String(d.prod?.CFOP ?? ""),
    unidade: String(d.prod?.uCom ?? "UN").toUpperCase(), quantidade: n(d.prod?.qCom), valorUnit: n(d.prod?.vUnCom), valorTotal: n(d.prod?.vProd),
  }));
  const numero = String(inf.ide?.nNF ?? ""), serie = String(inf.ide?.serie ?? "");
  const emit = String(inf.emit?.CNPJ ?? inf.emit?.CPF ?? "");
  // sem chave no XML (arquivo incompleto) usa emitente + série + número, para a mesma nota não entrar duas vezes
  const chaveFinal = chave || `SEM-CHAVE-${emit}-${serie}-${numero}`;
  return {
    chave: chaveFinal, numero, serie,
    emissao: String(inf.ide?.dhEmi ?? inf.ide?.dEmi ?? "").slice(0, 10) || null,
    emitenteNome: String(inf.emit?.xFant ?? inf.emit?.xNome ?? ""), emitenteCnpj: String(inf.emit?.CNPJ ?? inf.emit?.CPF ?? ""),
    destCnpj: String(inf.dest?.CNPJ ?? inf.dest?.CPF ?? ""),
    valor: n(inf.total?.ICMSTot?.vNF), itens,
  };
}
