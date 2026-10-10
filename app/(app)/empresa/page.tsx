import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { cnpjValido, consultarCNPJ, formatarCNPJ, limparCNPJ } from "@/lib/cnpj";
import { lerCertificadoA1 } from "@/lib/certificado";
import { cifrar } from "@/lib/cripto";
import { data } from "@/lib/formato";

const CAMPOS: [string, string, string?][] = [
  ["razao_social", "Razão social"], ["nome_fantasia", "Nome fantasia"], ["inscricao_estadual", "Inscrição estadual"],
  ["inscricao_municipal", "Inscrição municipal"], ["cnae", "CNAE principal"], ["email_fiscal", "E-mail fiscal"], ["telefone", "Telefone"],
  ["cep", "CEP"], ["logradouro", "Logradouro"], ["numero", "Número"], ["complemento", "Complemento"], ["bairro", "Bairro"],
  ["municipio", "Município"], ["uf", "UF"], ["codigo_municipio", "Código IBGE do município", "7 dígitos, usado na nota de serviço"],
];
const ir = (q: string) => { revalidatePath("/empresa"); redirect("/empresa?" + q); };

async function salvar(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const cnpj = String(fd.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) return ir("erro=" + encodeURIComponent("CNPJ inválido. Confira os números."));
  const upd: Record<string, string | null> = { cnpj: formatarCNPJ(cnpj), nome: String(fd.get("nome") || "").trim() || ctx.empresa.nome, regime_tributario: String(fd.get("regime_tributario") || "") || null };
  for (const [k] of CAMPOS) upd[k] = String(fd.get(k) ?? "").trim() || null;
  const { error } = await ctx.supabase.from("empresas").update(upd).eq("id", ctx.empresa.id);
  if (error) return ir("erro=" + encodeURIComponent(error.code === "23505" ? "Esse CNPJ já está cadastrado em outra conta." : "Somente dono ou gerente altera os dados da empresa."));
  ir("msg=" + encodeURIComponent("Dados da empresa salvos."));
}

async function buscarReceita(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const cnpj = String(fd.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) return ir("erro=" + encodeURIComponent("CNPJ inválido. Confira os números."));
  const d = await consultarCNPJ(cnpj);
  if (!d) return ir("erro=" + encodeURIComponent("Não consegui consultar a Receita agora. Preencha os campos à mão ou tente em alguns minutos."));
  const upd: Record<string, any> = { cnpj: formatarCNPJ(cnpj) };
  for (const [k, v] of Object.entries(d)) if (v && k !== "situacao") upd[k] = v;
  const { error } = await ctx.supabase.from("empresas").update(upd).eq("id", ctx.empresa.id);
  if (error) return ir("erro=" + encodeURIComponent(error.code === "23505" ? "Esse CNPJ já está cadastrado em outra conta." : error.message));
  ir("msg=" + encodeURIComponent(`Dados preenchidos pela Receita${d.situacao ? " · situação " + d.situacao : ""}. Confira e complete inscrição estadual e municipal.`));
}

async function enviarCertificado(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const arq = fd.get("pfx"), senha = String(fd.get("senha") ?? "");
  if (!(arq instanceof File) || !arq.size) return ir("erro=" + encodeURIComponent("Escolha o arquivo .pfx do certificado A1."));
  const bytes = new Uint8Array(await arq.arrayBuffer());
  let info;
  try { info = lerCertificadoA1(bytes, senha); } catch (e) { return ir("erro=" + encodeURIComponent((e as Error).message)); }
  const { data: emp } = await ctx.supabase.from("empresas").select("cnpj").eq("id", ctx.empresa.id).single();
  if (info.cnpj && emp?.cnpj && limparCNPJ(emp.cnpj) !== info.cnpj) return ir("erro=" + encodeURIComponent(`Esse certificado é do CNPJ ${formatarCNPJ(info.cnpj)}, diferente do CNPJ da empresa.`));
  if (info.validoAte < new Date()) return ir("erro=" + encodeURIComponent(`Esse certificado venceu em ${info.validoAte.toLocaleDateString("pt-BR")}.`));
  let senhaCifrada: string;
  try { senhaCifrada = cifrar(senha); } catch (e) { return ir("erro=" + encodeURIComponent((e as Error).message)); }
  const caminho = `${ctx.empresa.id}/a1.pfx`;
  const up = await ctx.supabase.storage.from("certificados").upload(caminho, bytes, { contentType: "application/x-pkcs12", upsert: true });
  if (up.error) return ir("erro=" + encodeURIComponent("Somente dono ou gerente envia o certificado."));
  const { error } = await ctx.supabase.from("certificados").upsert({
    empresa_id: ctx.empresa.id, storage_path: caminho, senha_cifrada: senhaCifrada, titular: info.titular, cnpj: info.cnpj,
    valido_ate: info.validoAte.toISOString().slice(0, 10), enviado_por: ctx.userId, enviado_em: new Date().toISOString(),
  });
  if (error) return ir("erro=" + encodeURIComponent(error.message));
  ir("msg=" + encodeURIComponent(`Certificado de ${info.titular} salvo. Válido até ${info.validoAte.toLocaleDateString("pt-BR")}.`));
}

