import Link from "next/link";
import { contexto } from "@/lib/contexto";
export default async function SemAcesso() {
  const ctx = await contexto();
  return (
    <div className="panel" style={{ maxWidth: 560 }}>
      <h1>Sem acesso a esta área</h1>
      <p>Seu perfil nesta empresa é <b>{ctx.papel}</b>. Esta área é liberada só para outros perfis (por exemplo, o financeiro é para dono, gerente e financeiro).</p>
      <p className="note">Se precisar de acesso, peça ao dono ou gerente para mudar seu perfil em Equipe.</p>
      <Link className="btn" href={ctx.papel === "montador" ? "/producao" : "/dashboard"}>Voltar ao início</Link>
    </div>
  );
}
