import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data, ETAPAS_WF } from "@/lib/formato";
import NavOrc from "../NavOrc";

export default async function Faturados({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  let q = ctx.supabase.from("orcamentos").select("id, numero, nome_projeto, faturado_em, data_entrega, calculo, cliente:clientes(nome), contratos(id, codigo, valor_total, etapa_workflow)")
    .eq("empresa_id", ctx.empresa.id).eq("status", "fechado").order("faturado_em", { ascending: false }).limit(1000);
  if (sp.de) q = q.gte("faturado_em", sp.de);
  if (sp.ate) q = q.lte("faturado_em", sp.ate + "T23:59:59");
  const { data: rows } = await q;
  const t = (sp.q ?? "").toLowerCase().trim();
  const lista = ((rows ?? []) as any[]).filter((o) => !t || [o.cliente?.nome, o.nome_projeto, String(o.numero), o.contratos?.[0]?.codigo].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const valor = (o: any) => Number(o.contratos?.[0]?.valor_total ?? o.calculo?.valorProposta ?? 0);
  const total = lista.reduce((a, o) => a + valor(o), 0);
  const wf = Object.fromEntries(ETAPAS_WF);
  return (
    <>
      <div className="head"><div><h1>Orçamentos Faturados</h1><p className="sub">Todos os orçamentos que viraram contrato</p></div></div>
      <NavOrc atual="/comercial/faturados" />
      <div className="grid k3" style={{ marginBottom: 16 }}>
        <div className="panel kpi kcard"><span className="tg p-good">Total</span><div className="v">{lista.length}</div><div className="l">Orçamentos faturados</div></div>
        <div className="panel kpi kcard"><span className="tg p-good">Faturamento</span><div className="v">{brl(total)}</div><div className="l">Valor total</div></div>
        <div className="panel kpi kcard"><span className="tg p-info">Média</span><div className="v">{brl(lista.length ? total / lista.length : 0)}</div><div className="l">Ticket médio</div></div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar contrato, cliente ou número" style={{ flex: 1 }} aria-label="Buscar" />
          <input type="date" name="de" defaultValue={sp.de ?? ""} aria-label="De" /><input type="date" name="ate" defaultValue={sp.ate ?? ""} aria-label="Até" /><button className="btn">Filtrar</button></form>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Nº</th><th>Cliente</th><th>Faturado</th><th>Data entrega</th><th className="r">Valor total</th><th>Status</th><th className="r">Ações</th></tr></thead>
          <tbody>{lista.map((o) => { const k = o.contratos?.[0]; return (
            <tr key={o.id}>
              <td className="num"><b>{o.numero}</b></td>
              <td><b>{o.cliente?.nome}</b><div className="note">{o.nome_projeto}</div></td>
              <td className="num note">{o.faturado_em ? data(o.faturado_em) : "n/a"}</td>
              <td className="num note">{o.data_entrega ? data(o.data_entrega) : "n/a"}</td>
              <td className="r num">{brl(valor(o))}</td>
              <td>{k ? <><Link className="idc" href={`/contratos/${k.id}`}>#{k.codigo}</Link> <span className="pill p-neu">{wf[k.etapa_workflow]}</span></> : "n/a"}</td>
              <td className="r">{k && <Link className="btn sm" href={`/contratos/${k.id}`}>Abrir contrato</Link>}</td>
            </tr>); })}</tbody>
        </table></div>
        {!lista.length && <div className="vazio"><b>Nenhum orçamento faturado encontrado.</b></div>}
        <div className="cad-rod note">Mostrando {lista.length} registro(s)</div>
      </div>
    </>
  );
}
