import { notFound } from "next/navigation";
import { contexto } from "@/lib/contexto";
import FormLanc from "../FormLanc";
export default async function Editar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: l } = await ctx.supabase.from("lancamentos").select("*").eq("id", id).eq("empresa_id", ctx.empresa.id).maybeSingle();
  if (!l) notFound();
  return (<>
    <nav className="migalha">Financeiro › Lançamentos › Editar</nav>
    <div className="head"><div><h1>{l.descricao}</h1><p className="sub">{l.valor > 0 ? "Receita" : "Despesa"}{l.excluido_em ? " · excluído" : ""}</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <FormLanc l={l} />
  </>);
}
