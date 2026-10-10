import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { COOKIE_EMPRESA } from "@/lib/contexto";

async function criar(fd: FormData) {
  "use server";
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.rpc("criar_empresa", {
    p_nome: String(fd.get("nome")),
    p_cnpj: String(fd.get("cnpj") ?? ""),
    p_nome_usuario: String(fd.get("seu_nome") ?? ""),
  });
  if (error) redirect("/onboarding?erro=" + encodeURIComponent(error.message));
  (await cookies()).set(COOKIE_EMPRESA, String(data), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ erro?: string; nova?: string }> }) {
  const sp = await searchParams;
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (!sp.nova) {
    await supabase.rpc("aceitar_convites");
    const { count } = await supabase.from("membros").select("*", { count: "exact", head: true }).eq("user_id", user.id);
    if (count) redirect("/dashboard");
  }
  return (
    <div className="auth">
      <div className="panel">
        <h1 style={{ fontSize: 22 }}>Cadastre sua empresa</h1>
        <p className="sub" style={{ marginBottom: 16 }}>Tudo que você criar fica separado por empresa. Depois dá para adicionar outros CNPJs.</p>
        {sp.erro && <div className="erro">{sp.erro}</div>}
        <form action={criar} className="grid" style={{ gap: 12 }}>
          <label>Seu nome<input name="seu_nome" required defaultValue={String(user.user_metadata?.nome ?? "")} /></label>
          <label>Nome da loja ou marcenaria<input name="nome" required /></label>
          <label>CNPJ<input name="cnpj" placeholder="00.000.000/0000-00" /></label>
          <button className="btn primary">Criar empresa</button>
        </form>
      </div>
    </div>
  );
}
