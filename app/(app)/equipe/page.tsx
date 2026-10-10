import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { enviarEmail, emailConfigurado, moldura, esc } from "@/lib/email";
import { data } from "@/lib/formato";

const PAPEIS: [string, string, string][] = [
  ["dono", "Dono", "Tudo, inclusive equipe, premissas do olhinho e venda abaixo do mínimo"],
  ["gerente", "Gerente", "Mesmos poderes do dono"],
  ["vendedor", "Vendedor", "Usa os módulos da operação, sem mexer em equipe e premissas"],
  ["projetista", "Projetista", "Usa os módulos da operação, sem mexer em equipe e premissas"],
  ["financeiro", "Financeiro", "Usa os módulos da operação, sem mexer em equipe e premissas"],
  ["montador", "Montador", "Como o vendedor, mas sem acesso aos lançamentos financeiros"],
];
const NOME = Object.fromEntries(PAPEIS.map(([k, n]) => [k, n]));
const ir = (m: string, tipo: "erro" | "msg" = "erro") => redirect(`/equipe?${tipo}=${encodeURIComponent(m)}`);

async function convidar(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const email = String(fd.get("email")).trim().toLowerCase();
  const { error } = await ctx.supabase.from("convites").insert({
    empresa_id: ctx.empresa.id, email, nome: String(fd.get("nome")).trim(), papel: String(fd.get("papel")), criado_por: ctx.userId,
  });
  if (error) ir(error.code === "23505" ? "Esse e-mail já foi convidado." : "Somente dono ou gerente cadastra usuários.");
  revalidatePath("/equipe");
  let aviso = `Peça para ${email} criar a conta com esse e-mail; ele entra direto na equipe.`;
  if (emailConfigurado()) {
    const site = process.env.APP_URL || "https://pro-plan-system.vercel.app";
    try {
      await enviarEmail({ para: email, assunto: `Convite para a equipe ${ctx.empresa.nome} no Pro Plan System`,
        html: moldura("Você foi convidado", `<p>Olá, ${esc(fd.get("nome"))}! Você foi adicionado à equipe de <b>${esc(ctx.empresa.nome)}</b> no Pro Plan System.</p>
          <p>Para entrar, crie sua conta usando este mesmo e-mail (${esc(email)}):</p>
          <p><a href="${site}/login" style="background:#1F5E57;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;display:inline-block">Criar minha conta</a></p>`) });
      aviso = `Convite enviado por e-mail para ${email}.`;
    } catch { aviso += " (O e-mail de convite não pôde ser enviado; avise a pessoa.)"; }
  }
  ir(`Usuário cadastrado. ${aviso}`, "msg");
}

async function mudarPapel(userId: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  if (userId === ctx.userId) ir("Você não pode mudar o seu próprio papel.");
  const { error } = await ctx.supabase.from("membros").update({ papel: String(fd.get("papel")) }).eq("empresa_id", ctx.empresa.id).eq("user_id", userId);
  if (error) ir("Somente dono ou gerente altera papéis.");
  revalidatePath("/equipe");
}

async function alternarAtivo(userId: string, ativo: boolean) {
  "use server";
  const ctx = await contexto();
  if (userId === ctx.userId) ir("Você não pode desativar o seu próprio acesso.");
  const { error } = await ctx.supabase.from("membros").update({ ativo }).eq("empresa_id", ctx.empresa.id).eq("user_id", userId);
  if (error) ir("Somente dono ou gerente altera acessos.");
  revalidatePath("/equipe");
}

async function cancelarConvite(id: string) {
  "use server";
  const ctx = await contexto();
  await ctx.supabase.from("convites").delete().eq("id", id);
  revalidatePath("/equipe");
}

export default async function Equipe({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  const [{ data: membros }, { data: convites }] = await Promise.all([
    ctx.supabase.from("membros").select("user_id, nome, email, papel, ativo, created_at").eq("empresa_id", ctx.empresa.id).order("created_at"),
    gestor ? ctx.supabase.from("convites").select("*").eq("empresa_id", ctx.empresa.id).is("aceito_em", null).order("created_at", { ascending: false }) : Promise.resolve({ data: [] as any[] }),
  ]);
  return (
    <>
      <div className="head"><div><h1>Equipe</h1><p className="sub">Quem acessa {ctx.empresa.nome} e o que cada pessoa pode fazer</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      <div className="grid two">
        <div className="panel">
          <h2>Usuários com acesso</h2>
          <div className="scroll"><table>
            <thead><tr><th>Nome</th><th>Papel</th><th>Desde</th><th></th></tr></thead>
            <tbody>{(membros ?? []).map((m) => (
              <tr key={m.user_id} style={{ opacity: m.ativo ? 1 : 0.5 }}>
                <td><b>{m.nome}</b>{m.user_id === ctx.userId && <span className="pill p-info" style={{ marginLeft: 6 }}>você</span>}<div className="note">{m.email}</div></td>
                <td>{gestor && m.user_id !== ctx.userId ? (
                  <form action={mudarPapel.bind(null, m.user_id)} style={{ display: "flex", gap: 6 }}>
                    <select name="papel" defaultValue={m.papel} aria-label={`Papel de ${m.nome}`}>{PAPEIS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
                    <button className="btn sm">Salvar</button>
                  </form>
                ) : <span className="pill p-neu">{NOME[m.papel]}</span>}</td>
                <td className="note">{data(m.created_at)}</td>
                <td>{gestor && m.user_id !== ctx.userId && (
                  <form action={alternarAtivo.bind(null, m.user_id, !m.ativo)}><button className="btn sm">{m.ativo ? "Desativar" : "Reativar"}</button></form>
                )}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {gestor && !!convites?.length && (<>
            <h2 className="mt">Aguardando criar a conta</h2>
            {convites.map((c: any) => (
              <div key={c.id} className="row" style={{ alignItems: "center" }}>
                <span><b>{c.nome}</b> <span className="note">{c.email} · {NOME[c.papel]}</span></span>
                <form action={cancelarConvite.bind(null, c.id)}><button className="btn sm">Cancelar</button></form>
              </div>
            ))}
          </>)}
        </div>
        <div className="panel">
          <h2>Cadastrar usuário</h2>
          {gestor ? (
            <form action={convidar} className="grid" style={{ gap: 12 }}>
              <label>Nome<input name="nome" required /></label>
              <label>E-mail<input name="email" type="email" required /></label>
              <label>Papel<select name="papel" defaultValue="vendedor">{PAPEIS.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <button className="btn primary">Cadastrar</button>
              <p className="note" style={{ margin: 0 }}>Depois, a pessoa abre o sistema, clica em <b>Criar conta</b> e usa esse mesmo e-mail. Ela entra direto na sua empresa, com o papel escolhido.</p>
            </form>
          ) : <p className="note">Somente dono ou gerente cadastra usuários.</p>}
          <h2 className="mt">O que cada papel faz</h2>
          {PAPEIS.map(([k, n, d]) => <div key={k} className="row"><b style={{ minWidth: 90 }}>{n}</b><span className="note" style={{ textAlign: "right" }}>{d}</span></div>)}
        </div>
      </div>
    </>
  );
}
