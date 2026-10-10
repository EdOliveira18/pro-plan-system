import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { FORMAS } from "@/lib/financeiro";

async function salvar(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const n = (k: string) => Math.max(0, Math.round(Number(fd.get(k) || 0)));
  const s = (k: string) => String(fd.get(k) || "") || null;
  const { error } = await ctx.supabase.from("configuracoes").update({
    dias_entrega: n("dias_entrega"), dias_uteis_montagem: n("dias_uteis_montagem"), dias_uteis_entrega: n("dias_uteis_entrega"), garantia_meses: n("garantia_meses"),
    dias_primeira_parcela: n("dias_primeira_parcela"), forma_entrada: s("forma_entrada"), modo_parcelas: s("modo_parcelas"), fatura_cartao: s("fatura_cartao"),
    faturar_sem_documento: s("faturar_sem_documento"), faturar_sem_endereco: s("faturar_sem_endereco"), margem_minima_pct: Number(String(fd.get("margem_minima_pct") || 20).replace(",", ".")),
    conta_receitas: s("conta_receitas"), conta_comissao_vendedor: s("conta_comissao_vendedor"), conta_comissao_arquiteto: s("conta_comissao_arquiteto"), conta_imposto: s("conta_imposto"), imposto_faturamento: s("imposto_faturamento"),
  }).eq("empresa_id", ctx.empresa.id);
  revalidatePath("/configuracoes/orcamentos");
  redirect("/configuracoes/orcamentos?" + (error ? "erro=" + encodeURIComponent("Somente dono ou gerente altera as configurações.") : "msg=" + encodeURIComponent("Configurações salvas.")));
}

export default async function ConfigOrc({ searchParams }: { searchParams: Promise<{ msg?: string; erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const [{ data: c }, { data: planos }, { data: imps }] = await Promise.all([
    ctx.supabase.from("configuracoes").select("*").eq("empresa_id", ctx.empresa.id).single(),
    ctx.supabase.from("plano_contas").select("codigo, nome, tipo").eq("empresa_id", ctx.empresa.id).order("codigo"),
    ctx.supabase.from("impostos").select("sigla, nome").eq("empresa_id", ctx.empresa.id).order("sigla"),
  ]);
  if (!c) return null;
  const Plano = ({ n, tipo }: { n: string; tipo?: string }) => <select name={n} defaultValue={c[n] ?? ""}><option value="">Selecione</option>{(planos ?? []).filter((p: any) => !tipo || p.tipo === tipo).map((p: any) => <option key={p.codigo} value={p.codigo}>{p.codigo} {p.nome}</option>)}</select>;
  return (<>
    <nav className="migalha">Configurações › Orçamentos</nav>
    <div className="head"><div><h1>Configurações de orçamentos</h1><p className="sub">Prazos, parcelas, regras de faturamento e plano de contas usados ao gerar contratos</p></div>
      <div style={{ display: "flex", gap: 8 }}><Link className="btn" href="/comercial">Premissas do olhinho</Link><Link className="btn" href="/cadastros/plano-contas">Plano de contas</Link></div></div>
    {sp.msg && <div className="ok">{sp.msg}</div>}{sp.erro && <div className="erro">{sp.erro}</div>}
    <form action={salvar} className="grid" style={{ gap: 14 }}>
      <section className="panel cad"><h2 className="cad-h1">Configurações gerais</h2><div className="cad-grid">
        <label><span>Dias para entrega<i className="obr">*</i></span><input type="number" name="dias_entrega" defaultValue={c.dias_entrega} required /></label>
        <label><span>Dias úteis montagem<i className="obr">*</i></span><input type="number" name="dias_uteis_montagem" defaultValue={c.dias_uteis_montagem} required /></label>
        <label><span>Dias úteis entrega</span><input type="number" name="dias_uteis_entrega" defaultValue={c.dias_uteis_entrega} /></label>
        <label><span>Garantia<i className="obr">*</i></span><select name="garantia_meses" defaultValue={c.garantia_meses}>{[[6, "6 meses"], [12, "1 ano"], [24, "2 anos"], [36, "3 anos"], [60, "5 anos"]].map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label><span>Margem mínima de alerta (%)</span><input name="margem_minima_pct" inputMode="decimal" defaultValue={String(c.margem_minima_pct).replace(".", ",")} /></label>
      </div></section>
      <section className="panel cad"><h2 className="cad-h1">Configurações de parcelas</h2><div className="cad-grid">
        <label><span>Dias 1ª parcela<i className="obr">*</i></span><input type="number" name="dias_primeira_parcela" defaultValue={c.dias_primeira_parcela} required /></label>
        <label><span>Forma de pagamento da entrada</span><select name="forma_entrada" defaultValue={c.forma_entrada}>{FORMAS.map((f) => <option key={f} value={f.toLowerCase()}>{f}</option>)}</select></label>
        <label style={{ gridColumn: "span 2" }}><span>Modo de geração</span><select name="modo_parcelas" defaultValue={c.modo_parcelas}><option value="intervalo30">Intervalo de 30 dias</option><option value="mesmo_dia">Mesmo dia de cada mês</option></select></label>
      </div></section>
      <section className="panel cad"><h2 className="cad-h1">Configurações de faturamento</h2><div className="cad-grid">
        <label style={{ gridColumn: "span 2" }}><span>Faturamento de cartão de crédito</span><select name="fatura_cartao" defaultValue={c.fatura_cartao}><option value="agrupado">Agrupado (1 lançamento único)</option><option value="parcelado">Uma conta a receber por parcela</option></select></label>
        <label><span>Faturar sem documento do cliente</span><select name="faturar_sem_documento" defaultValue={c.faturar_sem_documento}><option value="bloquear">Bloquear faturamento (recomendado)</option><option value="avisar">Só avisar</option></select></label>
        <label><span>Faturar sem endereço completo</span><select name="faturar_sem_endereco" defaultValue={c.faturar_sem_endereco}><option value="bloquear">Bloquear faturamento</option><option value="avisar">Só avisar</option></select></label>
      </div></section>
      <section className="panel cad"><h2 className="cad-h1">Plano de contas</h2><div className="cad-grid">
        <label style={{ gridColumn: "span 2" }}><span>Plano de contas orçamentos</span><Plano n="conta_receitas" tipo="receita" /></label>
        <label style={{ gridColumn: "span 2" }}><span>Comissão vendedores</span><Plano n="conta_comissao_vendedor" /></label>
        <label style={{ gridColumn: "span 2" }}><span>Comissão arquitetos</span><Plano n="conta_comissao_arquiteto" /></label>
        <label style={{ gridColumn: "span 2" }}><span>Imposto (nota fiscal)</span><Plano n="conta_imposto" /></label>
        <label style={{ gridColumn: "span 2" }}><span>Imposto do faturamento</span><select name="imposto_faturamento" defaultValue={c.imposto_faturamento ?? ""}><option value="DAS">DAS, Documento de Arrecadação do Simples Nacional</option>{(imps ?? []).map((i: any) => <option key={i.sigla} value={i.sigla}>{i.sigla}, {i.nome}</option>)}</select>
          <Link className="note" href="/cadastros/impostos/novo">+ Novo imposto</Link></label>
      </div></section>
      <div className="cad-acoes"><button className="btn primary">Salvar</button></div>
    </form>
  </>);
}
