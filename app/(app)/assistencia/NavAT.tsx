import Link from "next/link";
export default function NavAT({ atual }: { atual: string }) {
  return <nav className="abas">{[["/assistencia", "Assistências"], ["/assistencia/dashboard", "Dashboard"]].map(([h, n]) => <Link key={h} href={h} aria-current={atual === h ? "page" : undefined}>{n}</Link>)}</nav>;
}
