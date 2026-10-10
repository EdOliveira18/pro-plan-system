import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import { hojeISO, mesAtual } from "@/lib/financeiro";
import Confirmar from "@/components/Confirmar";
import NavFin from "../NavFin";
import { pagarSelecionados, pagarUm, estornarUm, excluirLancamento } from "../fin-acoes";

type SP = { tipo?: string; atraso?: string; de?: string; ate?: string; q?: string; o?: string; msg?: string };

export default async function Lancamentos({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const tipo = sp.tipo === "pagar" || sp.tipo === "receber" ? sp.tipo : "todos";
  const atraso = sp.atraso === "1";
  const hoje = hojeISO();
  const per = mesAtual();
  const de = sp.de ?? per.de, ate = sp.ate ?? per.ate;
  let q = ctx.supabase.from("lancamentos").select("id, data, descricao, entidade, valor, realizado, pago_em, forma_pagamento, documento, categoria, plano_conta, contrato:contratos(id, codigo, cliente:clientes(nome)), conta:contas_bancarias(nome)")
    .eq("empresa_id", ctx.empresa.id).is("excluido_em", null);
  if (tipo === "pagar") q = q.lt("valor", 0);
  if (tipo === "receber") q = q.gt("valor", 0);
  if (atraso) q = q.eq("realizado", false).lt("data", hoje);
  else q = q.gte("data", de).lte("data", ate);
  const ordem = sp.o ?? "data";
  const { data: rows, error } = await q.order(ordem === "valor" ? "valor" : ordem === "pago" ? "pago_em" : ordem === "descricao" ? "descricao" : "data", { ascending: true }).limit(2000);
  const t = (sp.q ?? "").toLowerCase().trim();
  const L = ((rows ?? []) as any[]).filter((l) => !t || [l.descricao, l.entidade, l.documento, l.contrato?.codigo, l.contrato?.cliente?.nome, String(Math.abs(l.valor)).replace(".", ",")].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const S = (f: (l: any) => boolean) => L.filter(f).reduce((a, l) => a + Math.abs(Number(l.valor)), 0);
  const recPagas = S((l) => l.valor > 0 && l.realizado), despPagas = S((l) => l.valor < 0 && l.realizado), recPend = S((l) => l.valor > 0 && !l.realizado), despPend = S((l) => l.valor < 0 && !l.realizado);
  const titulo = atraso ? (tipo === "receber" ? "Receitas em atraso" : "Despesas em atraso") : tipo === "pagar" ? "Contas a pagar" : tipo === "receber" ? "Contas a receber" : "Listagem de lançamentos";
  const atual = `/financeiro/lancamentos${tipo !== "todos" ? "?tipo=" + tipo : ""}${atraso ? "&atraso=1" : ""}`;
  const qs = (o: string) => `?${new URLSearchParams({ ...(tipo !== "todos" ? { tipo } : {}), ...(atraso ? { atraso: "1" } : { de, ate }), ...(sp.q ? { q: sp.q } : {}), o }).toString()}`;
  const Card = ({ tg, cls, v, l }: { tg: string; cls: string; v: number; l: string }) => <div className="panel kpi kcard"><span className={"tg " + cls}>{tg}</span><div className="v">{brl(v)}</div><div className="l">{l}</div></div>;
  return (<>
    <div className="head"><div><h1>{titulo}</h1><p className="sub">Gerencie seus lançamentos financeiros</p></div>
      <Link className="btn primary" href={`/financeiro/lancamentos/novo${tipo === "pagar" ? "?tipo=despesa" : tipo === "receber" ? "?tipo=receita" : ""}`}>Cadastrar</Link></div>
    <NavFin atual={atual} />
    {sp.msg && <div className="ok">{sp.msg}</div>}
    {error && <div className="erro">{/row-level|permission/i.test(error.message) ? "Seu perfil não tem acesso ao financeiro." : error.message}</div>}
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 16 }}>
      {tipo !== "pagar" && <Card tg="Receitas" cls="p-good" v={recPagas} l="Receitas pagas" />}
      {tipo !== "receber" && <Card tg="Despesas" cls="p-neu" v={despPagas} l="Despesas pagas" />}
      <div className="panel kpi kcard"><span className="tg p-info">Saldo do período</span><div className="v" style={{ color: recPagas - despPagas < 0 ? "var(--bad)" : undefined }}>{brl(recPagas - despPagas)}</div><div className="l">Saldo do período</div></div>
      {tipo !== "pagar" && <Card tg="Receitas" cls="p-warn" v={recPend} l="Receitas pendentes" />}
      {tipo !== "receber" && <Card tg="Despesas" cls="p-neu" v={despPend} l="Despesas pendentes" />}
      {tipo !== "todos" && <Card tg="Total" cls="p-good" v={tipo === "pagar" ? despPagas + despPend : recPagas + recPend} l="Total do período" />}
    </div>
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca">
        {tipo !== "todos" && <input type="hidden" name="tipo" value={tipo} />}{atraso && <input type="hidden" name="atraso" value="1" />}
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Pesquise por entidade, descrição, nº documento, contrato ou valor" style={{ flex: 1, minWidth: 220 }} aria-label="Buscar" />
        {!atraso && <><input type="date" name="de" defaultValue={de} aria-label="De" /><input type="date" name="ate" defaultValue={ate} aria-label="Até" /></>}
        <button className="btn">Filtrar</button>
      </form>
      <form action={pagarSelecionados}>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th style={{ width: 30 }} /><th><Link href={qs("descricao")}>Descrição ↑</Link></th><th><Link href={qs("data")}>Vencimento ↑</Link></th><th>Forma pagamento</th><th className="r"><Link href={qs("valor")}>Valor ↑</Link></th><th><Link href={qs("pago")}>Pagamento ↑</Link></th><th>Pago</th><th className="r">Ações</th></tr></thead>
          <tbody>{L.map((l) => {
            const atrasado = !l.realizado && l.data < hoje;
            return (<tr key={l.id}>
              <td>{!l.realizado && <input type="checkbox" name="ids" value={l.id} aria-label="Selecionar" />}</td>
              <td><Link href={`/financeiro/lancamentos/${l.id}`}><b>{l.descricao}</b></Link><div className="note">{[l.entidade, l.contrato ? `#${l.contrato.codigo} ${l.contrato.cliente?.nome ?? ""}` : null, l.documento].filter(Boolean).join(" · ")}</div></td>
              <td className="num" style={{ color: atrasado ? "var(--bad)" : undefined }}>{data(l.data)}</td>
              <td className="note">{l.forma_pagamento ?? "n/a"}</td>
              <td className="r num" style={{ color: l.valor < 0 ? "var(--bad)" : "var(--good)" }}>{l.valor < 0 ? "−" : "+"}{brl(Math.abs(l.valor))}</td>
              <td className="num note">{l.pago_em ? data(l.pago_em) : "n/a"}</td>
              <td><span className={"pill " + (l.realizado ? "p-good" : atrasado ? "p-bad" : "p-warn")}>{l.realizado ? "Pago" : atrasado ? "Atrasado" : "Pendente"}</span></td>
              <td className="r" style={{ whiteSpace: "nowrap" }}>
                {l.realizado ? <button className="btn sm" formAction={estornarUm.bind(null, l.id)}>Estornar</button> : <button className="btn sm" formAction={pagarUm.bind(null, l.id)}>Pagar</button>}{" "}
                <Confirmar className="btn sm" texto="Excluir este lançamento? Ele fica em Excluídos." formAction={excluirLancamento.bind(null, l.id)}>Excluir</Confirmar>
              </td>
            </tr>);
          })}</tbody>
        </table></div>
        {!L.length && <div className="vazio"><b>Nenhum lançamento encontrado.</b></div>}
        <div className="cad-rod" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <span className="note">Mostrando {L.length} registro(s)</span>
          {L.some((l) => !l.realizado) && <button className="btn sm">Marcar selecionados como pagos</button>}
        </div>
      </form>
    </div>
  </>);
}
