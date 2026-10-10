import Link from "next/link";
const ABAS: [string, string][] = [["/comercial", "Orçamentos"], ["/comercial/faturados", "Faturados"], ["/comercial/perdidos", "Perdidos"], ["/comercial/excluidos", "Excluídos"], ["/comercial/dashboard", "Dashboard"]];
export default function NavOrc({ atual }: { atual: string }) {
  return <nav className="abas" aria-label="Orçamentos">{ABAS.map(([h, n]) => <Link key={h} href={h} aria-current={atual === h ? "page" : undefined}>{n}</Link>)}</nav>;
}
