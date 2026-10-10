import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, data } from "@/lib/formato";
import { pendenciasFiscais } from "@/lib/fiscal";

const STATUS: Record<string, [string, string]> = {
  rascunho: ["Rascunho", "p-neu"], pendente: ["Aguardando envio", "p-warn"], processando: ["Processando", "p-info"],
  autorizada: ["Autorizada", "p-good"], rejeitada: ["Rejeitada", "p-bad"], cancelada: ["Cancelada", "p-bad"], erro: ["Erro", "p-bad"],
};

async function novaNota(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const contratoId = String(fd.get("contrato_id") || "") || null;
  let destinatario: string | null = null, valor = Number(String(fd.get("valor") || "0").replace(/\./g, "").replace(",", "."));
  if (contratoId) {
    const { data: k } = await ctx.supabase.from("contratos").select("valor_total, cliente:clientes(nome, cpf_cnpj)").eq("id", contratoId).single();
    destinatario = (k as any)?.cliente?.nome ?? null;
    if (!valor) valor = Number(k?.valor_total ?? 0);
  }
  const { data: cfg } = await ctx.supabase.from("config_fiscal").select("ambiente, nfe_serie, nfse_serie").eq("empresa_id", ctx.empresa.id).maybeSingle();
  const tipo = String(fd.get("tipo"));
  const { error } = await ctx.supabase.from("notas_fiscais").insert({
    empresa_id: ctx.empresa.id, contrato_id: contratoId, tipo, valor, status: "rascunho", destinatario,
    serie: tipo === "NF-e" ? cfg?.nfe_serie ?? 1 : cfg?.nfse_serie ?? 1, ambiente: cfg?.ambiente ?? "homologacao",
  });
  revalidatePath("/notas");
  redirect("/notas?" + (error ? "erro=" + encodeURIComponent(error.message) : "msg=" + encodeURIComponent("Rascunho criado. A transmissão para a Sefaz e para a NFS-e Nacional é liberada assim que o certificado for validado no ambiente de testes.")));
}

