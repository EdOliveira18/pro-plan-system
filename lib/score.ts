// Score de fechamento 0 a 100 e próximo passo, calculados por regras do ciclo de venda de planejados.
// Quando a IA estiver com créditos, ela pode substituir o resumo e o próximo passo usando o histórico.
export const ETAPAS_LEAD: [string, string][] = [
  ["novo", "Novo lead"],
  ["qualificado", "Qualificado"],
  ["briefing", "Briefing / visita"],
  ["projeto", "Projeto em criação"],
  ["apresentacao", "Apresentação"],
  ["negociacao", "Negociação"],
];

const BASE: Record<string, number> = { novo: 15, qualificado: 30, briefing: 45, projeto: 55, apresentacao: 65, negociacao: 75, ganho: 100, perdido: 0 };

const PASSO: Record<string, string> = {
  novo: "Ligar hoje, entender prazo da obra e marcar a visita ou o briefing.",
  qualificado: "Agendar o briefing com todos os decisores e pedir a planta do imóvel.",
  briefing: "Fazer a medição e alinhar faixa de investimento antes de projetar.",
  projeto: "Combinar a data da apresentação e confirmar quem vai estar presente.",
  apresentacao: "Apresentar com render e simular as condições no olhinho na frente do cliente.",
  negociacao: "Fechar dentro da pontuação mínima e enviar o contrato para assinatura.",
};

export function diasDesde(d?: string | null) {
  if (!d) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5));
}

export function pontuarLead(l: { etapa: string; valor_estimado?: number | string | null; ultimo_contato?: string | null; created_at: string; canal?: string | null }) {
  const parado = diasDesde(l.ultimo_contato ?? l.created_at);
  let s = BASE[l.etapa] ?? 10;
  if (l.canal === "indicacao") s += 10;
  if (Number(l.valor_estimado) >= 50000) s += 5;
  s -= Math.min(30, Math.max(0, parado - 2) * 3);
  const score = Math.max(1, Math.min(99, Math.round(s)));
  let passo = PASSO[l.etapa] ?? "";
  if (parado >= 7 && l.etapa !== "novo") passo = `Sem contato há ${parado} dias. Retomar com uma condição com prazo de validade. ` + passo;
  return { score, passo, parado };
}
