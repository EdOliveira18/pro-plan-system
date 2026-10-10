import { notFound } from "next/navigation";
import { contexto } from "@/lib/contexto";
import FormChamado from "../FormChamado";
export default async function Editar({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: c } = await ctx.supabase.from("chamados").select("*").eq("id", id).eq("empresa_id", ctx.empresa.id).maybeSingle();
  if (!c) notFound();
  return (<>
    <nav className="migalha">Assistências › Nº {c.numero}</nav>
    <div className="head"><div><h1>Assistência nº {c.numero}</h1><p className="sub">Aberta em {new Date(c.aberto_em).toLocaleDateString("pt-BR")}</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <FormChamado c={c} />
  </>);
}
