"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  cad: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.5" /><path d="M5.5 16.5c.6-1.8 2-2.8 3.5-2.8s2.9 1 3.5 2.8M15 9h3M15 13h3" /></>,
  nf: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5" /></>,
  cfg: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  box: <><path d="M21 8l-9-5-9 5v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
  prod: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  truck: <><path d="M1 4h13v12H1zM14 8h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="2" /><circle cx="17.5" cy="18.5" r="2" /></>,
  tool: <><path d="M3 21l7-7M14 4l6 6-3 3-6-6zM10 14l-3-3" /></>,
  star: <path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.3l6-.8z" />,
  fin: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
};

type Sub = [string, string];
type Item = { href: string; nome: string; icone: string; novo?: boolean; filhos?: Sub[]; base?: string[] };

const MENU: { grupo: string; itens: Item[] }[] = [
  { grupo: "Visão geral", itens: [
    { href: "/dashboard", nome: "Dashboard", icone: "dash" },
    { href: "/ranking", nome: "Ranking / Metas", icone: "ranking" },
    { href: "/relatorios", nome: "Relatórios", icone: "rel" },
  ]},
  { grupo: "Gestão", itens: [
    { href: "/cadastros", nome: "Cadastros", icone: "cad", filhos: [["/cadastros/clientes", "Clientes"], ["/cadastros/arquitetos", "Arquitetos"], ["/cadastros/funcionarios", "Funcionários"], ["/cadastros/leads", "Leads"],
      ["/cadastros/socios", "Sócios"], ["/cadastros/fornecedores", "Fornecedores"], ["/cadastros/impostos", "Impostos"], ["/cadastros/transportadoras", "Transportadoras"]], base: ["/contratos"] },
    { href: "/crm", nome: "CRM Pro", icone: "crm", novo: true },
    { href: "/comercial", nome: "Orçamentos", icone: "com", filhos: [["/comercial", "Orçamentos"], ["/comercial/faturados", "Faturados"], ["/comercial/perdidos", "Perdidos"], ["/comercial/excluidos", "Excluídos"], ["/comercial/dashboard", "Dashboard"]] },
    { href: "/lucratividade", nome: "Lucratividade", icone: "rel", novo: true },
    { href: "/render", nome: "Render Pro", icone: "render" },
    { href: "/radar", nome: "Radar de Prazos", icone: "radar" },
    { href: "/almoxarifado", nome: "Almoxarifado", icone: "box", filhos: [["/cadastros/produtos", "Almoxarifado"], ["/almoxarifado/compras", "Pedidos de compra"], ["/almoxarifado/notas-compra", "Notas de compra"],
      ["/almoxarifado/saidas", "Pedidos de saída"], ["/cadastros/categorias-produto", "Categorias"], ["/cadastros/naturezas", "Natureza de entrada"], ["/cadastros/produtos?lixeira=1", "Excluídos"]], base: ["/cadastros/produtos", "/cadastros/categorias-produto", "/cadastros/naturezas"] },
    { href: "/producao", nome: "Produção", icone: "prod", filhos: [["/producao", "Ordens de produção"], ["/producao/pendentes", "Pendentes"], ["/producao/aguardando", "Aguardando início"], ["/producao/finalizadas", "Finalizadas"],
      ["/producao/canceladas", "Canceladas"], ["/producao/calendario", "Calendário"], ["/producao/dashboard", "Dashboard"], ["/cadastros/tipos-servico", "Tipos de serviços"], ["/cadastros/etapas-execucao", "Etapas de execução"]], base: ["/cadastros/tipos-servico", "/cadastros/etapas-execucao"] },
    { href: "/entregas", nome: "Entregas", icone: "truck", filhos: [["/entregas", "Entregas"], ["/cadastros/status-entrega", "Status"]], base: ["/cadastros/status-entrega"] },
    { href: "/assistencia", nome: "Assistência Técnica", icone: "at", filhos: [["/assistencia", "Assistências"], ["/assistencia/dashboard", "Dashboard"]] },
    { href: "/cadastros/ferramentas", nome: "Ferramentaria", icone: "tool", base: ["/ferramentas"] },
    { href: "/pos-venda", nome: "Pós-venda", icone: "star" },
  ]},
  { grupo: "Administrativo", itens: [
    { href: "/financeiro", nome: "Financeiro", icone: "fin", filhos: [["/financeiro/lancamentos", "Lançamentos"], ["/financeiro/lancamentos?tipo=pagar", "Contas a pagar"], ["/financeiro/lancamentos?tipo=receber", "Contas a receber"],
      ["/financeiro/lancamentos?tipo=receber&atraso=1", "Receitas em atraso"], ["/financeiro/lancamentos?tipo=pagar&atraso=1", "Despesas em atraso"], ["/financeiro/recorrentes?tipo=receita", "Receitas recorrentes"],
      ["/financeiro/recorrentes?tipo=despesa", "Despesas recorrentes"], ["/financeiro?aba=banco", "Extrato e conciliação"], ["/financeiro?aba=contratos", "DRE por contrato"], ["/financeiro", "Fluxo de caixa"],
      ["/financeiro/comissoes", "Comissões"], ["/financeiro/contas", "Contas financeiras"], ["/financeiro/excluidos", "Excluídos"]] },
    { href: "/notas", nome: "Notas fiscais", icone: "nf" },
    { href: "/equipe", nome: "Equipe", icone: "cli" },
    { href: "/configuracoes", nome: "Configurações", icone: "cfg", filhos: [["/empresa", "Dados da empresa e fiscal"], ["/configuracoes/orcamentos", "Orçamentos"], ["/cadastros/plano-contas", "Plano de contas"], ["/financeiro/contas", "Contas financeiras"]], base: ["/empresa", "/cadastros/plano-contas"] },
  ]},
];

export default function Sidebar({ empresa, empresas, nome, email }: { empresa: Empresa; empresas: Empresa[]; nome: string; email: string }) {
  const path = usePathname();
  const router = useRouter();
  const busca = useSearchParams();
  // subitem ativo: mesma rota e mesmos parâmetros principais (tipo/atraso/aba/lixeira)
  const subAtivo = (h: string) => {
    const [rota, qs] = h.split("?");
    if (path !== rota && !(path.startsWith(rota + "/") && !qs && rota !== "/comercial" && rota !== "/producao" && rota !== "/financeiro")) return false;
    const pq = new URLSearchParams(qs ?? "");
    return ["tipo", "atraso", "aba", "lixeira"].every((k) => (pq.get(k) ?? "") === (busca.get(k) ?? ""));
  };
  const dentro = (it: Item) => (it.base ?? []).some((b) => path.startsWith(b)) || (it.filhos
    ? it.filhos.some(([h]) => { const r = h.split("?")[0]; return path === r || (r !== "/financeiro" && path.startsWith(r + "/")); }) || (it.href !== "/cadastros" && path.startsWith(it.href + "/"))
    : path === it.href || path.startsWith(it.href + "/"));
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
            {g.itens.map((it) => it.filhos ? (
              <details key={it.href} open={dentro(it) || undefined}>
                <summary aria-current={dentro(it) ? "true" : undefined}><svg viewBox="0 0 24 24">{I[it.icone]}</svg>{it.nome}{it.novo && <span className="tag">NOVO</span>}<svg className="seta" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg></summary>
                {it.filhos.map(([h, n]) => <Link key={h} href={h} className="sub" aria-current={subAtivo(h) ? "page" : undefined}>{n}</Link>)}
              </details>
            ) : (
              <Link key={it.href} href={it.href} aria-current={dentro(it) ? "page" : undefined}>
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
