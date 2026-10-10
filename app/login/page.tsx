import { entrar, criarConta } from "./actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="auth">
      <div className="panel">
        <div className="brand" style={{ color: "var(--fg)", padding: 0, marginBottom: 18 }}>
          <div className="mk">PP</div>
          <div><b>Pro Plan System</b><small style={{ color: "var(--muted)" }}>ERP de planejados</small></div>
        </div>
        {sp.erro && <div className="erro">{sp.erro}</div>}
        {sp.msg && <div className="ok">{sp.msg}</div>}
        <form className="grid" style={{ gap: 12 }}>
          <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
          <label>Senha<input name="senha" type="password" required minLength={8} autoComplete="current-password" /></label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn primary" formAction={entrar}>Entrar</button>
            <button className="btn" formAction={criarConta}>Criar conta</button>
          </div>
          <p className="note" style={{ margin: 0 }}>Ao criar a conta você confirma o e-mail e depois cadastra sua empresa.</p>
        </form>
      </div>
    </div>
  );
}
