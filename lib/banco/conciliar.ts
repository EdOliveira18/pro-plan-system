// Conciliação automática: casa cada movimentação do banco com um lançamento previsto do sistema.
// Regra: mesmo sinal, mesmo valor (até 1 centavo de diferença) e data até N dias de distância.
// Se houver mais de um candidato, fica o de data mais próxima; empate de data vira pendente para a pessoa decidir.

export type Mov = { id: string; data: string; valor: number };
export type Previsto = { id: string; data: string; valor: number };

const dias = (a: string, b: string) => Math.abs(new Date(a + "T12:00:00").getTime() - new Date(b + "T12:00:00").getTime()) / 864e5;

export function conciliar(movs: Mov[], previstos: Previsto[], janelaDias = 5): Map<string, string> {
  const usados = new Set<string>();
  const pares = new Map<string, string>();
  // processa primeiro as movimentações com menos candidatos, para não "roubar" o par de outra
  const candidatos = movs.map((m) => ({
    m,
    cs: previstos
      .filter((p) => Math.sign(p.valor) === Math.sign(m.valor) && Math.abs(p.valor - m.valor) <= 0.01 && dias(p.data, m.data) <= janelaDias)
      .sort((a, b) => dias(a.data, m.data) - dias(b.data, m.data)),
  })).sort((a, b) => a.cs.length - b.cs.length);

  for (const { m, cs } of candidatos) {
    const livres = cs.filter((p) => !usados.has(p.id));
    if (!livres.length) continue;
    if (livres.length > 1 && dias(livres[0].data, m.data) === dias(livres[1].data, m.data)) continue; // ambíguo
    usados.add(livres[0].id);
    pares.set(m.id, livres[0].id);
  }
  return pares;
}

// Sugestões para a fila de pendentes: mesmo sinal, valor parecido (até 10%) e até 15 dias
export function sugerir(m: Mov, previstos: Previsto[], max = 3): Previsto[] {
  return previstos
    .filter((p) => Math.sign(p.valor) === Math.sign(m.valor) && Math.abs(p.valor - m.valor) <= Math.abs(m.valor) * 0.1 && dias(p.data, m.data) <= 15)
    .sort((a, b) => Math.abs(a.valor - m.valor) - Math.abs(b.valor - m.valor) || dias(a.data, m.data) - dias(b.data, m.data))
    .slice(0, max);
}
