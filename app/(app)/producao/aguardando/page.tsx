import { contexto } from "@/lib/contexto";
import NavProd from "../NavProd";
import ListaOP from "../ListaOP";
import { carregarOPs, filtrar } from "../dados";

export default async function Pagina({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const ops = filtrar(await carregarOPs(ctx, ["aguardando"]), sp.q);
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Produção Aguardando Início</nav><h1>Produção Aguardando Início</h1><p className="sub">Produções agendadas que aguardam para serem iniciadas</p></div></div>
    <NavProd atual="/producao/aguardando" />
    <ListaOP ops={ops} modo="aguardando" q={sp.q} />
  </>);
}
