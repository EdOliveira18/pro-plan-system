import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";
import { COOKIE_EMPRESA } from "@/lib/contexto";
import { sair } from "@/app/login/actions";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAPEL: Record<string, string> = { dono: "Dono", gerente: "Gerente", vendedor: "Vendedor", projetista: "Projetista", financeiro: "Financeiro", montador: "Montador" };

const ERROS: [string, string][] = [
  ["CONVITE_INVALIDO", "Este convite não existe ou foi cancelado. Peça um novo link para quem te convidou."],
  ["CONVITE_USADO", "Este convite já foi aceito. Se foi você, é só entrar no sistema."],
  ["CONVITE_EXPIRADO", "Este convite venceu (vale 7 dias). Peça um novo link para quem te convidou."],
  ["CONVITE_OUTRO_EMAIL", "Você está logado com um e-mail diferente do convite. Saia e entre com o e-mail convidado."],
];

async function aceitar(token: string) {
  "use server";
  const supabase = await supabaseServidor();
  const { data, error } = await supabase.rpc("aceitar_convite", { p_token: token });
  if (error) {
    const m = ERROS.find(([k]) => error.message.includes(k))?.[1] ?? "Não foi possível aceitar o convite agora. Tente de novo.";
    redirect(`/convite/${token}?erro=${encodeURIComponent(m)}`);
  }
  const empresa = (data as any)?.empresa_id;
  if (empresa) (await cookies()).set(COOKIE_EMPRESA, String(empresa), { path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/dashboard");
}

export default async function Convite({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServidor();
  const info = UUID.test(token) ? ((await supabase.rpc("convite_publico", { p_token: token })).data as any) : null;
  const { data: { user } } = await supabase.auth.getUser();
  const next = encodeURIComponent(`/convite/${token}`);

  return (
    <div className="auth">
      <div className="panel">
        <div className="brand" style={{ color: "var(--fg)", padding: 0, marginBottom: 18 }}>
          <div className="mk">PP</div>
          <div><b>Pro Plan System</b><small style={{ color: "var(--muted)" }}>Convite para a equipe</small></div>
        </div>
        {sp.erro && <div className="erro">{sp.erro}</div>}
        {!info ? (
          <p>Este convite não existe ou foi cancelado. Peça um novo link para quem te convidou.</p>
        ) : !info.valido ? (
          <p>Este convite para <b>{info.empresa}</b> já foi usado ou venceu. Peça um novo link para quem te convidou.</p>
        ) : (
          <>
            <h1 style={{ fontSize: 22 }}>Olá, {String(info.nome ?? "").split(" ")[0] || "tudo bem"}!</h1>
            <p className="sub" style={{ marginBottom: 16 }}>Você foi convidado para a equipe de <b>{info.empresa}</b> como <b>{PAPEL[info.papel] ?? info.papel}</b>.</p>
            {user ? (
              (user.email ?? "").toLowerCase() === String(info.email).toLowerCase() ? (
                <form action={aceitar.bind(null, token)}><button className="btn primary" style={{ width: "100%" }}>Aceitar e entrar na equipe</button></form>
              ) : (
                <>
                  <div className="erro">Você está logado como {user.email}, mas o convite é para {info.email}.</div>
                  <form action={sair}><button className="btn" style={{ width: "100%" }}>Sair e entrar com o e-mail do convite</button></form>
                </>
              )
            ) : (
              <div className="grid" style={{ gap: 10 }}>
                <Link className="btn primary" href={`/login?modo=criar&next=${next}`}>Criar minha conta com {info.email}</Link>
                <Link className="btn" href={`/login?next=${next}`}>Já tenho conta, quero entrar</Link>
                <p className="note" style={{ margin: 0 }}>Use exatamente o e-mail {info.email}. Depois de entrar você volta para esta página e confirma o convite.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
