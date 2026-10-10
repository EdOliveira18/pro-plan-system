import FormLanc from "../FormLanc";
export default async function Novo({ searchParams }: { searchParams: Promise<{ tipo?: string; erro?: string }> }) {
  const sp = await searchParams;
  return (<>
    <nav className="migalha">Financeiro › Lançamentos › Adicionar</nav>
    <div className="head"><div><h1>Novo lançamento</h1><p className="sub">Conta a pagar ou a receber. Use Repetir para parcelas mensais.</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <FormLanc tipo={sp.tipo} />
  </>);
}