export default async function Notas({ searchParams }: { searchParams: Promise<{ q?: string; tipo?: string; status?: string; erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const sb = ctx.supabase;
  const eid = ctx.empresa.id;
  const [{ data: e }, { data: cert }, { data: cfg }, { data: notas }, { data: contratos }] = await Promise.all([
    sb.from("empresas").select("*").eq("id", eid).single(),
    sb.from("certificados").select("valido_ate").eq("empresa_id", eid).maybeSingle(),
    sb.from("config_fiscal").select("*").eq("empresa_id", eid).maybeSingle(),
    sb.from("notas_fiscais").select("*, contrato:contratos(id, codigo, cliente:clientes(nome))").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(500),
    sb.from("contratos").select("id, codigo, valor_total, cliente:clientes(nome)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(300),
  ]);
  // certificado só é visível para gestor; para os demais a pendência vem da tabela, então não acusamos falta de certificado
  const pend = pendenciasFiscais(e, cert ?? (["dono", "gerente"].includes(ctx.papel) ? null : { valido_ate: null }), cfg);
  const q = (sp.q ?? "").toLowerCase().trim();
  const lista = ((notas ?? []) as any[]).filter((n) =>
    (!q || [n.destinatario, n.contrato?.cliente?.nome, n.chave, n.numero].some((x) => String(x ?? "").toLowerCase().includes(q))) &&
    (!sp.tipo || n.tipo === sp.tipo) && (!sp.status || n.status === sp.status));
  const qs = new URLSearchParams(Object.entries({ q: sp.q, tipo: sp.tipo, status: sp.status }).filter(([, v]) => v) as [string, string][]).toString();

  return (
    <>
      <div className="head"><div><h1>Notas fiscais</h1><p className="sub">Gerencie as notas fiscais emitidas: NF-e dos móveis e NFS-e da montagem</p></div>
        <Link className="btn" href="/empresa">Configurações fiscais</Link></div>
      {pend.length > 0 && (
        <div className="erro" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b>✕</b> Você precisa configurar os dados do emitente antes de emitir. Falta: {pend.slice(0, 6).join(", ")}{pend.length > 6 ? ` e mais ${pend.length - 6}` : ""}.
          <Link href="/empresa" style={{ fontWeight: 700, color: "inherit" }}>Clique aqui para configurar</Link>
        </div>
      )}
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      {cfg && <p className="note" style={{ marginTop: 0 }}>Ambiente: <b>{cfg.ambiente === "producao" ? "Produção" : "Homologação (testes, sem valor fiscal)"}</b> · próxima NF-e nº {cfg.nfe_ultimo + 1} série {cfg.nfe_serie} · próxima DPS nº {cfg.nfse_ultimo + 1} série {cfg.nfse_serie}</p>}

      <div className="panel">
        <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por destinatário, número ou chave da nota" style={{ flex: 1, minWidth: 220 }} aria-label="Buscar" />
          <select name="tipo" defaultValue={sp.tipo ?? ""} aria-label="Tipo"><option value="">Todos os tipos</option><option>NF-e</option><option>NFS-e</option></select>
          <select name="status" defaultValue={sp.status ?? ""} aria-label="Situação"><option value="">Todas as situações</option>{Object.entries(STATUS).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}</select>
          <button className="btn">Filtrar</button>
          <a className="btn" href={`/notas/exportar${qs ? "?" + qs : ""}`}>Download (planilha)</a>
        </form>
        <div className="scroll"><table>
          <thead><tr><th>Série-Nº</th><th>Destinatário</th><th>Data emissão</th><th>Tipo</th><th>Situação</th><th className="r">Valor</th><th>Ações</th></tr></thead>
          <tbody>
            {lista.map((n) => (
              <tr key={n.id}>
                <td className="num">{n.serie ?? "n/a"}-{n.numero ?? "rascunho"}</td>
                <td>{n.destinatario ?? n.contrato?.cliente?.nome ?? "n/a"}{n.contrato && <div className="note"><Link href={`/contratos/${n.contrato.id}`}>#{n.contrato.codigo}</Link></div>}</td>
                <td className="num">{n.emitida_em ? data(n.emitida_em) : <span className="note">não emitida</span>}</td>
                <td><span className="pill p-info">{n.tipo}</span></td>
                <td><span className={"pill " + (STATUS[n.status]?.[1] ?? "p-neu")}>{STATUS[n.status]?.[0] ?? n.status}</span>{n.erro && <div className="note" style={{ color: "var(--bad)" }}>{n.erro}</div>}</td>
                <td className="r num">{brl(n.valor)}</td>
                <td className="note">{n.xml_path ? "XML · DANFE" : "n/a"}</td>
              </tr>
            ))}
            {!lista.length && <tr><td colSpan={7} className="note" style={{ textAlign: "center" }}>Nenhuma nota encontrada.</td></tr>}
          </tbody>
        </table></div>
      </div>

      <div className="panel mt">
        <h2>Nova nota</h2>
        <form action={novaNota} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 8, alignItems: "end" }}>
          <label>Tipo<select name="tipo"><option value="NF-e">NF-e (móveis)</option><option value="NFS-e">NFS-e (montagem)</option></select></label>
          <label>Contrato<select name="contrato_id" defaultValue=""><option value="">Sem contrato</option>{((contratos ?? []) as any[]).map((k) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome} · {brl(k.valor_total)}</option>)}</select></label>
          <label>Valor (em branco usa o do contrato)<input name="valor" inputMode="decimal" /></label>
          <button className="btn primary" disabled={pend.length > 0} title={pend.length ? "Complete a configuração do emitente primeiro" : undefined}>Criar nota</button>
        </form>
      </div>
    </>
  );
}
