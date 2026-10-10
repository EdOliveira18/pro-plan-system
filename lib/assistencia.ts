export const STATUS_AT: [string, string, string][] = [["aberto", "Aguardando agendamento", "p-warn"], ["agendado", "Agendado", "p-info"], ["em_atendimento", "Em atendimento", "p-info"], ["resolvido", "Concluído", "p-good"]];
export const ST_AT = Object.fromEntries(STATUS_AT.map(([k, n, c]) => [k, [n, c]])) as Record<string, [string, string]>;
export const MODALIDADES: [string, string][] = [["reparo", "Reparo"], ["garantia", "Garantia"], ["ajuste", "Ajuste"], ["revisao", "Revisão"], ["instalacao", "Instalação complementar"], ["troca", "Troca de peça"]];
export const MOD = Object.fromEntries(MODALIDADES);
