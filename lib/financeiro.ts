export const FORMAS: string[] = ["Pix", "Boleto", "Cartão de crédito", "Cartão de débito", "Transferência", "Dinheiro", "Cheque", "Débito automático"];
export const hojeISO = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // horário de Brasília
export function mesAtual() {
  const h = hojeISO(); const [a, m] = h.split("-").map(Number);
  return { de: `${a}-${String(m).padStart(2, "0")}-01`, ate: new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10) };
}
