import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { BANCOS } from "@/lib/cadastros";
import { hojeISO } from "@/lib/financeiro";
import { salvarConta } from "../../fin-acoes";

const TIPOS: [string, string, string][] = [["corrente", "Conta corrente", "Conta bancária do dia a dia"], ["cartao", "Cartão de crédito", "Compras e fatura mensal"], ["poupanca", "Conta poupança", "Reserva e rendimento"], ["caixa", "Caixa / carteira", "Dinheiro em espécie"]];

export default async function NovaConta({ searchParams }: { searchParams: Promise<{ tipo?: string; erro?: string }> }) {
  const sp = await searchParams;
  const tipo = TIPOS.some((t) => t[0] === sp.tipo) ? sp.tipo! : "corrente";
  const ctx = await contexto();
  const { data: contas } = await ctx.supabase.from("contas_bancarias").select("id, nome").eq("empresa_id", ctx.empresa.id).neq("tipo", "cartao");
  return (<>
    <nav className="migalha">Financeiro › Contas financeiras › Adicionar</nav>
    <div className="head"><div><h1>Cadastrar conta financeira</h1><p className="sub">Banco, caixa ou cartão de crédito</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <div className="panel" style={{ marginBottom: 14 }}><h2>1. Tipo de conta</h2>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>{TIPOS.map(([k, n, d]) => (
        <Link key={k} href={`/financeiro/contas/nova?tipo=${k}`} className="panel" style={{ textAlign: "center", textDecoration: "none", color: "inherit", borderColor: k === tipo ? "var(--accent)" : undefined, background: k === tipo ? "var(--accent-soft)" : undefined }}>
          <b style={{ textTransform: "uppercase", fontSize: 13 }}>{n}</b><div className="note">{d}</div></Link>))}</div></div>
    <form action={salvarConta} className="panel cad">
      <input type="hidden" name="tipo" value={tipo} />
      <h2 className="cad-h1">2. Dados da conta</h2>
      <div className="cad-grid">
        <label style={{ gridColumn: "span 2" }}><span>{tipo === "cartao" ? "Nome do cartão" : "Nome da conta"}</span><input name="nome" placeholder={tipo === "cartao" ? "Dê um nome para identificar este cartão" : tipo === "caixa" ? "Ex.: Caixa do showroom" : "Ex.: Itaú principal"} /></label>
        {tipo !== "caixa" && <label style={{ gridColumn: "span 2" }}><span>{tipo === "cartao" ? "Emissor do cartão" : "Banco"}<i className="obr">*</i></span><select name="banco" required defaultValue=""><option value="">Selecione o seu banco</option>{BANCOS.map(([k]) => <option key={k}>{k}</option>)}</select></label>}
        {tipo === "cartao" ? <>
          <label><span>Bandeira<i className="obr">*</i></span><select name="bandeira" required defaultValue=""><option value="">Selecione a bandeira</option>{["Visa", "Mastercard", "Elo", "American Express", "Hipercard"].map((b) => <option key={b}>{b}</option>)}</select></label>
          <label><span>Últimos 4 números<i className="obr">*</i></span><input name="ultimos4" required inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="0000" /></label>
          <label><span>Dia do fechamento<i className="obr">*</i></span><input type="number" name="dia_fechamento" min={1} max={31} required /></label>
          <label><span>Dia do vencimento<i className="obr">*</i></span><input type="number" name="dia_vencimento" min={1} max={31} required /></label>
          <label style={{ gridColumn: "span 2" }}><span>Conta padrão para pagamento</span><select name="conta_pagamento_id" defaultValue=""><option value="">Selecione a conta</option>{(contas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        </> : tipo !== "caixa" && <><label><span>Agência</span><input name="agencia" /></label><label><span>Conta</span><input name="conta" /></label></>}
      </div>
      <h3 className="cad-sec">3. Saldo inicial</h3>
      <div className="cad-grid">
        <label><span>Saldo inicial</span><input name="saldo_inicial" inputMode="decimal" placeholder="0,00" /></label>
        <label><span>Data inicial</span><input type="date" name="data_inicial" defaultValue={hojeISO()} /></label>
      </div>
      <div className="cad-acoes"><button className="btn primary">Salvar</button><Link className="btn" href="/financeiro/contas">Voltar</Link></div>
    </form>
  </>);
}
