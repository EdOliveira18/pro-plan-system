import Paginacao, { pagina } from "@/components/Paginacao";
import { idsContratos, limparTermo } from "@/lib/busca";
import Link from "next/link";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import Copiar from "@/components/Copiar";

async function gerar(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const contrato = String(fd.get("contrato_id") || "");
  if (contrato) await ctx.supabase.from("pesquisas").insert({ empresa_id: ctx.empresa.id, contrato_id: contrato });
  revalidatePath("/pos-venda");
}

export default async function PosVenda({ searchParams }: { searchParams: Promise<{ q?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const h = await headers();
  const base = process.env.APP_URL || `https://${h.get("host")}`;
  const pg = pagina(sp.pag);
  let qp = ctx.supabase.from("pesquisas").select("*, contrato:contratos(id, codigo, cliente:clientes(nome, celular, telefone))", { count: "exact" }).eq("empresa_id", ctx.empresa.id);
  const t = limparTermo(sp.q);
  if (t) { const kids = await idsContratos(ctx.supabase, ctx.empresa.id, t); qp = kids.length ? qp.in("contrato_id", kids) : qp.is("id", null); }
  const [{ data: rows, count }, { data: res }, { data: ks }] = await Promise.all([
    qp.order("numero", { ascending: false }).range(pg.de, pg.ate),
    ctx.supabase.rpc("resumo_pesquisas", { p_empresa: ctx.empresa.id }),
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const L = (rows ?? []) as any[];
  const R = (res ?? {}) as any;
  const nps = R.nps == null ? null : Number(R.nps);
  const media = (k: string) => (R[k] == null ? "n/a" : String(R[k]).replace(".", ","));
  return (<>
    <div className="head"><div><h1>Pós-venda</h1><p className="sub">Pesquisa de satisfação: gere o link, mande para o cliente pelo WhatsApp e acompanhe as notas</p></div></div>
    <div className="grid kpis" style={{ marginBottom: 16 }}>
      <div className="panel kpi"><div className="l">NPS</div><div className="v" style={{ color: nps == null ? undefined : nps >= 50 ? "var(--good)" : nps < 0 ? "var(--bad)" : "var(--warn)" }}>{nps ?? "n/a"}</div><div className="s">{Number(R.respondidas ?? 0)} de {Number(R.total ?? 0)} responderam</div></div>
      <div className="panel kpi"><div className="l">Atendimento</div><div className="v">{media("atendimento")}</div><div className="s">média de 1 a 5</div></div>
      <div className="panel kpi"><div className="l">Montagem</div><div className="v">{media("montagem")}</div><div className="s">média de 1 a 5</div></div>
      <div className="panel kpi"><div className="l">Prazo</div><div className="v">{media("prazo")}</div><div className="s">média de 1 a 5</div></div>
    </div>
    <form action={gerar} className="panel" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 14 }}>
      <b>Nova pesquisa</b><select name="contrato_id" required defaultValue="" style={{ minWidth: 260 }}><option value="">Escolha o contrato</option>{(ks ?? []).map((k: any) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select>
      <button className="btn primary">Gerar link</button><span className="note">O cliente responde pelo celular, sem login.</span>
    </form>
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Pesquise por nome do cliente e número do contrato" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Id</th><th>Cliente</th><th>Nº contrato</th><th>Respondido</th><th>Data de resposta</th><th>Notas</th><th className="r">Ações</th></tr></thead>
        <tbody>{L.map((p) => {
          const link = `${base}/pesquisa/${p.token}`;
          const fone = String(p.contrato?.cliente?.celular || p.contrato?.cliente?.telefone || "").replace(/\D/g, "");
          const msg = encodeURIComponent(`Olá, ${p.contrato?.cliente?.nome?.split(" ")[0] ?? ""}! Queremos saber como foi sua experiência com a gente. Leva 1 minuto: ${link}`);
          return (<tr key={p.id}><td className="num">{p.numero}</td><td><b>{p.contrato?.cliente?.nome}</b>{p.comentario && <div className="note">“{p.comentario}”</div>}</td>
            <td><Link className="idc" href={`/contratos/${p.contrato?.id}`}>#{p.contrato?.codigo}</Link></td>
            <td><span className={"pill " + (p.respondido_em ? "p-good" : "p-warn")}>{p.respondido_em ? "Sim" : "Aguardando"}</span></td>
            <td className="num note">{p.respondido_em ? data(p.respondido_em) : "n/a"}</td>
            <td className="num note">{p.respondido_em ? `NPS ${p.nota_nps} · atend. ${p.nota_atendimento} · mont. ${p.nota_montagem} · prazo ${p.nota_prazo}` : ""}</td>
            <td className="r" style={{ whiteSpace: "nowrap" }}>{!p.respondido_em && <><Copiar texto={link} />{" "}<a className="btn sm" target="_blank" rel="noreferrer" href={`https://wa.me/${fone ? (fone.startsWith("55") ? fone : "55" + fone) : ""}?text=${msg}`}>WhatsApp</a></>}</td></tr>);
        })}</tbody>
      </table></div>
      {!L.length && <div className="vazio"><b>Nenhum pós-venda encontrado.</b></div>}
      <Paginacao total={count ?? 0} pag={pg.pag} base="/pos-venda" params={sp} />
    </div>
  </>);
}
