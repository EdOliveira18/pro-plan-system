import { contexto } from "@/lib/contexto";
import NavProd from "../NavProd";
import ListaOP from "../ListaOP";
import { carregarOPs, filtrar } from "../dados";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const ops = filtrar(await carregarOPs(ctx, ["finalizada"]), sp.q);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Produção Finalizadas</nav><h1>Produção Finalizadas</h1><p className="sub">Produções que foram finalizadas</p></div></div>
    <NavProd atual="/producao/finalizadas" />
    <ListaOP ops={ops} modo="finalizada" q={sp.q} />
  </>);
}
