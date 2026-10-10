import { contexto } from "@/lib/contexto";
import NavProd from "../NavProd";
import ListaOP from "../ListaOP";
import { carregarOPsPagina } from "../dados";
import Paginacao, { pagina } from "@/components/Paginacao";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ q?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const pg = pagina(sp.pag);
  const { ops, count } = await carregarOPsPagina(ctx, ["finalizada"], sp.q, pg.de, pg.ate);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Produção Finalizadas</nav><h1>Produção Finalizadas</h1><p className="sub">Produções que foram finalizadas</p></div></div>
    <NavProd atual="/producao/finalizadas" />
    <ListaOP ops={ops} modo="finalizada" q={sp.q} />
    <Paginacao total={count} pag={pg.pag} base="/producao/finalizadas" params={sp} />
  </>);
}
