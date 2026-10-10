import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { COOKIE_EMPRESA } from "@/lib/contexto";
import { cnpjValido, consultarCNPJ, formatarCNPJ } from "@/lib/cnpj";

async function criar(fd: FormData) {
  "use server";
  const supabase = await supabaseServidor();
  const cnpj = String(fd.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) redirect("/onboarding?erro=" + encodeURIComponent("CNPJ inválido. Confira os números."));
  const { data, error } = await supabase.rpc("criar_empresa", {
    p_nome: String(fd.get("nome")),
    p_cnpj: formatarCNPJ(cnpj),
    p_nome_usuario: String(fd.get("seu_nome") ?? ""),
  });
  if (error) redirect("/onboarding?erro=" + encodeURIComponent(error.message.includes("LIMITE_EMPRESAS") ? "Você já tem 3 empresas cadastradas. Para mais, fale com o suporte." :
    error.message.includes("empresas_cnpj_unico") ? "Esse CNPJ já está cadastrado no sistema. Se a empresa é sua, fale com o suporte para liberar." : "Não foi possível criar a empresa: " + error.message));
  // dados fiscais da Receita já entram no cadastro (razão social, endereço, regime)
  const d = await consultarCNPJ(cnpj);
  if (d) {
    const upd: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(d)) if (v && k !== "situacao") upd[k] = v;
    await supabase.from("empresas").update(upd).eq("id", String(data));
  }
  (await cookies()).set(COOKIE_EMPRESA, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ erro?: string; nova?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!sp.nova) {
    const { count } = await supabase.from("membros").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    if (count) redirect("/dashboard");
  }
  return (
    <div className="auth">
      <div className="panel">
        <h1 style={{ fontSize: 22 }}>Cadastre sua empresa</h1>
        <p className="sub" style={{ marginBottom: 16 }}>Tudo que você criar fica separado por empresa. Depois dá para adicionar outros CNPJs.</p>
        {!sp.nova && <p className="note" style={{ marginTop: -8 }}>Foi convidado por uma loja? Não cadastre empresa: abra o link do convite que recebeu.</p>}
        {sp.erro && <div className="erro">{sp.erro}</div>}
        <form action={criar} className="grid" style={{ gap: 12 }}>
          <label>Seu nome<input name="seu_nome" required defaultValue={String(user.user_metadata?.nome ?? "")} /></label>
          <label>Nome da loja ou marcenaria<input name="nome" required /></label>
          <label>CNPJ<input name="cnpj" required placeholder="00.000.000/0000-00" inputMode="numeric" /></label>
          <p className="note" style={{ margin: 0 }}>Com o CNPJ o sistema busca razão social e endereço na Receita, e ele vira a base da nota fiscal e da conexão com o banco.</p>
          <button className="btn primary">Criar empresa</button>
        </form>
      </div>
    </div>
  );
}
