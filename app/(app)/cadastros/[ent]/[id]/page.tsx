import { notFound } from "next/navigation";
import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { entidade } from "@/lib/cadastros";
import Formulario from "../../Formulario";

export default async function Editar({ params, searchParams }: { params: Promise<{ ent: string; id: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { ent, id } = await params;
  const sp = await searchParams;
  const e = entidade(ent);
  if (!e) notFound();
  const ctx = await contexto();
  const { data } = await ctx.supabase.from(e.tabela).select("*").eq("id", id).eq("empresa_id", ctx.empresa.id).maybeSingle();
  if (!data) notFound();
  const Nome = e.singular[0].toUpperCase() + e.singular.slice(1);
  return (
    <>
      <nav className="migalha"><Link href={`/cadastros/${e.slug}`}>{e.grupo ?? "Cadastros"}</Link> › <Link href={`/cadastros/${e.slug}`}>{e.plural[0].toUpperCase() + e.plural.slice(1)}</Link> › Editar</nav>
      <div className="head"><div><h1>{Nome}: {(data as any).nome ?? (data as any).sigla}</h1><p className="sub">Altere as informações e clique em Salvar</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <Formulario e={e} registro={data as any} />
    </>
  );
}
