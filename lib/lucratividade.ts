import { inicioMesesAtras } from "./tempo";
// Lucro real de cada contrato: VPL menos o que já saiu (ou está a pagar) no financeiro e as baixas de estoque.
// A comissão RT não entra como custo porque o VPL já é líquido dela.
export type LinhaLucro = {
  id: string; codigo: string; cliente: string; faturado: string; venda: number; vpl: number;
  recebido: number; aReceber: number; custoReal: number; custoPrevisto: number; estoque: number;
  lucro: number; margem: number | null; margemPrevista: number | null; semCusto: boolean;
};

export function lucratividade(contratos: any[], lancs: any[], movs: any[]): LinhaLucro[] {
  return contratos.map((k) => {
    const ls = lancs.filter((l) => l.contrato_id === k.id && !l.excluido_em);
    const recebido = ls.filter((l) => l.valor > 0 && l.realizado).reduce((a, l) => a + Number(l.valor), 0);
    const aReceber = ls.filter((l) => l.valor > 0 && !l.realizado).reduce((a, l) => a + Number(l.valor), 0);
    const lancCusto = ls.filter((l) => l.valor < 0 && l.categoria !== "comissao_rt").reduce((a, l) => a - Number(l.valor), 0);
    const estoque = movs.filter((m) => m.contrato_id === k.id && m.tipo === "saida").reduce((a, m) => a + Number(m.quantidade) * Number(m.custo_unit), 0);
    const custoReal = lancCusto + estoque;
    const vpl = Number(k.vpl);
    const lucro = vpl - custoReal;
    return {
      id: k.id, codigo: k.codigo, cliente: k.cliente?.nome ?? "", faturado: k.created_at, venda: Number(k.valor_total), vpl,
      recebido, aReceber, custoReal, custoPrevisto: Number(k.custo_previsto), estoque,
      lucro, margem: vpl > 0 ? lucro / vpl : null, margemPrevista: vpl > 0 ? Number(k.lucro_previsto) / vpl : null,
      semCusto: custoReal === 0,
    };
  });
}

export function inicioPeriodo(meses: number) {
  return new Date(inicioMesesAtras(meses));
}
