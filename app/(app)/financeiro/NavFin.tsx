import Link from "next/link";
const ITENS: [string, string][] = [["/financeiro/lancamentos", "Lançamentos"], ["/financeiro/lancamentos?tipo=pagar", "Contas a pagar"], ["/financeiro/lancamentos?tipo=receber", "Contas a receber"],
  ["/financeiro/lancamentos?tipo=receber&atraso=1", "Receitas em atraso"], ["/financeiro/lancamentos?tipo=pagar&atraso=1", "Despesas em atraso"], ["/financeiro/recorrentes?tipo=receita", "Recorrentes"],
  ["/financeiro/comissoes", "Comissões"], ["/financeiro?aba=banco", "Extrato e conciliação"], ["/financeiro?aba=contratos", "DRE por contrato"], ["/financeiro", "Fluxo de caixa"],
  ["/financeiro/contas", "Contas financeiras"], ["/financeiro/excluidos", "Excluídos"]];
export default function NavFin({ atual }: { atual: string }) {
  return <nav className="abas" aria-label="Financeiro">{ITENS.map(([h, n]) => <Link key={h} href={h} aria-current={atual === h ? "page" : undefined}>{n}</Link>)}</nav>;
}
