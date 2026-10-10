import Link from "next/link";
import ListaPedidos from "../ListaPedidos";
export default async function Compras({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  return (<>
    <div className="head"><div><nav className="migalha">Almoxarifado › Pedidos de compra</nav><h1>Pedidos de Compra</h1><p className="sub">Ao finalizar, os itens entram no estoque e o valor vai para Contas a pagar</p></div>
      <div style={{ display: "flex", gap: 8 }}><Link className="btn" href="/almoxarifado/notas-compra">Importar NF-e</Link><Link className="btn primary" href="/almoxarifado/novo?tipo=compra">Cadastrar</Link></div></div>
    <ListaPedidos tipo="compra" q={sp.q} />
  </>);
}
