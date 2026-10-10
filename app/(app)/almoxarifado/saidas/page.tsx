import Link from "next/link";
import ListaPedidos from "../ListaPedidos";
export default async function Saidas({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  return (<>
    <div className="head"><div><nav className="migalha">Almoxarifado › Pedidos de saída</nav><h1>Pedidos de Saída</h1><p className="sub">Ao finalizar, os itens saem do estoque e o custo entra na lucratividade do contrato</p></div>
      <Link className="btn primary" href="/almoxarifado/novo?tipo=saida">Cadastrar</Link></div>
    <ListaPedidos tipo="saida" q={sp.q} />
  </>);
}
