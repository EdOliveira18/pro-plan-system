// Tudo que é "hoje" e toda data/hora exibida seguem o horário de Brasília, independente do servidor (que roda em UTC)
export const FUSO = "America/Sao_Paulo";

/** Data de hoje em Brasília no formato AAAA-MM-DD */
export function hojeISO(base: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(base);
}
/** Soma dias a uma data AAAA-MM-DD */
export function somaDias(iso: string, dias: number) {
  const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
/** Primeiro e último dia do mês atual (Brasília) */
export function mesAtual() {
  const [a, m] = hojeISO().split("-").map(Number);
  return { de: `${a}-${String(m).padStart(2, "0")}-01`, ate: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) };
}
/** Data e hora em Brasília, para carimbos como "excluído em" */
export function dataHora(v: string | Date | null | undefined) {
  return v ? new Date(v).toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
}
/** Início (00:00 de Brasília) de N meses atrás, em ISO */
export function inicioMesesAtras(meses: number) {
  const [a, m, d] = hojeISO().split("-").map(Number);
  const x = new Date(Date.UTC(a, m - 1 - meses, d, 3)); // 00:00 em Brasília = 03:00 UTC
  return x.toISOString();
}
