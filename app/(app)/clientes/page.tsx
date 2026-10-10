import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, ETAPAS_WF, ASSINATURA } from "@/lib/formato";

async function criarCliente(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("clientes").insert({
    empresa_id: ctx.empresa.id,
    nome: String(fd.get("nome")),
    telefone: String(fd.get("telefone") || "") || null,
    email: String(fd.get("email") || "") || null,
    endereco: String(fd.get("endereco") || "") || null,
    campanha_id: String(fd.get("campanha_id") || "") || null,
    created_by: ctx.userId,
  });
  if (error) redirect("/clientes?erro=" + encodeURIComponent(error.message));
  revalidatePath("/clientes");
}

export default async function Clientes({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: clientes }, { data: campanhas }] = await Promise.all([
    ctx.supabase.from("clientes").select("id, nome, telefone, endereco, campanha:campanhas(nome), contratos(id, codigo, valor_total, etapa_workflow, assinatura_cliente)").eq("empresa_id", eid).order("created_at", { ascending: false }),
    ctx.supabase.from("campanhas").select("id, nome").eq("empresa_id", eid).order("nome"),
  ]);
  const wf = Object.fromEntries(ETAPAS_WF);
  return (
    <>
      <div className="head"><div><h1>Clientes</h1><p className="sub">Cada cliente com seus contratos. Clique no número do contrato para ver tudo que está ligado a ele.</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <details className="panel" style={{ marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--accent)" }}>Cadastrar cliente</summary>
        <form action={criarCliente} className="form mt">
          <label>Nome<input name="nome" required /></label>
          <label>Telefone / WhatsApp<input name="telefone" /></label>
          <label>E-mail<input name="email" type="email" /></label>
          <label>Origem do lead<select name="campanha_id" defaultValue=""><option value="">Não informada</option>{(campanhas ?? []).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></label>
          <label style={{ gridColumn: "1 / -1" }}>Endereço da obra<input name="endereco" /></label>
          <div><button className="btn primary">Salvar cliente</button></div>
        </form>
      </details>
      <div className="panel"><div className="scroll"><table>
        <thead><tr><th>Cliente</th><th>Origem</th><th>Contratos</th></tr></thead>
        <tbody>
          {(clientes ?? []).map((c: any) => (
            <tr key={c.id}>
              <td><b>{c.nome}</b><div className="note">{[c.telefone, c.endereco].filter(Boolean).join(" · ")}</div></td>
              <td>{c.campanha?.nome ?? <span className="note">n/a</span>}</td>
              <td>{c.contratos.length ? c.contratos.map((k: any) => (
                <div key={k.id} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "2px 0" }}>
                  <Link className="idc" href={`/contratos/${k.id}`}>#{k.codigo}</Link>
                  <span className="num">{brl(k.valor_total)}</span>
                  <span className="pill p-neu">{wf[k.etapa_workflow]}</span>
                  <span className={"pill " + (k.assinatura_cliente === "assinado" ? "p-good" : "p-warn")}>{ASSINATURA[k.assinatura_cliente]}</span>
                </div>
              )) : <Link href={`/comercial?cliente=${c.id}`} className="btn sm">Criar orçamento</Link>}</td>
            </tr>
          ))}
          {!clientes?.length && <tr><td colSpan={3} className="note">Nenhum cliente ainda. Cadastre o primeiro acima.</td></tr>}
        </tbody>
      </table></div></div>
    </>
  );
}
