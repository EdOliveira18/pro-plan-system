import { contexto, exigir } from "@/lib/contexto";

// Mostra só se cada chave existe no servidor; o valor nunca sai do servidor nem aparece na tela
const ITENS: { nome: string; para: string; chaves: string[]; sem: string }[] = [
  { nome: "Banco de dados (Supabase)", para: "Login, dados e arquivos", chaves: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"], sem: "O sistema não funciona." },
  { nome: "Chave de serviço do Supabase", para: "Tarefas automáticas (recorrências, Open Finance em segundo plano)", chaves: ["SUPABASE_SERVICE_ROLE_KEY"], sem: "Rotinas automáticas e o webhook do banco ficam parados; o uso manual funciona." },
  { nome: "E-mail (Resend)", para: "Convites, pesquisa de pós-venda e avisos por e-mail", chaves: ["RESEND_API_KEY"], sem: "Nada é enviado por e-mail; os links de convite e pesquisa continuam funcionando pelo WhatsApp." },
  { nome: "Render com IA (OpenAI)", para: "Render Pro", chaves: ["OPENAI_API_KEY"], sem: "O Render Pro mostra erro ao gerar." },
  { nome: "Open Finance (Pluggy)", para: "Extrato bancário automático", chaves: ["PLUGGY_CLIENT_ID", "PLUGGY_CLIENT_SECRET", "PLUGGY_WEBHOOK_SECRET"], sem: "Use a importação de OFX no Financeiro." },
  { nome: "Segredo do certificado A1", para: "Guardar o certificado digital criptografado", chaves: ["CERT_SECRET"], sem: "Não é possível enviar o certificado A1." },
  { nome: "Segredo das rotinas", para: "Proteger as rotinas agendadas", chaves: ["CRON_SECRET"], sem: "As rotinas agendadas recusam a execução." },
];

export default async function Integracoes() {
  const ctx = await contexto();
  exigir(ctx, ctx.gestor || ctx.admin);
  const tem = (k: string) => !!process.env[k] && String(process.env[k]).trim() !== "";
  return (
    <>
      <div className="head"><div><nav className="migalha">Configurações › Integrações</nav><h1>Integrações</h1>
        <p className="sub">O que está ligado no servidor. Por segurança, esta página só diz se cada chave existe; o valor nunca aparece aqui.</p></div></div>
      <div className="panel" style={{ padding: 0 }}>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Integração</th><th>Para que serve</th><th>Situação</th><th>Se estiver desligada</th></tr></thead>
          <tbody>{ITENS.map((i) => {
            const faltam = i.chaves.filter((k) => !tem(k));
            return (
              <tr key={i.nome}>
                <td><b>{i.nome}</b></td>
                <td className="note">{i.para}</td>
                <td>{faltam.length ? <><span className="pill p-bad">Desligada</span><div className="note">Falta: {faltam.join(", ")}</div></> : <span className="pill p-good">Ligada</span>}</td>
                <td className="note">{faltam.length ? i.sem : ""}</td>
              </tr>
            );
          })}</tbody>
        </table></div>
      </div>
      <p className="note">As chaves são cadastradas na Vercel, em Settings › Environment Variables, e passam a valer no próximo deploy. Nunca envie chaves por chat ou e-mail.</p>
    </>
  );
}
