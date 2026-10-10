// O "olhinho": cálculo de VPL, custos e margem de um orçamento.
// Função pura usada no navegador (ao vivo) e no servidor (no fechamento, que é a fonte da verdade).

export type Config = {
  pontuacao_minima: number;
  frete_pct: number;
  comissao_loja_pct: number;
  montagem_pct: number;
  impostos_pct: number;
  outros_pct: number;
  boleto_pct: number;
  taxas_cartao: Record<string, number>;
};

export type AmbienteCalc = { custo_fabrica: number; pontuacao: number };

export type Condicoes = {
  desconto_pct: number;
  forma_pagamento: "avista" | "boleto" | "cartao";
  parcelas: number;
  rt_pct: number;
};

export type ResultadoOlhinho = {
  custoFabrica: number;
  valorTabela: number;
  valorProposta: number;
  taxaPagamentoPct: number;
  taxaPagamento: number;
  valorRT: number;
  vpl: number;
  custos: { chave: string; nome: string; valor: number }[];
  custoTotal: number;
  lucro: number;
  margem: number;
  markup: number;
  pontuacaoMedia: number;
  travado: boolean;
};

const n = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? 0))) || 0;
const r2 = (v: number) => Math.round(v * 100) / 100;

export function taxaCartao(cfg: Config, parcelas: number): number {
  const t = cfg.taxas_cartao || {};
  if (t[String(parcelas)] != null) return n(t[String(parcelas)]);
  // fora da tabela: usa a maior faixa conhecida
  const chaves = Object.keys(t).map(Number).filter((x) => !isNaN(x)).sort((a, b) => a - b);
  return chaves.length ? n(t[String(chaves[chaves.length - 1])]) : 0;
}

export function calcularOlhinho(ambientes: AmbienteCalc[], cond: Condicoes, cfgIn: Config): ResultadoOlhinho {
  const cfg = { ...cfgIn };
  const custoFabrica = ambientes.reduce((s, a) => s + n(a.custo_fabrica), 0);
  const valorTabela = ambientes.reduce((s, a) => s + n(a.custo_fabrica) * n(a.pontuacao), 0);
  const valorProposta = valorTabela * (1 - n(cond.desconto_pct) / 100);

  const taxaPagamentoPct =
    cond.forma_pagamento === "cartao" ? taxaCartao(cfg, cond.parcelas) : cond.forma_pagamento === "boleto" ? n(cfg.boleto_pct) : 0;
  const taxaPagamento = valorProposta * (taxaPagamentoPct / 100);
  const liquidoTaxa = valorProposta - taxaPagamento;
  const valorRT = liquidoTaxa * (n(cond.rt_pct) / 100);
  const vpl = liquidoTaxa - valorRT;

  const frete = custoFabrica * (n(cfg.frete_pct) / 100);
  const custos = [
    { chave: "fabrica", nome: "Fábrica", valor: custoFabrica },
    { chave: "frete", nome: "Frete", valor: frete },
    { chave: "comissao_loja", nome: "Comissão loja", valor: vpl * (n(cfg.comissao_loja_pct) / 100) },
    { chave: "montagem", nome: "Montagem", valor: vpl * (n(cfg.montagem_pct) / 100) },
    { chave: "impostos", nome: "Impostos saída", valor: vpl * (n(cfg.impostos_pct) / 100) },
    { chave: "outros", nome: "Outros", valor: vpl * (n(cfg.outros_pct) / 100) },
  ].map((c) => ({ ...c, valor: r2(c.valor) }));
  const custoTotal = custos.reduce((s, c) => s + c.valor, 0);
  const lucro = vpl - custoTotal;
  const pontuacaoMedia = custoFabrica > 0 ? valorProposta / custoFabrica : 0;

  return {
    custoFabrica: r2(custoFabrica),
    valorTabela: r2(valorTabela),
    valorProposta: r2(valorProposta),
    taxaPagamentoPct,
    taxaPagamento: r2(taxaPagamento),
    valorRT: r2(valorRT),
    vpl: r2(vpl),
    custos,
    custoTotal: r2(custoTotal),
    lucro: r2(lucro),
    margem: vpl > 0 ? lucro / vpl : 0,
    markup: custoFabrica + frete > 0 ? vpl / (custoFabrica + frete) : 0,
    pontuacaoMedia,
    travado: custoFabrica > 0 && pontuacaoMedia < n(cfg.pontuacao_minima),
  };
}
