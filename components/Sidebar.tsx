"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { trocarEmpresa } from "@/app/(app)/acoes-gerais";
import { sair } from "@/app/login/actions";
import type { Empresa } from "@/lib/contexto";

const I: Record<string, React.ReactNode> = {
  dash: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  ranking: <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8M18 2H6v7a6 6 0 0 0 12 0V2Z" />,
  rel: <><path d="M22 7l-8.5 8.5-5-5L2 17" /><path d="M16 7h6v6" /></>,
  cli: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>,
  crm: <><path d="M3 11l18-5v12L3 14z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>,
  com: <><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></>,
  render: <><path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z" /><path d="M19 3v4M17 5h4" /></>,
  radar: <><path d="M21 10V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h5M16 2v4M8 2v4M3 10h7" /><circle cx="17" cy="17" r="5" /><path d="M17 15v2l1.5 1" /></>,
  at: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  fin: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
};

// "pronto: true" = módulo previsto, ainda não construído nesta fase
const MENU: { grupo: string; itens: { href: string; nome: string; icone: string; pronto: boolean; novo?: boolean }[] }[] = [
  { grupo: "Visão geral", itens: [
    { href: "/dashboard", nome: "Dashboard", icone: "dash", pronto: true },
    { href: "/ranking", nome: "Ranking / Metas", icone: "ranking", pronto: true },
    { href: "/relatorios", nome: "Relatórios", icone: "rel", pronto: true },
  ]},
  { grupo: "Gestão", itens: [
    { href: "/clientes", nome: "Clientes", icone: "cli", pronto: true },
    { href: "/crm", nome: "CRM Pro", icone: "crm", pronto: true, novo: true },
    { href: "/comercial", nome: "Comercial", icone: "com", pronto: true },
    { href: "/render", nome: "Render Pro", icone: "render", pronto: true },
    { href: "/radar", nome: "Radar de Prazos", icone: "radar", pronto: true },
    { href: "/assistencia", nome: "Assistência Técnica", icone: "at", pronto: true },
  ]},
  { grupo: "Administrativo", itens: [
    { href: "/financeiro", nome: "Financeiro", icone: "fin", pronto: true },
    { href: "/equipe", nome: "Equipe", icone: "cli", pronto: true },
  ]},
];

export default function Sidebar({ empresa, empresas, nome, email }: { empresa: Empresa; empresas: Empresa[]; nome: string; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const ativo = (href: string) => path === href || path.startsWith(href + "/") || (href === "/clientes" && path.startsWith("/contratos"));
  return (
    <aside className="side">
      <div className="brand"><div className="mk">PP</div><div><b>Pro Plan System</b><small>ERP de planejados</small></div></div>
      <div className="company">
        <select aria-label="Empresa" value={empresa.id} onChange={async (e) => {
          if (e.target.value === "__nova") { router.push("/onboarding?nova=1"); return; }
          await trocarEmpresa(e.target.value); router.refresh();
        }}>
          {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          <option value="__nova">+ Adicionar empresa</option>
        </select>
        <small>{empresa.cnpj ?? "CNPJ não informado"}</small>
      </div>
      <nav className="menu" aria-label="Módulos">
        {MENU.map((g) => (
          <div key={g.grupo} style={{ display: "contents" }}>
            <div className="navlabel">{g.grupo}</div>
            {g.itens.map((it) => (
              <Link key={it.href} href={it.href} className={it.pronto ? "" : "off"} aria-current={ativo(it.href) ? "page" : undefined}
                title={it.pronto ? undefined : "Próxima fase"}>
                <svg viewBox="0 0 24 24">{I[it.icone]}</svg>{it.nome}{it.novo && <span className="tag">NOVO</span>}
              </Link>
            ))}
          </div>
        ))}
      </nav>
      <div className="user">
        <div className="avatar">{(nome || email).slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}><b>{nome}</b><small>{email}</small></div>
        <form action={sair}><button>Sair</button></form>
      </div>
    </aside>
  );
}
