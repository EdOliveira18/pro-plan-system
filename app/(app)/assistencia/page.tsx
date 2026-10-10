import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";

const STATUS: [string, string][] = [["aberto", "Aberto"], ["agendado", "Agendado"], ["em_atendimento", "Em atendimento"], ["resolvido", "Resolvido"]];
const ir = (erro?: string) => { revalidatePath("/assistencia"); redirect("/assistencia" + (erro ? "?erro=" + encodeURIComponent(erro) : "")); };

async function abrir(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("chamados").insert({
    empresa_id: ctx.empresa.id, contrato_id: String(fd.get("contrato_id")), descricao: String(fd.get("descricao")).trim(),
    responsavel: String(fd.get("responsavel") || "") || null,
  });
  ir(error?.message);
}

async function mover(id: string, status: string) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("chamados").update({ status, resolvido_em: status === "resolvido" ? new Date().toISOString() : null }).eq("id", id);
  ir(error?.message);
}

async function agendar(id: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("chamados").update({
    agendado_para: String(fd.get("data") || "") || null, responsavel: String(fd.get("responsavel") || "") || null, status: "agendado",
  }).eq("id", id);
  ir(error?.message);
}

export default async function Assistencia({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const [{ data: chamados }, { data: contratos }] = await Promise.all([
    ctx.supabase.from("chamados").select("*, contrato:contratos(id, codigo, cliente:clientes(nome))").eq("empresa_id", ctx.empresa.id).order("aberto_em", { ascending: false }).limit(300),
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false }).limit(300),
  ]);
  const C = chamados ?? [];
  const abertos = C.filter((c) => c.status !== "resolvido");
  const resolvidos = C.filter((c) => c.status === "resolvido" && c.resolvido_em);
  const mediaDias = resolvidos.length ? resolvidos.reduce((s, c) => s + (new Date(c.resolvido_em).getTime() - new Date(c.aberto_em).getTime()) / 864e5, 0) / resolvidos.length : null;

  return (
    <>
      <div className="head"><div><h1>Assistência Técnica</h1><p className="sub">Chamados de pós-venda, sempre ligados ao contrato do cliente</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="panel kpi"><div className="l">Em aberto</div><div className="v" style={{ color: abertos.length ? "var(--warn)" : undefined }}>{abertos.length}</div></div>
        <div className="panel kpi"><div className="l">Agendados</div><div className="v">{C.filter((c) => c.status === "agendado").length}</div></div>
        <div className="panel kpi"><div className="l">Resolvidos</div><div className="v" style={{ color: "var(--good)" }}>{resolvidos.length}</div></div>
        <div className="panel kpi"><div className="l">Tempo médio de solução</div><div className="v">{mediaDias === null ? "n/a" : mediaDias.toFixed(1).replace(".", ",") + " d"}</div></div>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Abrir chamado</h2>
        {contratos?.length ? (
          <form action={abrir} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 8, alignItems: "end" }}>
            <label>Contrato<select name="contrato_id" required>{contratos.map((k: any) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
            <label style={{ gridColumn: "span 2" }}>Ocorrência<input name="descricao" required placeholder="Ex.: porta do aéreo desalinhada" /></label>
            <label>Responsável<input name="responsavel" placeholder="Equipe ou montador" /></label>
            <button className="btn primary">Abrir chamado</button>
          </form>
        ) : <p className="note">Os chamados ficam ligados a um contrato. Gere o primeiro contrato no Comercial para abrir chamados.</p>}
      </div>
      <div className="kanban">
        {STATUS.map(([k, nome], i) => {
          const cs = C.filter((c) => c.status === k).slice(0, k === "resolvido" ? 20 : 200);
          return (
            <div key={k} className="col">
              <div className="col-h"><span>{nome}</span><span>{C.filter((c) => c.status === k).length}</span></div>
              {cs.map((c: any) => (
                <div key={c.id} className="card">
                  <Link className="idc" href={`/contratos/${c.contrato?.id}?aba=assistencia`}>#{c.contrato?.codigo}</Link>
                  <b>{c.descricao}</b>
                  <span className="note">{c.contrato?.cliente?.nome} · aberto {data(c.aberto_em)}</span>
                  {c.agendado_para && <span className="pill p-info" style={{ alignSelf: "flex-start" }}>Visita {data(c.agendado_para)}</span>}
                  {c.responsavel && <span className="note">Responsável: {c.responsavel}</span>}
                  {k === "aberto" && (
                    <form action={agendar.bind(null, c.id)} style={{ display: "grid", gap: 4 }}>
                      <input type="date" name="data" required aria-label="Data da visita" />
                      <input name="responsavel" placeholder="Responsável" defaultValue={c.responsavel ?? ""} aria-label="Responsável" />
                      <button className="btn sm">Agendar visita</button>
                    </form>
                  )}
                  <div style={{ display: "flex", gap: 4 }}>
                    {i > 0 && <form action={mover.bind(null, c.id, STATUS[i - 1][0])}><button className="btn sm" aria-label="Voltar etapa">‹</button></form>}
                    {i < 3 && <form action={mover.bind(null, c.id, STATUS[i + 1][0])}><button className="btn sm">{STATUS[i + 1][1]} ›</button></form>}
                  </div>
                </div>
              ))}
              {!cs.length && <span className="note">Vazio</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}
