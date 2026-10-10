import { contexto } from "@/lib/contexto";
import NavProd from "../NavProd";
import ListaOP from "../ListaOP";
import { carregarOPs, filtrar } from "../dados";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const ops = filtrar(await carregarOPs(ctx, ["cancelada"]), sp.q);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Produção Canceladas</nav><h1>Produção Canceladas</h1><p className="sub">Produções que foram canceladas</p></div></div>
    <NavProd atual="/producao/canceladas" />
    <ListaOP ops={ops} modo="cancelada" q={sp.q} />
  </>);
}
