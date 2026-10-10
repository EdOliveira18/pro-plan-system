import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import { FORMAS, hojeISO } from "@/lib/financeiro";
import NavFin from "../NavFin";
import { salvarRecorrencia, alternarRecorrencia, gerarRecorrentes } from "../fin-acoes";

export default async function Recorrentes({ searchParams }: { searchParams: Promise<{ tipo?: string; msg?: string; erro?: string }> }) {
  const sp = await searchParams;
  const tipo = sp.tipo === "despesa" ? "despesa" : "receita";
  const ctx = await contexto();
  const [{ data: recs }, { data: planos }] = await Promise.all([
    ctx.supabase.from("recorrencias").select("*").eq("empresa_id", ctx.empresa.id).eq("tipo", tipo).order("dia"),
    ctx.supabase.from("plano_contas").select("codigo, nome, tipo").eq("empresa_id", ctx.empresa.id).order("codigo"),
  ]);
  const ativas = (recs ?? []).filter((r: any) => r.ativa);
  return (<>
    <div className="head"><div><h1>{tipo === "receita" ? "Receitas" : "Despesas"} recorrentes</h1><p className="sub">{tipo === "receita" ? "Entradas que se repetem todo mês" : "Aluguel, salários, sistemas, contador e outras contas fixas"}. Gere os lançamentos do mês com um clique.</p></div></div>
    <NavFin atual="/financeiro/recorrentes?tipo=receita" />
    <nav className="abas"><Link href="/financeiro/recorrentes?tipo=receita" aria-current={tipo === "receita" ? "page" : undefined}>Receitas recorrentes</Link><Link href="/financeiro/recorrentes?tipo=despesa" aria-current={tipo === "despesa" ? "page" : undefined}>Despesas recorrentes</Link></nav>
    {sp.msg && <div className="ok">{sp.msg}</div>}{sp.erro && <div className="erro">{sp.erro}</div>}
    <div className="grid two">
      <div className="panel" style={{ padding: 0 }}>
        <form action={gerarRecorrentes.bind(null, tipo)} className="cad-busca"><b style={{ alignSelf: "center" }}>Total mensal {brl(ativas.reduce((a: number, r: any) => a + Number(r.valor), 0))}</b><span style={{ flex: 1 }} />
          <input type="month" name="mes" defaultValue={hojeISO().slice(0, 7)} aria-label="Mês" /><button className="btn primary">Gerar lançamentos do mês</button></form>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Descrição</th><th>Dia</th><th className="r">Valor</th><th>Vigência</th><th>Situação</th><th /></tr></thead>
          <tbody>{(recs ?? []).map((r: any) => (
            <tr key={r.id}><td><b>{r.descricao}</b><div className="note">{[r.entidade, r.forma_pagamento, r.plano_conta].filter(Boolean).join(" · ")}</div></td><td className="num">{r.dia}</td>
              <td className="r num">{brl(r.valor)}</td><td className="note num">{data(r.inicio)}{r.fim ? ` a ${data(r.fim)}` : " em diante"}</td>
              <td><span className={"pill " + (r.ativa ? "p-good" : "p-neu")}>{r.ativa ? "Ativa" : "Pausada"}</span></td>
              <td className="r"><form action={alternarRecorrencia.bind(null, r.id, !r.ativa)}><button className="btn sm">{r.ativa ? "Pausar" : "Ativar"}</button></form></td></tr>))}</tbody>
        </table></div>
        {!recs?.length && <div className="vazio"><b>Nenhuma {tipo} recorrente.</b></div>}
      </div>
      <form action={salvarRecorrencia.bind(null, tipo)} className="panel grid" style={{ gap: 10, alignContent: "start" }}>
        <h2 style={{ margin: 0 }}>Nova {tipo} recorrente</h2>
        <label>Descrição<input name="descricao" required placeholder={tipo === "despesa" ? "Ex.: Aluguel do showroom" : "Ex.: Locação de espaço"} /></label>
        <label>Entidade<input name="entidade" /></label>
        <div style={{ display: "flex", gap: 8 }}><label style={{ flex: 1 }}>Valor<input name="valor" inputMode="decimal" required /></label><label style={{ width: 90 }}>Dia<input type="number" name="dia" min={1} max={31} defaultValue={5} /></label></div>
        <div style={{ display: "flex", gap: 8 }}><label style={{ flex: 1 }}>Início<input type="date" name="inicio" defaultValue={hojeISO()} /></label><label style={{ flex: 1 }}>Fim (opcional)<input type="date" name="fim" /></label></div>
        <label>Forma de pagamento<select name="forma_pagamento" defaultValue=""><option value="">Selecione</option>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label>Plano de contas<select name="plano_conta" defaultValue=""><option value="">Selecione</option>{(planos ?? []).filter((p: any) => (tipo === "receita") === (p.tipo === "receita")).map((p: any) => <option key={p.codigo} value={p.codigo}>{p.codigo} {p.nome}</option>)}</select></label>
        <button className="btn primary">Salvar recorrência</button>
      </form>
    </div>
  </>);
}
