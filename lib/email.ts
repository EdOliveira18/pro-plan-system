import "server-only";
// Envio de e-mail pelo Resend (https://resend.com). Plano gratuito: 3.000 e-mails por mês, 100 por dia.
// Variáveis: RESEND_API_KEY (obrigatória) e EMAIL_FROM (ex.: "Pro Plan System <notas@seudominio.com.br>").
export type Anexo = { filename: string; content: string /* base64 */ };

export const emailConfigurado = () => !!process.env.RESEND_API_KEY;

export async function enviarEmail(m: { para: string | string[]; assunto: string; html: string; anexos?: Anexo[]; responderPara?: string }) {
  const chave = process.env.RESEND_API_KEY;
  if (!chave) throw new Error("O envio de e-mail ainda não foi ativado (falta a chave RESEND_API_KEY na Vercel).");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Pro Plan System <onboarding@resend.dev>",
      to: Array.isArray(m.para) ? m.para : [m.para],
      subject: m.assunto, html: m.html,
      ...(m.responderPara ? { reply_to: m.responderPara } : {}),
      ...(m.anexos?.length ? { attachments: m.anexos } : {}),
    }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("Falha no envio do e-mail: " + (corpo?.message ?? r.status));
  return corpo?.id as string | undefined;
}

export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export function moldura(titulo: string, corpo: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1E2321">
  <div style="background:#1B2130;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0"><b style="color:#E2A95B">Pro Plan System</b></div>
  <div style="border:1px solid #DDD9CF;border-top:0;padding:20px;border-radius:0 0 10px 10px">
  <h2 style="margin:0 0 12px;font-size:18px">${esc(titulo)}</h2>${corpo}</div>
  <p style="font-size:11px;color:#67706B;text-align:center">Enviado automaticamente pelo Pro Plan System.</p></div>`;
}
