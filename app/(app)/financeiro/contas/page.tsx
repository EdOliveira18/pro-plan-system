import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { brl } from "@/lib/formato";
import NavFin from "../NavFin";

const TIPO: Record<string, string> = { corrente: "Conta corrente", cartao: "Cartão de crédito", poupanca: "Conta poupança", caixa: "Caixa / carteira" };

export default async function Contas({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const [{ data: contas }, { data: lancs }] = await Promise.all([
    ctx.supabase.from("contas_bancarias").select("*").eq("empresa_id", ctx.empresa.id).order("tipo").order("nome"),
    ctx.supabase.from("lancamentos").select("conta_id, valor, realizado, data").eq("empresa_id", ctx.empresa.id).is("excluido_em", null).not("conta_id", "is", null),
  ]);
  const saldo = (c: any) => c.origem === "pluggy" && c.saldo != null ? Number(c.saldo)
    : Number(c.saldo_inicial ?? 0) + ((lancs ?? []) as any[]).filter((l) => l.conta_id === c.id && l.realizado && (!c.data_inicial || l.data >= c.data_inicial)).reduce((a, l) => a + Number(l.valor), 0);
  const fatura = (c: any) => ((lancs ?? []) as any[]).filter((l) => l.conta_id === c.id && !l.realizado && l.valor < 0).reduce((a, l) => a - Number(l.valor), 0);
  return (<>
    <div className="head"><div><h1>Contas financeiras</h1><p className="sub">Bancos, cartões de crédito, poupança e caixa da loja</p></div><Link className="btn primary" href="/financeiro/contas/nova">Cadastrar</Link></div>
    <NavFin atual="/financeiro/contas" />
    {sp.msg && <div className="ok">{sp.msg}</div>}
    {!(contas ?? []).some((c: any) => c.tipo === "cartao") && <div className="erro">Você ainda não tem um cartão de crédito cadastrado. <Link href="/financeiro/contas/nova?tipo=cartao" style={{ color: "inherit", fontWeight: 700 }}>Cadastre o seu</Link>.</div>}
    <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
      {(contas ?? []).map((c: any) => (
        <div key={c.id} className="panel">
          <div className="note">{TIPO[c.tipo]}{c.origem === "pluggy" ? " · Open Finance" : c.origem === "ofx" ? " · extrato OFX" : ""}</div>
          <h2 style={{ margin: "4px 0" }}>{c.nome}</h2>
          <div className="note">{[c.banco, c.agencia && `ag. ${c.agencia}`, c.tipo === "cartao" ? c.bandeira && `${c.bandeira} final ${c.ultimos4}` : c.conta].filter(Boolean).join(" · ")}</div>
          {c.tipo === "cartao"
            ? <div className="row big"><span>Fatura em aberto</span><span className="num">{brl(fatura(c))}</span></div>
            : <div className="row big"><span>Saldo</span><span className="num" style={{ color: saldo(c) < 0 ? "var(--bad)" : undefined }}>{brl(saldo(c))}</span></div>}
          {c.tipo === "cartao" && <div className="note">Fecha dia {c.dia_fechamento ?? "n/a"} · vence dia {c.dia_vencimento ?? "n/a"}</div>}
        </div>))}
    </div>
    {!contas?.length && <div className="panel vazio"><b>Nenhuma conta cadastrada.</b><p>Cadastre a conta corrente, o cartão da empresa e o caixa da loja.</p></div>}
    <p className="note">Saldo = saldo inicial + lançamentos pagos vinculados à conta. Contas ligadas pelo Open Finance mostram o saldo do banco.</p>
  </>);
}
