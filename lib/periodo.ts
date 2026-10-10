import { hojeISO } from "./tempo";
// Mês de referência vindo da URL (?mes=2026-10), com início e fim para filtrar no banco
export function periodo(mes?: string) {
  const [a, m] = (mes && /^\d{4}-\d{2}$/.test(mes) ? mes : hojeISO().slice(0, 7)).split("-").map(Number);
  const ini = new Date(Date.UTC(a, m - 1, 1));
  const fim = new Date(Date.UTC(a, m, 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const chave = `${a}-${String(m).padStart(2, "0")}`;
  const ant = new Date(Date.UTC(a, m - 2, 1)), prox = new Date(Date.UTC(a, m, 1));
  const ch = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return {
    chave, inicio: iso(ini), fim: iso(fim), anterior: ch(ant), proximo: ch(prox),
    nome: ini.toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }),
  };
}

export const nomeMembro = (membros: { user_id: string; nome: string }[] | null, id?: string | null) =>
  membros?.find((m) => m.user_id === id)?.nome ?? "Sem vendedor";
