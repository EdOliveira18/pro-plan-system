import Link from "next/link";
import { entrar, criarConta } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string; modo?: string; next?: string }> }) {
  const sp = await searchParams;
  const criar = sp.modo === "criar";
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "";
  const qn = next ? "next=" + encodeURIComponent(next) : "";
  const oculto = next ? <input type="hidden" name="next" value={next} /> : null;
  const aba = (ativa: boolean) => ({
    flex: 1, textAlign: "center" as const, padding: "9px 0", fontWeight: 600, textDecoration: "none",
    color: ativa ? "var(--fg)" : "var(--muted)", borderBottom: "2px solid " + (ativa ? "var(--gold)" : "var(--line)"),
  });
  return (
    <div className="auth">
      <div className="panel">
        <div className="brand" style={{ color: "var(--fg)", padding: 0, marginBottom: 18 }}>
          <div className="mk">PP</div>
          <div><b>Pro Plan System</b><small style={{ color: "var(--muted)" }}>ERP de planejados</small></div>
        </div>
        <div style={{ display: "flex", marginBottom: 16 }}>
          <Link href={"/login" + (qn ? "?" + qn : "")} style={aba(!criar)}>Entrar</Link>
          <Link href={"/login?modo=criar" + (qn ? "&" + qn : "")} style={aba(criar)}>Criar conta</Link>
        </div>
        {sp.erro && <div className="erro">{sp.erro}</div>}
        {sp.msg && <div className="ok">{sp.msg}</div>}
        {criar ? (
          <form action={criarConta} className="grid" style={{ gap: 12 }}>
            {oculto}
            <label>Seu nome<input name="nome" required autoComplete="name" /></label>
            <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
            <label>Senha (mínimo 8 caracteres)<input name="senha" type="password" required minLength={8} autoComplete="new-password" /></label>
            <button className="btn primary">Criar conta</button>
            <p className="note" style={{ margin: 0 }}>Se a sua loja te convidou, abra o link do convite e crie a conta com o mesmo e-mail dele. Se não, depois de criar a conta você cadastra a sua empresa.</p>
          </form>
        ) : (
          <form action={entrar} className="grid" style={{ gap: 12 }}>
            {oculto}
            <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
            <label>Senha<input name="senha" type="password" required autoComplete="current-password" /></label>
            <button className="btn primary">Entrar</button>
            <p className="note" style={{ margin: 0 }}>Ainda não tem conta? <Link href={"/login?modo=criar" + (qn ? "&" + qn : "")}>Crie aqui</Link>.</p>
          </form>
        )}
      </div>
    </div>
  );
}
