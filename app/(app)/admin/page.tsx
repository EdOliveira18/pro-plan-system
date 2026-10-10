import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import { formatarCNPJ } from "@/lib/cnpj";

const PLANOS: [string, string, number][] = [["teste", "Teste", 20], ["basico", "Básico", 30], ["pro", "Pro", 100], ["cortesia", "Cortesia", 200], ["suspenso", "Suspenso", 0]];

async function definirPlano(id: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.rpc("admin_definir_plano", { p_empresa: id, p_plano: String(fd.get("plano")), p_ate: String(fd.get("ate")), p_limite: Number(fd.get("limite") || 0) });
  revalidatePath("/admin");
  redirect("/admin?" + (error ? "erro=" + encodeURIComponent(error.message) : "msg=" + encodeURIComponent("Plano atualizado.")));
}
async function verificar(id: string, ok: boolean) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.rpc("admin_verificar_cnpj", { p_empresa: id, p_ok: ok });
  revalidatePath("/admin");
  redirect("/admin?" + (error ? "erro=" + encodeURIComponent(error.code === "23505" ? "Esse CNPJ já está verificado em outra empresa." : error.message) : "msg=" + encodeURIComponent(ok ? "CNPJ verificado." : "Verificação removida.")));
}

export default async function Admin({ searchParams }: { searchParams: Promise<{ msg?: string; erro?: string; q?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const { data: lista, error } = await ctx.supabase.rpc("admin_empresas");
  const t = (sp.q ?? "").toLowerCase().trim();
  const L = ((lista ?? []) as any[]).filter((e) => !t || [e.nome, e.razao_social, e.cnpj, e.donos].some((x) => String(x ?? "").toLowerCase().includes(t)));
  const dig = (v: string) => String(v ?? "").replace(/\D/g, "");
  return (<>
    <div className="head"><div><h1>Administração da plataforma</h1><p className="sub">Planos, limite de renders e verificação de CNPJ de cada loja. Só você vê esta tela.</p></div></div>
    {sp.msg && <div className="ok">{sp.msg}</div>}{(sp.erro || error) && <div className="erro">{sp.erro ?? error?.message}</div>}
    <div className="cad-aviso" style={{ margin: "0 0 14px" }}>Verifique o CNPJ quando a loja enviar o certificado A1 com o mesmo CNPJ (aparece em verde abaixo). CNPJ verificado não pode ser usado por outra conta. Lojas novas entram em teste por 14 dias com 20 renders por mês.</div>
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar por loja, CNPJ ou e-mail do dono" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Loja</th><th>CNPJ</th><th>Plano</th><th className="r">Renders no mês</th><th>Alterar plano</th></tr></thead>
        <tbody>{L.map((e) => {
          const certOk = e.certificado && dig(e.certificado.cnpj) === dig(e.cnpj);
          return (<tr key={e.id}>
            <td><b>{e.nome}</b><div className="note">{e.donos} · {e.usuarios} usuário(s) · desde {data(e.created_at)}</div></td>
            <td className="num">{e.cnpj ? formatarCNPJ(e.cnpj) : "n/a"}
              <div>{e.cnpj_verificado ? <span className="pill p-good">Verificado</span> : <span className="pill p-warn">Não verificado</span>}</div>
              {e.certificado && <div className="note" style={{ color: certOk ? "var(--good)" : "var(--bad)" }}>A1 de {e.certificado.razao} {certOk ? "(mesmo CNPJ)" : "(CNPJ diferente!)"}</div>}
              {e.cnpj && <form action={verificar.bind(null, e.id, !e.cnpj_verificado)} style={{ marginTop: 4 }}><button className="btn sm">{e.cnpj_verificado ? "Remover verificação" : "Marcar como verificado"}</button></form>}</td>
            <td><span className={"pill " + (e.plano === "suspenso" ? "p-bad" : e.plano === "teste" ? "p-warn" : "p-good")}>{PLANOS.find((p) => p[0] === e.plano)?.[1] ?? e.plano}</span><div className="note">até {data(e.plano_ate)}</div></td>
            <td className="r num">{e.renders_mes} / {e.limite_renders}</td>
            <td><form action={definirPlano.bind(null, e.id)} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <select name="plano" defaultValue={e.plano} aria-label="Plano">{PLANOS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
              <input type="date" name="ate" defaultValue={e.plano_ate} aria-label="Válido até" />
              <input type="number" name="limite" defaultValue={e.limite_renders} min={0} style={{ width: 80 }} aria-label="Renders por mês" title="Renders por mês" />
              <button className="btn sm">Salvar</button></form></td>
          </tr>);
        })}</tbody>
      </table></div>
    </div>
  </>);
}
