import FormChamado from "../FormChamado";
export default async function Nova({ searchParams }: { searchParams: Promise<{ erro?: string; contrato?: string }> }) {
  const sp = await searchParams;
  return (<>
    <nav className="migalha">Assistências › Adicionar</nav>
    <div className="head"><div><h1>Adicionar Assistência Técnica</h1><p className="sub">Preencha as informações abaixo para cadastrar uma nova assistência técnica</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <FormChamado contrato={sp.contrato} />
  </>);
}
