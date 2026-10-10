import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Página pública da pesquisa de satisfação: acessa só pelo token, via funções do banco liberadas para visitantes
const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });

async function responder(token: string, fd: FormData) {
  "use server";
  const n = (k: string) => (fd.get(k) == null ? null : Number(fd.get(k)));
  await anon().rpc("responder_pesquisa", { p_token: token, p_nps: n("nps"), p_atend: n("atendimento"), p_mont: n("montagem"), p_prazo: n("prazo"), p_coment: String(fd.get("comentario") || "") });
  redirect(`/pesquisa/${token}?ok=1`);
}

export default async function Pesquisa({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ ok?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const valido = /^[0-9a-f-]{36}$/i.test(token);
  const { data: info } = valido ? await anon().rpc("pesquisa_publica", { p_token: token }) : { data: null };
  const Estrelas = ({ n, l }: { n: string; l: string }) => (
    <fieldset style={{ border: 0, padding: 0, margin: "14px 0" }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>{l}</legend>
      <div style={{ display: "flex", gap: 6 }}>{[1, 2, 3, 4, 5].map((v) => <label key={v} className="opcao"><input type="radio" name={n} value={v} required /><span>{"★".repeat(v)}</span></label>)}</div></fieldset>);
  return (
    <main style={{ maxWidth: 560, margin: "0 auto", padding: "32px 16px" }}>
      {!info ? <div className="panel"><h1>Pesquisa não encontrada</h1><p className="note">Confira o link recebido.</p></div>
        : sp.ok || info.respondida ? <div className="panel"><h1>Obrigado!</h1><p>Sua opinião ajuda a {info.empresa} a melhorar cada projeto.</p></div>
        : <form action={responder.bind(null, token)} className="panel">
          <p className="note" style={{ margin: 0 }}>{info.empresa} · contrato {info.contrato}</p>
          <h1 style={{ fontSize: 22 }}>Olá, {String(info.cliente).split(" ")[0]}! Como foi sua experiência?</h1>
          <fieldset style={{ border: 0, padding: 0, margin: "14px 0" }}><legend style={{ fontWeight: 600, marginBottom: 6 }}>De 0 a 10, quanto você recomendaria a gente para um amigo?</legend>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{Array.from({ length: 11 }, (_, v) => <label key={v} className="opcao"><input type="radio" name="nps" value={v} required /><span>{v}</span></label>)}</div></fieldset>
          <Estrelas n="atendimento" l="Atendimento do vendedor e projetista" />
          <Estrelas n="montagem" l="Qualidade da montagem" />
          <Estrelas n="prazo" l="Cumprimento do prazo" />
          <label style={{ marginTop: 8 }}>Quer deixar um comentário?<textarea name="comentario" rows={3} /></label>
          <button className="btn primary" style={{ marginTop: 14, width: "100%" }}>Enviar avaliação</button>
        </form>}
    </main>
  );
}