export default async function Empresa({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  const [{ data: e }, { data: cert }] = await Promise.all([
    ctx.supabase.from("empresas").select("*").eq("id", ctx.empresa.id).single(),
    gestor ? ctx.supabase.from("certificados").select("titular, cnpj, valido_ate, enviado_em").eq("empresa_id", ctx.empresa.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const faltando = ["cnpj", "razao_social", "inscricao_municipal", "codigo_municipio", "regime_tributario"].filter((k) => !e?.[k]);
  const diasCert = cert?.valido_ate ? Math.round((new Date(cert.valido_ate + "T12:00:00").getTime() - Date.now()) / 864e5) : null;
  return (
    <>
      <div className="head"><div><h1>Empresa e fiscal</h1><p className="sub">CNPJ, dados fiscais e certificado digital, que servem de base para a nota fiscal e para a conexão com o banco</p></div></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        <div className="panel kpi"><div className="l">CNPJ</div><div className="v" style={{ fontSize: 17 }}>{e?.cnpj ?? "não informado"}</div><div className="s">{e?.cnpj && !cnpjValido(e.cnpj) ? "número inválido, corrija" : ""}</div></div>
        <div className="panel kpi"><div className="l">Regime</div><div className="v" style={{ fontSize: 17 }}>{({ mei: "MEI", simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" } as any)[e?.regime_tributario] ?? "não informado"}</div></div>
        <div className="panel kpi"><div className="l">Certificado A1</div><div className="v" style={{ fontSize: 17, color: diasCert === null ? "var(--bad)" : diasCert < 30 ? "var(--warn)" : "var(--good)" }}>{diasCert === null ? "não enviado" : diasCert < 0 ? "vencido" : `${diasCert} dias`}</div><div className="s">{cert?.valido_ate ? "válido até " + data(cert.valido_ate) : "obrigatório para emitir nota"}</div></div>
        <div className="panel kpi"><div className="l">Pronto para nota fiscal</div><div className="v" style={{ fontSize: 17, color: faltando.length || diasCert === null ? "var(--warn)" : "var(--good)" }}>{faltando.length || diasCert === null ? "falta completar" : "sim"}</div><div className="s">{faltando.length ? `${faltando.length} campo(s) obrigatório(s)` : ""}</div></div>
      </div>
      <div className="grid two">
        <form action={salvar} className="panel">
          <h2>Dados fiscais</h2>
          <div className="form">
            <label>CNPJ<input name="cnpj" required defaultValue={e?.cnpj ?? ""} disabled={!gestor} placeholder="00.000.000/0000-00" /></label>
            <label>Nome no sistema<input name="nome" defaultValue={e?.nome ?? ""} disabled={!gestor} /></label>
            <label>Regime tributário<select name="regime_tributario" defaultValue={e?.regime_tributario ?? ""} disabled={!gestor}>
              <option value="">Selecione</option><option value="mei">MEI</option><option value="simples">Simples Nacional</option><option value="presumido">Lucro Presumido</option><option value="real">Lucro Real</option></select></label>
            {CAMPOS.map(([k, l, dica]) => (
              <label key={k}>{l}<input name={k} defaultValue={e?.[k] ?? ""} disabled={!gestor} title={dica} /></label>
            ))}
          </div>
          {gestor && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              <button className="btn primary">Salvar</button>
              <button className="btn" formAction={buscarReceita} formNoValidate>Preencher pela Receita</button>
            </div>
          )}
          <p className="note" style={{ marginBottom: 0 }}>Preencher pela Receita usa o CNPJ digitado e traz razão social, endereço, CNAE e regime. Inscrição estadual e municipal você completa à mão.</p>
        </form>
        <div className="panel">
          <h2>Certificado digital A1</h2>
          {cert && <div className="row"><span>{cert.titular}<br /><span className="note">CNPJ {cert.cnpj ? formatarCNPJ(cert.cnpj) : "n/a"} · enviado {data(cert.enviado_em)}</span></span><span className={"pill " + ((diasCert ?? -1) < 30 ? "p-warn" : "p-good")}>até {data(cert.valido_ate)}</span></div>}
          {gestor ? (
            <form action={enviarCertificado} className="grid mt" style={{ gap: 10 }}>
              <label>Arquivo do certificado (.pfx ou .p12)<input type="file" name="pfx" accept=".pfx,.p12,application/x-pkcs12" required /></label>
              <label>Senha do certificado<input type="password" name="senha" required autoComplete="off" /></label>
              <button className="btn primary">{cert ? "Trocar certificado" : "Enviar certificado"}</button>
            </form>
          ) : <p className="note">Somente dono ou gerente envia o certificado.</p>}
          <p className="note" style={{ marginBottom: 0 }}>O sistema confere a senha, o CNPJ e a validade antes de salvar. O arquivo fica num armazenamento privado e a senha é guardada cifrada, sem aparecer em nenhuma tela.</p>
        </div>
      </div>
    </>
  );
}
