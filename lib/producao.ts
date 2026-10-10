export const ETAPAS_OP: [string, string][] = [
  ["agendada", "Agendada"], ["plano_corte", "Plano de corte"], ["corte", "Corte"], ["usinagem", "Usinagem / furação"],
  ["fita", "Fita de borda"], ["montagem", "Pré-montagem"], ["acabamento", "Acabamento"], ["embalagem", "Embalagem"], ["expedicao", "Expedição"],
];
export const NOME_ETAPA = Object.fromEntries(ETAPAS_OP);
export const STATUS_OP: Record<string, [string, string]> = {
  aguardando: ["Aguardando início", "p-neu"], em_producao: ["Em produção", "p-info"], pausada: ["Pausada", "p-warn"], finalizada: ["Finalizada", "p-good"], cancelada: ["Cancelada", "p-bad"],
};
export const atrasada = (op: { previsao_fim?: string | null; status: string; finalizada_em?: string | null }) =>
  !!op.previsao_fim && (op.status === "finalizada" ? !!op.finalizada_em && op.finalizada_em.slice(0, 10) > op.previsao_fim : !["cancelada"].includes(op.status) && new Date().toISOString().slice(0, 10) > op.previsao_fim);
export const dias = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5)) : null);
