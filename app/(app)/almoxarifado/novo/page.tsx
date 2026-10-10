import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { criarPedido } from "../acoes";
import { hojeISO, dataHora, somaDias } from "@/lib/tempo";

export default async function NovoPedido({ searchParams }: { searchParams: Promise<{ tipo?: string; erro?: string; contrato?: string }> }) {
  const sp = await searchParams;
  const tipo = sp.tipo === "saida" ? "saida" : "compra";
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: forns }, { data: ms }, { data: nats }, { data: ks }] = await Promise.all([
    ctx.supabase.from("pessoas").select("id, nome, nome_fantasia").eq("empresa_id", eid).eq("categoria", "fornecedor").eq("status", "ativo").order("nome"),
    ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", eid).eq("ativo", true).order("nome"),
    ctx.supabase.from("naturezas").select("id, nome, cfop_estadual").eq("empresa_id", eid).order("nome"),
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(300),
  ]);
  const hoje = hojeISO();
  return (<>
    <nav className="migalha">Almoxarifado › {tipo === "compra" ? "Pedidos de compra" : "Pedidos de saída"} › Adicionar</nav>
    <div className="head"><div><h1>Adicionar Pedido de {tipo === "compra" ? "Compra" : "Saída"}</h1><p className="sub">{tipo === "compra" ? "Cadastre um novo pedido de compra para o almoxarifado" : "Registre a retirada de material do estoque"}</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <form action={criarPedido.bind(null, tipo)} className="panel cad">
      <div className="cad-grid" style={{ paddingTop: 18 }}>
        <label><span>Data do pedido<i className="obr">*</i></span><input type="date" name="data" defaultValue={hoje} required /></label>
        {tipo === "compra" ? <>
          <label style={{ gridColumn: "span 2" }}><span>Fornecedor<i className="obr">*</i></span><select name="fornecedor_id" required defaultValue=""><option value="">Selecione</option>{(forns ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome_fantasia || f.nome}</option>)}</select>
            <Link href="/cadastros/fornecedores/novo" className="note">+ Novo fornecedor</Link></label>
          <label><span>Nº documento</span><input name="documento" placeholder="Nota, recibo, pedido…" /></label>
          <label style={{ gridColumn: "span 2" }}><span>Natureza de entrada</span><select name="natureza_id" defaultValue=""><option value="">Selecione</option>{(nats ?? []).map((n: any) => <option key={n.id} value={n.id}>{n.nome} ({n.cfop_estadual})</option>)}</select></label>
          <label><span>Vencimento do pagamento</span><input type="date" name="vencimento" /></label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 8, gridColumn: "span 2" }}><input type="checkbox" name="gerar_financeiro" defaultChecked /> Lançar em Contas a pagar ao finalizar</label>
        </> : <>
          <label style={{ gridColumn: "span 2" }}><span>Contrato / cliente</span><select name="contrato_id" defaultValue={sp.contrato ?? ""}><option value="">Uso interno (sem contrato)</option>{(ks ?? []).map((k: any) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
          <label><span>Tipo</span><select name="tipo_saida" defaultValue="Produção">{["Produção", "Montagem em obra", "Assistência técnica", "Venda avulsa", "Uso interno", "Perda / avaria"].map((t) => <option key={t}>{t}</option>)}</select></label>
        </>}
        <label style={{ gridColumn: "span 2" }}><span>Responsável<i className="obr">*</i></span><select name="responsavel_id" defaultValue={ctx.userId} required>{(ms ?? []).map((m: any) => <option key={m.user_id} value={m.user_id}>{m.nome}</option>)}</select></label>
        <label className="cad-area"><span>Observações</span><textarea name="observacoes" rows={3} /></label>
      </div>
      <div className="cad-acoes"><button className="btn primary">Continuar →</button><Link className="btn" href={tipo === "compra" ? "/almoxarifado/compras" : "/almoxarifado/saidas"}>← Voltar</Link></div>
    </form>
  </>);
}
