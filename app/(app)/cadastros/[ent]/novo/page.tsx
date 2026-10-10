import { notFound } from "next/navigation";
import Link from "next/link";
import { entidade } from "@/lib/cadastros";
import Formulario from "../../Formulario";

export default async function Novo({ params, searchParams }: { params: Promise<{ ent: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { ent } = await params;
  const sp = await searchParams;
  const e = entidade(ent);
  if (!e) notFound();
  const Nome = e.singular[0].toUpperCase() + e.singular.slice(1);
  return (
    <>
      <nav className="migalha"><Link href={`/cadastros/${e.slug}`}>{e.grupo ?? "Cadastros"}</Link> › <Link href={`/cadastros/${e.slug}`}>{e.plural[0].toUpperCase() + e.plural.slice(1)}</Link> › Adicionar</nav>
      <div className="head"><div><h1>Adicionar {Nome}</h1><p className="sub">Preencha as informações abaixo para cadastrar {e.artigo === "a" ? "uma nova" : "um novo"} {e.singular}</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <Formulario e={e} />
    </>
  );
}
