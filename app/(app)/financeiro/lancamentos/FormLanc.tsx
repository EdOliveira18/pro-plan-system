import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { FORMAS, hojeISO } from "@/lib/financeiro";
import { salvarLancamento } from "../fin-acoes";

export default async function FormLanc({ l, tipo }: { l?: any; tipo?: string }) {
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: planos }, { data: contas }, { data: ks }, { data: pess }, { data: clis }] = await Promise.all([
    ctx.supabase.from("plano_contas").select("codigo, nome, tipo").eq("empresa_id", eid).order("codigo"),
    ctx.supabase.from("contas_bancarias").select("id, nome, tipo").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(300),
    ctx.supabase.from("pessoas").select("nome, nome_fantasia").eq("empresa_id", eid).limit(500),
    ctx.supabase.from("clientes").select("nome").eq("empresa_id", eid).limit(500),
  ]);
  const t = l ? (l.valor > 0 ? "receita" : "despesa") : tipo === "receita" ? "receita" : "despesa";
  const nomes = [...new Set([...(pess ?? []).map((p: any) => p.nome_fantasia || p.nome), ...(clis ?? []).map((c: any) => c.nome)])];
  return (
    <form action={salvarLancamento.bind(null, l?.id ?? null)} className="panel cad">
      <div className="cad-grid" style={{ paddingTop: 18 }}>
        <label><span>Tipo<i className="obr">*</i></span><select name="tipo" defaultValue={t}><option value="despesa">Despesa (a pagar)</option><option value="receita">Receita (a receber)</option></select></label>
        <label style={{ gridColumn: "span 2" }}><span>Descrição<i className="obr">*</i></span><input name="descricao" required defaultValue={l?.descricao ?? ""} /></label>
        <label><span>Valor<i className="obr">*</i></span><input name="valor" inputMode="decimal" required placeholder="0,00" defaultValue={l ? Math.abs(l.valor).toFixed(2).replace(".", ",") : ""} /></label>
        <label style={{ gridColumn: "span 2" }}><span>Entidade (fornecedor, cliente, funcionário)</span><input name="entidade" list="entidades" defaultValue={l?.entidade ?? ""} /><datalist id="entidades">{nomes.map((n) => <option key={n} value={n} />)}</datalist></label>
        <label><span>Vencimento<i className="obr">*</i></span><input type="date" name="data" required defaultValue={l?.data ?? hojeISO()} /></label>
        <label><span>Competência</span><input type="month" name="competencia" defaultValue={l?.competencia?.slice(0, 7) ?? ""} /></label>
        <label><span>Forma de pagamento</span><select name="forma_pagamento" defaultValue={l?.forma_pagamento ?? ""}><option value="">Selecione</option>{FORMAS.map((f) => <option key={f}>{f}</option>)}</select></label>
        <label style={{ gridColumn: "span 2" }}><span>Plano de contas</span><select name="plano_conta" defaultValue={l?.plano_conta ?? ""}><option value="">Selecione</option>{(planos ?? []).map((p: any) => <option key={p.codigo} value={p.codigo}>{p.codigo} {p.nome}</option>)}</select></label>
        <label><span>Conta financeira</span><select name="conta_id" defaultValue={l?.conta_id ?? ""}><option value="">Selecione</option>{(contas ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
        <label style={{ gridColumn: "span 2" }}><span>Contrato</span><select name="contrato_id" defaultValue={l?.contrato_id ?? ""}><option value="">Sem contrato</option>{(ks ?? []).map((k: any) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
        <label><span>Nº documento / NF</span><input name="documento" defaultValue={l?.documento ?? ""} /></label>
        {!l && <label><span>Repetir (meses)</span><input type="number" name="repetir" min={1} max={60} defaultValue={1} /></label>}
        <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" name="pago" defaultChecked={!!l?.realizado} /> Já foi pago</label>
        <label><span>Data do pagamento</span><input type="date" name="pago_em" defaultValue={l?.pago_em ?? ""} /></label>
        <label className="cad-area"><span>Observações</span><textarea name="observacoes" rows={3} defaultValue={l?.observacoes ?? ""} /></label>
        {l?.categoria && <input type="hidden" name="categoria" value={l.categoria} />}
      </div>
      <div className="cad-acoes"><button className="btn primary">Salvar</button><Link className="btn" href="/financeiro/lancamentos">Voltar</Link></div>
    </form>
  );
}
