export const brl = (v: number | string | null | undefined) =>
  (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v: number) => (v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + "%";
export const dec = (v: number, casas = 2) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
// datas só com dia (AAAA-MM-DD) não mudam de fuso; carimbos com hora são mostrados no horário de Brasília
export const data = (v: string | Date | null | undefined) =>
  v ? (typeof v === "string" && v.length === 10 ? new Date(v + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC" }) : new Date(v).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })) : "";

export const MARCOS: Record<string, string> = {
  medicao: "Medição",
  liberacao: "Liberação técnica",
  fabricacao: "Fabricação",
  material: "Material na loja",
  montagem: "Montagem",
  conclusao: "Conclusão",
};
export const ETAPAS_WF: [string, string][] = [
  ["pedido_liberado", "Pedido liberado"],
  ["projeto_executivo", "Projeto executivo"],
  ["compra_material", "Compra de material"],
  ["corte_usinagem", "Corte e usinagem"],
  ["montagem_fabrica", "Montagem na fábrica"],
  ["expedicao", "Expedição"],
  ["entregue", "Entregue"],
];
export const ASSINATURA: Record<string, string> = { pendente: "Pendente", enviado: "Link enviado", assinado: "Assinado", recusado: "Recusado" };

export function diasAte(d: string): number {
  const alvo = new Date(d + "T12:00:00").getTime();
  const hoje = new Date();
  hoje.setHours(12, 0, 0, 0);
  return Math.round((alvo - hoje.getTime()) / 864e5);
}

// Lê valor digitado no padrão brasileiro: "R$ 20.000,00", "20.000", "20000,5", "20000.50"
export function lerValor(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  let s = String(v ?? "").replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, "");
  const x = parseFloat(s);
  return isFinite(x) ? x : 0;
}
