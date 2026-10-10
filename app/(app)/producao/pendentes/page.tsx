import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import NavProd from "../NavProd";

// Contratos que ainda não têm ordem de produção
export default async function Pendentes({ searchParams }: { searchParams: Promise<{ aba?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const [{ data: ks }, { data: ops }] = await Promise.all([
    ctx.supabase.from("contratos").select("id, codigo, etapa_workflow, cliente:clientes(nome), marcos(tipo, previsto_em, concluido_em)").eq("empresa_id", ctx.empresa.id).neq("etapa_workflow", "entregue").order("created_at", { ascending: false }),
    ctx.supabase.from("ordens_producao").select("contrato_id").eq("empresa_id", ctx.empresa.id).neq("status", "cancelada"),
  ]);
  const comOP = new Set((ops ?? []).map((o: any) => o.contrato_id));
  const hoje = new Date().toISOString().slice(0, 10);
  const entrega = (k: any) => (k.marcos ?? []).find((m: any) => m.tipo === "conclusao")?.previsto_em ?? null;
  const t = (sp.q ?? "").toLowerCase().trim();
  const todos = ((ks ?? []) as any[]).filter((k) => !comOP.has(k.id) && (!t || [k.codigo, k.cliente?.nome].some((x) => String(x ?? "").toLowerCase().includes(t))));
  const atrasadas = todos.filter((k) => entrega(k) && entrega(k) < hoje);
  const lista = sp.aba === "atrasadas" ? atrasadas : todos.filter((k) => !entrega(k) || entrega(k) >= hoje);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Pendentes</nav><h1>Produção Pendentes</h1><p className="sub">Contratos vendidos que ainda não têm ordem de produção</p></div></div>
    <NavProd atual="/producao/pendentes" />
    <div className="panel" style={{ padding: 0 }}>
      <div className="cad-busca">
        <nav className="abas" style={{ margin: 0 }}><Link href="/producao/pendentes" aria-current={sp.aba !== "atrasadas" ? "page" : undefined}>Pendentes</Link><Link href="/producao/pendentes?aba=atrasadas" aria-current={sp.aba === "atrasadas" ? "page" : undefined}>Atrasadas ({atrasadas.length})</Link></nav>
        <form style={{ flex: 1 }}>{sp.aba && <input type="hidden" name="aba" value={sp.aba} />}<input name="q" defaultValue={sp.q ?? ""} placeholder="Código do contrato ou nome do cliente" style={{ width: "100%" }} aria-label="Buscar" /></form>
      </div>
      <div className="cad-aviso" style={{ margin: 14 }}>{sp.aba === "atrasadas" ? "Contratos cuja data de entrega já passou e ainda não têm OP." : <>Esta aba mostra contratos com entrega a partir de hoje. Os com data vencida estão em <b>Atrasadas</b>.</>}</div>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Cliente</th><th>Data entrega</th><th>Nº contrato</th><th className="r">Ações</th></tr></thead>
        <tbody>{lista.map((k) => (
          <tr key={k.id}><td><b>{k.cliente?.nome}</b></td>
            <td className="num" style={{ color: entrega(k) && entrega(k) < hoje ? "var(--bad)" : undefined }}>{entrega(k) ? data(entrega(k)) : "n/a"}</td>
            <td><Link className="idc" href={`/contratos/${k.id}`}>#{k.codigo}</Link></td>
            <td className="r"><Link className="btn primary sm" href={`/producao/nova?contrato=${k.id}${entrega(k) ? "&fim=" + entrega(k) : ""}`}>Criar OP</Link></td></tr>))}</tbody>
      </table></div>
      {!lista.length && <div className="vazio"><b>Nenhuma produção pendente encontrada.</b></div>}
    </div>
  </>);
}
