import Link from "next/link";
const ABAS: [string, string][] = [["/producao", "Ordens de produção"], ["/producao/pendentes", "Pendentes"], ["/producao/aguardando", "Aguardando início"], ["/producao/finalizadas", "Finalizadas"],
  ["/producao/canceladas", "Canceladas"], ["/producao/calendario", "Calendário"], ["/producao/dashboard", "Dashboard"], ["/cadastros/tipos-servico", "Tipos de serviços"], ["/cadastros/etapas-execucao", "Etapas de execução"]];
export default function NavProd({ atual }: { atual: string }) {
  return <nav className="abas" aria-label="Produção">{ABAS.map(([h, n]) => <Link key={h} href={h} aria-current={atual === h ? "page" : undefined}>{n}</Link>)}</nav>;
}
