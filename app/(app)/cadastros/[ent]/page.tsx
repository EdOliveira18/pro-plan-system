import Link from "next/link";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { entidade } from "@/lib/cadastros";
import { contexto as ctxPapel, exigir } from "@/lib/contexto";
import Confirmar from "@/components/Confirmar";
import { excluirCadastro, importarClientes, restaurarCadastro } from "../actions";
import { dataHora } from "@/lib/tempo";
import Paginacao, { pagina } from "@/components/Paginacao";

export default async function Lista({ params, searchParams }: {
  params: Promise<{ ent: string }>;
  searchParams: Promise<{ q?: string; status?: string; erro?: string; msg?: string; lixeira?: string; pag?: string }>;
}) {
  const { ent } = await params;
  const sp = await searchParams;
  const e = entidade(ent);
  if (!e) notFound();
  { const c0 = await ctxPapel(); exigir(c0, c0.papel !== "montador" || e.slug === "ferramentas"); }
  const ctx = await contexto();
  let q = ctx.supabase.from(e.tabela)
    .select(e.select ?? (e.tabela === "clientes" ? "*, contratos(id, codigo)" : "*"), { count: "exact" })
    .eq("empresa_id", ctx.empresa.id);
  const naLixeira = !!(e.lixeira && sp.lixeira);
  if (e.lixeira) q = naLixeira ? q.not("excluido_em", "is", null) : q.is("excluido_em", null);
  for (const [k, v] of Object.entries(e.filtro ?? {})) q = q.eq(k, v);
  if (sp.status && e.colunas.some((c) => c.tipo === "status")) q = q.eq("status", sp.status);
  const termo = (sp.q ?? "").trim().replace(/[%,()*\\]/g, " ").slice(0, 80);
  const pg = pagina(sp.pag);
  if (termo) q = q.or(e.buscaEm.map((c) => `${c}.ilike.%${termo}%`).join(","));
  const { data, count, error } = await q.order(e.ordem ?? "nome", { ascending: true }).order("id").range(pg.de, pg.ate);
  const lista = (data ?? []) as any[];
  const nomes: Record<string, string> = {};
  if (naLixeira) {
    const { data: ms } = await ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", ctx.empresa.id);
    (ms ?? []).forEach((m: any) => (nomes[m.user_id] = m.nome));
  }
  const temStatus = e.colunas.some((c) => c.tipo === "status");
  const Plural = e.plural[0].toUpperCase() + e.plural.slice(1);
  const filtrando = !!(termo || sp.status);

  return (
    <>
      <div className="head">
        <div>{e.grupo && <nav className="migalha">{e.grupo} › {Plural}{naLixeira ? " › Excluídos" : ""}</nav>}<h1>{naLixeira ? `${Plural} excluídos` : `Lista de ${Plural}`}</h1>
          <p className="sub">{naLixeira ? "O que saiu, quando e por quem. Restaurar devolve o cadastro como estava." : e.descricao}</p></div>
        <div style={{ display: "flex", gap: 8 }}>
          {e.lixeira && <Link className="btn" href={naLixeira ? `/cadastros/${e.slug}` : `/cadastros/${e.slug}?lixeira=1`}>{naLixeira ? "Voltar à lista" : "Excluídos"}</Link>}
          {e.slug === "produtos" && <a className="btn" href="/almoxarifado/exportar">Exportar</a>}
          {e.slug === "ferramentas" && <Link className="btn" href="/ferramentas/termo">Gerar termo</Link>}
          <Link className="btn primary" href={`/cadastros/${e.slug}/novo`}>Cadastrar</Link>
        </div>
      </div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      {error && <div className="erro">{/permission|row-level/i.test(error.message) ? "Seu perfil não tem acesso a este cadastro." : error.message}</div>}

      <div className="panel" style={{ padding: 0 }}>
        <div className="cad-busca">
        <form>
          {naLixeira && <input type="hidden" name="lixeira" value="1" />}
          <input name="q" defaultValue={sp.q ?? ""} placeholder={e.busca} aria-label="Buscar" />
          {temStatus && <select name="status" defaultValue={sp.status ?? ""} aria-label="Status"><option value="">Todos os status</option><option value="ativo">Ativos</option><option value="inativo">Inativos</option></select>}
          <button className="btn">Filtrar</button>
        </form>
          {e.slug === "clientes" && (
            <details className="cad-imp">
              <summary className="btn">Importar</summary>
              <div className="panel">
                <p className="note" style={{ marginTop: 0 }}>Planilha CSV (no Excel, “Salvar como CSV”) com títulos na primeira linha. Colunas aceitas: Nome, CPF/CNPJ, Celular, Telefone, E-mail, CEP, Endereço, Número, Bairro, Cidade, UF.</p>
                <form action={importarClientes} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <input type="file" name="arquivo" accept=".csv,text/csv" required />
                  <button className="btn primary sm">Importar clientes</button>
                </form>
              </div>
            </details>
          )}
        </div>
        <div className="scroll"><table className="cad-tab">
          <thead><tr>{e.colunas.map((c) => <th key={c.titulo}>{c.titulo}</th>)}{e.slug === "clientes" && <th>Contratos</th>}{naLixeira && <><th>Excluído em</th><th>Excluído por</th></>}<th className="r">Ações</th></tr></thead>
          <tbody>
            {lista.map((r) => (
              <tr key={r.id}>
                {e.colunas.map((c, i) => {
                  const v = c.v(r);
                  return (
                    <td key={c.titulo} className={c.tipo === "num" ? "num" : undefined}>
                      {c.tipo === "status" ? <span className={"pill " + (v === "inativo" ? "p-neu" : "p-good")}>{v === "inativo" ? "Inativo" : "Ativo"}</span>
                        : c.tipo === "pill" && v ? <span className="pill p-info">{v}</span>
                        : i === 0 ? <Link href={`/cadastros/${e.slug}/${r.id}`}><b>{v}</b></Link>
                        : v || <span className="note">n/a</span>}
                    </td>
                  );
                })}
                {e.slug === "clientes" && <td>{r.contratos?.length ? r.contratos.map((k: any) => <Link key={k.id} className="idc" href={`/contratos/${k.id}`} style={{ marginRight: 8 }}>#{k.codigo}</Link>)
                  : <Link className="btn sm" href={`/comercial?cliente=${r.id}`}>Criar orçamento</Link>}</td>}
                {naLixeira && <><td className="num note">{dataHora(r.excluido_em)}</td><td className="note">{nomes[r.excluido_por] ?? "n/a"}</td></>}
                <td className="r" style={{ whiteSpace: "nowrap" }}>
                  {naLixeira ? <form action={restaurarCadastro.bind(null, e.slug, r.id)} style={{ display: "inline" }}><button className="btn sm">Restaurar</button></form> : <>
                  <Link className="btn sm" href={`/cadastros/${e.slug}/${r.id}`}>Editar</Link>{" "}
                  <form action={excluirCadastro.bind(null, e.slug, r.id)} style={{ display: "inline" }}><Confirmar className="btn sm" texto={`Excluir ${r.nome ?? r.sigla ?? r.codigo}?`}>Excluir</Confirmar></form></>}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        {!lista.length && !error && (
          <div className="vazio">
            <div className="vz-ic">○</div>
            <b>{filtrando ? "Nada encontrado com esse filtro" : `Nenhum ${e.artigo === "a" ? "a " : ""}${e.singular} cadastrad${e.artigo}`.replace("Nenhum a ", "Nenhuma ")}</b>
            {!filtrando && <><p>{e.vazio}</p><Link className="btn primary" href={`/cadastros/${e.slug}/novo`}>Cadastrar primeir{e.artigo} {e.singular}</Link></>}
          </div>
        )}
        <Paginacao total={count ?? 0} pag={pg.pag} base={`/cadastros/${e.slug}`} params={sp} />
      </div>
    </>
  );
}
