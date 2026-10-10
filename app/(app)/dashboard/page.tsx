import Link from "next/link";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { hojeISO, somaDias } from "@/lib/tempo";
import { brl, pct, ETAPAS_WF } from "@/lib/formato";

export default async function Dashboard() {
  const ctx = await contexto();
  const sb = ctx.supabase;
  const eid = ctx.empresa.id;
  if (ctx.papel === "montador") redirect("/producao");
  const hoje = new Date();
  const hojeStr = hojeISO();
  const ini = hojeStr.slice(0, 8) + "01";
  const em30 = somaDias(hojeStr, 30);
  const doze = somaDias(hojeStr, -365);

  const [{ data: doMes }, { data: abertos }, { data: receber }, { data: atrasados }, { data: porCampanha }, { data: campanhas }] = await Promise.all([
    sb.from("contratos").select("valor_total, vpl, lucro_previsto").eq("empresa_id", eid).gte("data_venda", ini),
    sb.from("contratos").select("etapa_workflow").eq("empresa_id", eid).eq("encerrado", false),
    sb.from("lancamentos").select("valor").is("excluido_em", null).eq("empresa_id", eid).eq("categoria", "recebimento").eq("realizado", false).gte("data", hojeStr).lte("data", em30),
    sb.from("marcos").select("id, contrato:contratos!inner(marco_atual, encerrado)").eq("empresa_id", eid).is("concluido_em", null).lt("previsto_em", hojeStr),
    sb.from("contratos").select("campanha_id, valor_total, lucro_previsto").eq("empresa_id", eid).gte("data_venda", doze),
    sb.from("campanhas").select("id, nome, investimento").eq("empresa_id", eid),
  ]);

  const vendido = (doMes ?? []).reduce((s, c) => s + Number(c.valor_total), 0);
  const vpl = (doMes ?? []).reduce((s, c) => s + Number(c.vpl), 0);
  const lucro = (doMes ?? []).reduce((s, c) => s + Number(c.lucro_previsto), 0);
  const aReceber = (receber ?? []).reduce((s, l) => s + Number(l.valor), 0);
  const nAtrasados = (atrasados ?? []).filter((m: any) => !m.contrato.encerrado).length;
  const wf = ETAPAS_WF.map(([k, nome]) => ({ nome, n: (abertos ?? []).filter((c) => c.etapa_workflow === k).length }));

  const camp = (campanhas ?? []).map((c) => {
    const cs = (porCampanha ?? []).filter((x) => x.campanha_id === c.id);
    const luc = cs.reduce((s, x) => s + Number(x.lucro_previsto), 0);
    const inv = Number(c.investimento);
    return { nome: c.nome, vendas: cs.length, fat: cs.reduce((s, x) => s + Number(x.valor_total), 0), luc, inv, roi: inv > 0 ? luc / inv : null };
  }).sort((a, b) => b.luc - a.luc);

  return (
    <>
      <div className="head">
        <div><h1>Olá, {ctx.nome.split(" ")[0]}</h1><p className="sub">{hoje.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", month: "long", year: "numeric" })} · {ctx.empresa.nome}</p></div>
        <Link className="btn primary" href="/comercial">Novo orçamento</Link>
      </div>
      <div className="grid kpis">
        <div className="panel kpi"><div className="l">Vendido no mês</div><div className="v">{brl(vendido)}</div><div className="s">{(doMes ?? []).length} contrato(s)</div></div>
        <div className="panel kpi"><div className="l">Margem líquida prevista</div><div className="v">{vpl ? pct(lucro / vpl) : "n/a"}</div><div className="s">Lucro previsto {brl(lucro)}</div></div>
        <div className="panel kpi"><div className="l">A receber em 30 dias</div><div className="v">{["dono", "gerente", "financeiro"].includes(ctx.papel) ? brl(aReceber) : "restrito"}</div>{!["dono", "gerente", "financeiro"].includes(ctx.papel) && <div className="s">Visível para dono, gerente e financeiro</div>}</div>
        <div className="panel kpi"><div className="l">Marcos atrasados</div><div className="v" style={{ color: nAtrasados ? "var(--bad)" : undefined }}>{nAtrasados}</div><div className="s"><Link href="/radar">Abrir radar</Link></div></div>
      </div>
      <div className="panel mt">
        <h2>Workflow industrial</h2>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 8 }}>
          {wf.map((e) => (
            <Link key={e.nome} href="/radar?aba=workflow" style={{ background: "var(--sunk)", borderRadius: 9, padding: 10, textDecoration: "none", color: "var(--fg)" }}>
              <b className="num" style={{ fontSize: 20, display: "block" }}>{e.n}</b><span className="note">{e.nome}</span>
            </Link>
          ))}
        </div>
      </div>
      <div className="panel mt">
        <h2>Lucro por origem dos clientes (últimos 12 meses)</h2>
        <p className="note" style={{ margin: "-6px 0 12px" }}>A origem vem do cadastro do cliente e segue até o contrato. Cadastre o investimento de cada campanha para ver o retorno.</p>
        <div className="scroll"><table>
          <thead><tr><th>Campanha</th><th className="r">Investido</th><th className="r">Vendas</th><th className="r">Faturado</th><th className="r">Lucro previsto</th><th className="r">Retorno</th></tr></thead>
          <tbody>{camp.map((c) => (
            <tr key={c.nome}><td>{c.nome}</td><td className="r num">{brl(c.inv)}</td><td className="r num">{c.vendas}</td><td className="r num">{brl(c.fat)}</td><td className="r num">{brl(c.luc)}</td>
              <td className="r">{c.roi === null ? <span className="pill p-neu">sem mídia paga</span> : <span className={"pill " + (c.roi >= 5 ? "p-good" : "p-warn")}>{c.roi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}x</span>}</td></tr>
          ))}</tbody>
        </table></div>
      </div>
    </>
  );
}
