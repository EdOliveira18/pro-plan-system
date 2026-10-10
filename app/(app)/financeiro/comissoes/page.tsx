import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import { hojeISO } from "@/lib/financeiro";
import NavFin from "../NavFin";
import { gerarComissoes, pagarUm } from "../fin-acoes";

export default async function Comissoes({ searchParams }: { searchParams: Promise<{ q?: string; s?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: rows } = await ctx.supabase.from("lancamentos").select("id, descricao, entidade, valor, data, realizado, pago_em, categoria, contrato:contratos(id, codigo, cliente:clientes(nome), parceiro:parceiros(nome))")
    .eq("empresa_id", ctx.empresa.id).is("excluido_em", null).in("categoria", ["comissao_rt", "comissao_vendedor"]).order("data", { ascending: false }).limit(1000);
  const hoje = hojeISO();
  const t = (sp.q ?? "").toLowerCase().trim();
  const resp = (l: any) => l.entidade ?? l.contrato?.parceiro?.nome ?? "n/a";
  const L = ((rows ?? []) as any[]).filter((l) => (!sp.s || (sp.s === "pago" ? l.realizado : !l.realizado)) && (!t || [resp(l), l.contrato?.cliente?.nome, l.contrato?.codigo].some((x) => String(x ?? "").toLowerCase().includes(t))));
  const mesAnt = (() => { const d = new Date(hoje); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  return (<>
    <div className="head"><div><h1>Lista de Comissões</h1><p className="sub">Comissões de vendedores (faixas sobre o VPL) e RT de arquitetos, com vencimento e pagamento</p></div></div>
    <NavFin atual="/financeiro/comissoes" />
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <form action={gerarComissoes} className="panel" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <b>Lançar comissões dos vendedores</b><input type="month" name="mes" defaultValue={mesAnt} aria-label="Mês" /><button className="btn primary">Calcular e lançar</button>
      <span className="note">Usa as faixas Bronze, Prata e Ouro sobre o VPL vendido no mês e cria as contas a pagar com vencimento no dia 5 do mês seguinte. O RT dos arquitetos é lançado automaticamente quando o contrato é gerado.</span>
    </form>
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por funcionário ou arquiteto" style={{ flex: 1 }} aria-label="Buscar" />
        <select name="s" defaultValue={sp.s ?? ""} aria-label="Status"><option value="">Todas</option><option value="pendente">A pagar</option><option value="pago">Pagas</option></select><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Responsável</th><th>Referente ao contrato · cliente</th><th className="r">Valor da comissão</th><th>Status</th><th>Data vencimento</th><th>Data pagamento</th><th className="r" /></tr></thead>
        <tbody>{L.map((l) => (
          <tr key={l.id}><td><b>{resp(l)}</b><div className="note">{l.categoria === "comissao_rt" ? "Arquiteto (RT)" : "Vendedor"}</div></td>
            <td>{l.contrato ? <><Link className="idc" href={`/contratos/${l.contrato.id}`}>#{l.contrato.codigo}</Link> {l.contrato.cliente?.nome}</> : "n/a"}</td>
            <td className="r num">{brl(Math.abs(l.valor))}</td>
            <td><span className={"pill " + (l.realizado ? "p-good" : l.data < hoje ? "p-bad" : "p-warn")}>{l.realizado ? "Paga" : l.data < hoje ? "Atrasada" : "A pagar"}</span></td>
            <td className="num note">{data(l.data)}</td><td className="num note">{l.pago_em ? data(l.pago_em) : "n/a"}</td>
            <td className="r">{!l.realizado && <form action={pagarUm.bind(null, l.id)}><button className="btn sm">Pagar</button></form>}</td></tr>))}</tbody>
      </table></div>
      {!L.length && <div className="vazio"><b>Nenhuma comissão encontrada.</b></div>}
      <div className="cad-rod note">Mostrando {L.length} registro(s)</div>
    </div>
  </>);
}
