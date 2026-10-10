import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enviarContabilidade } from "@/lib/contabilidade";
import { emailConfigurado } from "@/lib/email";
import { contexto } from "@/lib/contexto";
import { cnpjValido, consultarCNPJ, formatarCNPJ, limparCNPJ } from "@/lib/cnpj";
import { lerCertificadoA1 } from "@/lib/certificado";
import { cifrar } from "@/lib/cripto";
import { data } from "@/lib/formato";
import { pendenciasFiscais, REGIMES, UFS } from "@/lib/fiscal";

const ir = (q: string) => { revalidatePath("/empresa"); revalidatePath("/notas"); redirect("/empresa?" + q); };
const txt = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim() || null;
const int = (fd: FormData, k: string) => Math.max(0, parseInt(String(fd.get(k) ?? "0")) || 0);
const dec = (fd: FormData, k: string) => { const v = String(fd.get(k) ?? "").replace(",", "."); return v === "" ? null : Number(v); };

async function salvar(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const cnpj = String(fd.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) return ir("erro=" + encodeURIComponent("CNPJ inválido. Confira os números."));

  // 1. dados gerais
  const emp: Record<string, unknown> = { cnpj: formatarCNPJ(cnpj), nome: txt(fd, "nome_fantasia") ?? ctx.empresa.nome };
  for (const k of ["razao_social", "nome_fantasia", "inscricao_estadual", "inscricao_municipal", "cnae", "regime_tributario", "cep", "logradouro",
    "numero", "bairro", "complemento", "municipio", "uf", "codigo_municipio", "telefone", "email_fiscal"]) emp[k] = txt(fd, k);
  const e1 = await ctx.supabase.from("empresas").update(emp).eq("id", ctx.empresa.id);
  if (e1.error) return ir("erro=" + encodeURIComponent(e1.error.code === "23505" ? "Esse CNPJ já está cadastrado em outra conta." : "Somente dono ou gerente altera os dados fiscais."));

  // 2. parâmetros das notas
  const e2 = await ctx.supabase.from("config_fiscal").upsert({
    empresa_id: ctx.empresa.id, ambiente: fd.get("ambiente") === "producao" ? "producao" : "homologacao",
    nfe_ultimo: int(fd, "nfe_ultimo"), nfe_serie: int(fd, "nfe_serie"), mdfe_ultimo: int(fd, "mdfe_ultimo"), mdfe_serie: int(fd, "mdfe_serie"),
    nfse_ultimo: int(fd, "nfse_ultimo"), nfse_serie: int(fd, "nfse_serie"),
    cfop_padrao: txt(fd, "cfop_padrao") ?? "5102", ncm_padrao: txt(fd, "ncm_padrao"), codigo_servico_nfse: txt(fd, "codigo_servico_nfse"),
    aliquota_iss: dec(fd, "aliquota_iss"), info_complementar: txt(fd, "info_complementar"),
    ibscbs_habilitado: fd.get("ibscbs_habilitado") === "on",
    cbs_aliquota: dec(fd, "cbs_aliquota") ?? 0.9, ibs_uf_aliquota: dec(fd, "ibs_uf_aliquota") ?? 0.1, ibs_mun_aliquota: dec(fd, "ibs_mun_aliquota") ?? 0,
    cst_ibscbs: txt(fd, "cst_ibscbs") ?? "000", cclasstrib: txt(fd, "cclasstrib") ?? "000001",
    envio_contabilidade: fd.get("envio_contabilidade") === "on", email_contabilidade: txt(fd, "email_contabilidade"),
    updated_at: new Date().toISOString(),
  });
  if (e2.error) return ir("erro=" + encodeURIComponent(e2.error.message));

  // 3. certificado (opcional: em branco mantém o atual)
  const arq = fd.get("pfx");
  if (arq instanceof File && arq.size) {
    const senha = String(fd.get("senha") ?? "");
    const bytes = new Uint8Array(await arq.arrayBuffer());
    let info;
    try { info = lerCertificadoA1(bytes, senha); } catch (e) { return ir("erro=" + encodeURIComponent((e as Error).message)); }
    if (info.cnpj && limparCNPJ(cnpj) !== info.cnpj) return ir("erro=" + encodeURIComponent(`Esse certificado é do CNPJ ${formatarCNPJ(info.cnpj)}, diferente do CNPJ da empresa.`));
    if (info.validoAte < new Date()) return ir("erro=" + encodeURIComponent(`Esse certificado venceu em ${info.validoAte.toLocaleDateString("pt-BR")}.`));
    let senhaCifrada: string;
    try { senhaCifrada = cifrar(senha); } catch (e) { return ir("erro=" + encodeURIComponent((e as Error).message)); }
    const caminho = `${ctx.empresa.id}/a1.pfx`;
    const up = await ctx.supabase.storage.from("certificados").upload(caminho, bytes, { contentType: "application/x-pkcs12", upsert: true });
    if (up.error) return ir("erro=" + encodeURIComponent("Não foi possível guardar o certificado: " + up.error.message));
    const e3 = await ctx.supabase.from("certificados").upsert({
      empresa_id: ctx.empresa.id, storage_path: caminho, senha_cifrada: senhaCifrada, titular: info.titular, cnpj: info.cnpj,
      valido_ate: info.validoAte.toISOString().slice(0, 10), enviado_por: ctx.userId, enviado_em: new Date().toISOString(),
    });
    if (e3.error) return ir("erro=" + encodeURIComponent(e3.error.message));
  }
  ir("msg=" + encodeURIComponent("Configurações salvas."));
}

async function testarContabilidade() {
  "use server";
  const ctx = await contexto();
  let destino: string;
  try {
    const r = await enviarContabilidade(ctx.supabase, ctx.empresa.id);
    destino = "/empresa?msg=" + encodeURIComponent(`E-mail das notas de ${r.rotulo} enviado para ${r.para} (${r.quantidade} nota(s)).`);
  } catch (e: any) {
    destino = "/empresa?erro=" + encodeURIComponent(e.message);
  }
  redirect(destino);
}

async function buscarReceita(fd: FormData) {
  "use server";
  const ctx = await contexto();
  const cnpj = String(fd.get("cnpj") ?? "");
  if (!cnpjValido(cnpj)) return ir("erro=" + encodeURIComponent("CNPJ inválido. Confira os números."));
  const d = await consultarCNPJ(cnpj);
  if (!d) return ir("erro=" + encodeURIComponent("Não consegui consultar a Receita agora. Preencha à mão ou tente em alguns minutos."));
  const upd: Record<string, unknown> = { cnpj: formatarCNPJ(cnpj) };
  for (const [k, v] of Object.entries(d)) if (v && k !== "situacao") upd[k] = v;
  const { error } = await ctx.supabase.from("empresas").update(upd).eq("id", ctx.empresa.id);
  if (error) return ir("erro=" + encodeURIComponent(error.code === "23505" ? "Esse CNPJ já está cadastrado em outra conta." : error.message));
  ir("msg=" + encodeURIComponent(`Dados preenchidos pela Receita${d.situacao ? " · situação " + d.situacao : ""}. Complete a inscrição estadual e salve.`));
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section style={{ borderTop: "1px solid var(--line)", paddingTop: 18, marginTop: 18 }}>
      <h2 style={{ borderLeft: "3px solid var(--gold)", paddingLeft: 10, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 14, fontFamily: "var(--f-body)", fontWeight: 700 }}>{titulo}</h2>
      {children}
    </section>
  );
}
const Campo = ({ n, l, v, obrig, span = 1, ...rest }: { n: string; l: string; v?: any; obrig?: boolean; span?: number } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <label style={{ gridColumn: `span ${span}` }}>{l}{obrig && <b style={{ color: "var(--bad)" }}> *</b>}<input name={n} defaultValue={v ?? ""} {...rest} /></label>
);

export default async function Empresa({ searchParams }: { searchParams: Promise<{ erro?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const gestor = ["dono", "gerente"].includes(ctx.papel);
  const [{ data: e }, { data: cert }, { data: cfg }] = await Promise.all([
    ctx.supabase.from("empresas").select("*").eq("id", ctx.empresa.id).single(),
    gestor ? ctx.supabase.from("certificados").select("titular, cnpj, valido_ate, enviado_em").eq("empresa_id", ctx.empresa.id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.supabase.from("config_fiscal").select("*").eq("empresa_id", ctx.empresa.id).maybeSingle(),
  ]);
  const c: Record<string, any> = cfg ?? { ambiente: "homologacao", nfe_ultimo: 0, nfe_serie: 1, mdfe_ultimo: 0, mdfe_serie: 1, nfse_ultimo: 0, nfse_serie: 1, cfop_padrao: "5102", ibscbs_habilitado: true, cbs_aliquota: 0.9, ibs_uf_aliquota: 0.1, ibs_mun_aliquota: 0, cst_ibscbs: "000", cclasstrib: "000001" };
  const pend = pendenciasFiscais(e, cert, cfg);
  const total = Number(c.cbs_aliquota) + Number(c.ibs_uf_aliquota) + Number(c.ibs_mun_aliquota);
  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 } as const;

  return (
    <>
      <div className="note" style={{ marginBottom: 6 }}>Configurações / Notas fiscais</div>
      <div className="head"><div><h1>Dados da empresa e parâmetros das notas fiscais</h1><p className="sub">Base da emissão de NF-e, NFS-e e MDF-e, e do vínculo das contas bancárias ao CNPJ</p></div>
        <Link className="btn" href="/notas">Ver notas emitidas</Link></div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      {sp.msg && <div className="ok">{sp.msg}</div>}
      {pend.length > 0
        ? <div className="lock p-warn" style={{ marginTop: 0, marginBottom: 12 }}>Para emitir notas ainda falta: {pend.join(", ")}.</div>
        : <div className="lock p-good" style={{ marginTop: 0, marginBottom: 12 }}>Emitente configurado. Ambiente atual: {c.ambiente === "producao" ? "Produção (notas com valor fiscal)" : "Homologação (testes, sem valor fiscal)"}.</div>}

      <form action={salvar} className="panel">
        <fieldset disabled={!gestor} style={{ border: 0, padding: 0, margin: 0 }}>
          <section>
            <h2 style={{ borderLeft: "3px solid var(--gold)", paddingLeft: 10, textTransform: "uppercase", letterSpacing: ".06em", fontSize: 14, fontFamily: "var(--f-body)", fontWeight: 700 }}>Dados gerais</h2>
            <div style={grade}>
              <Campo n="cnpj" l="CNPJ" v={e?.cnpj} obrig required placeholder="00.000.000/0000-00" />
              <Campo n="razao_social" l="Razão social" v={e?.razao_social} obrig span={2} />
              <Campo n="nome_fantasia" l="Nome fantasia" v={e?.nome_fantasia ?? e?.nome} obrig />
              <Campo n="inscricao_estadual" l="Inscrição estadual" v={e?.inscricao_estadual} obrig placeholder="ou ISENTO" />
              <Campo n="inscricao_municipal" l="Inscrição municipal" v={e?.inscricao_municipal} />
              <Campo n="cnae" l="CNAE" v={e?.cnae} obrig />
              <label>Regime tributário<b style={{ color: "var(--bad)" }}> *</b><select name="regime_tributario" defaultValue={e?.regime_tributario ?? ""}><option value="">Selecione</option>{Object.entries(REGIMES).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
              <Campo n="cep" l="CEP" v={e?.cep} obrig placeholder="00000-000" />
              <Campo n="logradouro" l="Endereço" v={e?.logradouro} obrig span={2} placeholder="Rua, Av, Travessa..." />
              <Campo n="numero" l="Número" v={e?.numero} obrig />
              <Campo n="bairro" l="Bairro" v={e?.bairro} obrig />
              <Campo n="complemento" l="Complemento" v={e?.complemento} />
              <Campo n="municipio" l="Cidade" v={e?.municipio} obrig />
              <label>UF<b style={{ color: "var(--bad)" }}> *</b><select name="uf" defaultValue={e?.uf ?? ""}><option value="">Selecione</option>{UFS.map((u) => <option key={u}>{u}</option>)}</select></label>
              <Campo n="codigo_municipio" l="Código município (IBGE)" v={e?.codigo_municipio} obrig placeholder="7 dígitos" />
              <Campo n="telefone" l="Telefone" v={e?.telefone} obrig placeholder="(00) 0000-0000" />
              <Campo n="email_fiscal" l="E-mail" v={e?.email_fiscal} obrig type="email" span={2} placeholder="email@exemplo.com" />
            </div>
            <div style={{ marginTop: 10 }}><button className="btn sm" formAction={buscarReceita} formNoValidate>Preencher pela Receita usando o CNPJ</button></div>
          </section>

          <Secao titulo="Certificado digital">
            {cert ? (
              <div className={"lock " + (new Date(cert.valido_ate + "T23:59:59") < new Date() ? "p-bad" : "p-good")} style={{ marginTop: 0 }}>
                <b>Certificado configurado</b><br />{cert.titular} · CNPJ {cert.cnpj ? formatarCNPJ(cert.cnpj) : "n/a"} · válido até {data(cert.valido_ate)} · enviado em {data(cert.enviado_em)}
              </div>
            ) : (
              <div className="lock p-warn" style={{ marginTop: 0 }}><b>Certificado digital</b><br />Nenhum certificado digital foi configurado.<br />Faça upload do arquivo .pfx ou .p12 e informe a senha para configurar.</div>
            )}
            <div style={{ ...grade, marginTop: 12 }}>
              <label>Buscar certificado<input type="file" name="pfx" accept=".pfx,.p12,application/x-pkcs12" /></label>
              <label>Senha<input type="password" name="senha" autoComplete="off" placeholder="Senha do certificado" /><span className="note">Deixe em branco se não for alterar o certificado</span></label>
              <label>Ambiente<select name="ambiente" defaultValue={c.ambiente}><option value="homologacao">Homologação (testes)</option><option value="producao">Produção</option></select></label>
            </div>
          </Secao>

          <Secao titulo="Configurações de notas fiscais">
            <div className="grid two" style={{ gap: 24 }}>
              <div>
                <h3 style={{ fontWeight: 600 }}>Nota Fiscal Eletrônica · NF-e (produto)</h3>
                <div style={grade}>
                  <Campo n="nfe_ultimo" l="Última NF-e" v={c.nfe_ultimo} obrig type="number" min={0} />
                  <Campo n="nfe_serie" l="Série NF-e" v={c.nfe_serie} obrig type="number" min={0} />
                  <Campo n="cfop_padrao" l="CFOP padrão de venda" v={c.cfop_padrao} />
                  <Campo n="ncm_padrao" l="NCM padrão dos móveis" v={c.ncm_padrao} placeholder="Defina com o contador" />
                </div>
                <p className="note">O CFOP preenche os produtos na emissão e pode ser alterado nota a nota. Ex.: 5101 produção própria, 5102 revenda. Confirme com o contador.</p>
              </div>
              <div>
                <h3 style={{ fontWeight: 600 }}>Manifesto Documento Fiscal Eletrônico · MDF-e</h3>
                <div style={grade}>
                  <Campo n="mdfe_ultimo" l="Último MDF-e" v={c.mdfe_ultimo} obrig type="number" min={0} />
                  <Campo n="mdfe_serie" l="Série MDF-e" v={c.mdfe_serie} obrig type="number" min={0} />
                </div>
                <h3 style={{ fontWeight: 600, marginTop: 16 }}>Nota de Serviço · NFS-e Nacional (montagem)</h3>
                <div style={grade}>
                  <Campo n="nfse_ultimo" l="Última DPS" v={c.nfse_ultimo} type="number" min={0} />
                  <Campo n="nfse_serie" l="Série DPS" v={c.nfse_serie} type="number" min={0} />
                  <Campo n="codigo_servico_nfse" l="Código do serviço" v={c.codigo_servico_nfse} placeholder="Tributação nacional" />
                  <Campo n="aliquota_iss" l="Alíquota ISS (%)" v={c.aliquota_iss} inputMode="decimal" />
                </div>
              </div>
            </div>
          </Secao>

          <Secao titulo="Informações complementares NF-e">
            <label>Texto padrão<textarea name="info_complementar" rows={4} defaultValue={c.info_complementar ?? ""} placeholder="Digite o texto padrão para informações complementares" /></label>
            <p className="note" style={{ marginBottom: 0 }}>Este texto entra automaticamente ao emitir a NF-e e pode ser editado na hora da emissão.</p>
          </Secao>

          <Secao titulo="Reforma tributária · IBS/CBS (Lei Complementar 214/2025)">
            <div className="lock p-info" style={{ marginTop: 0 }}>
              <b>Ano de testes · 2026</b><br />Em 2026 o IBS e a CBS são calculados com alíquotas simbólicas, para teste e apuração assistida. Os valores <b>não</b> compõem o total da nota e há dispensa de recolhimento neste período.
              <br /><b>Obrigatoriedade:</b> regime normal (CRT 3) desde janeiro de 2026. Simples Nacional e MEI a partir de janeiro de 2027 (facultativo antes).
            </div>
            <div className="scroll" style={{ marginTop: 12 }}><table>
              <thead><tr><th colSpan={4} style={{ textAlign: "center" }}>Alíquotas 2026 (período de teste)</th><th colSpan={3} style={{ textAlign: "center" }}>Configuração padrão</th></tr>
                <tr><th>CBS (federal)</th><th>IBS UF (estadual)</th><th>IBS municipal</th><th>Total</th><th>CST IBS/CBS</th><th>cClassTrib</th><th>Status</th></tr></thead>
              <tbody><tr>
                <td><input name="cbs_aliquota" defaultValue={c.cbs_aliquota} inputMode="decimal" style={{ width: 80 }} aria-label="CBS %" /> %</td>
                <td><input name="ibs_uf_aliquota" defaultValue={c.ibs_uf_aliquota} inputMode="decimal" style={{ width: 80 }} aria-label="IBS UF %" /> %</td>
                <td><input name="ibs_mun_aliquota" defaultValue={c.ibs_mun_aliquota} inputMode="decimal" style={{ width: 80 }} aria-label="IBS municipal %" /> %</td>
                <td className="num" style={{ background: "var(--info-soft)" }}><b>{total.toFixed(2).replace(".", ",")}%</b></td>
                <td><input name="cst_ibscbs" defaultValue={c.cst_ibscbs} style={{ width: 70 }} aria-label="CST IBS/CBS" /><div className="note">000 tributação integral</div></td>
                <td><input name="cclasstrib" defaultValue={c.cclasstrib} style={{ width: 90 }} aria-label="cClassTrib" /></td>
                <td><label style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" name="ibscbs_habilitado" defaultChecked={c.ibscbs_habilitado} /> Habilitado</label></td>
              </tr></tbody>
            </table></div>
          </Secao>

          <Secao titulo="Envio automático para a contabilidade">
            <label style={{ flexDirection: "row", alignItems: "center", gap: 8, fontSize: 13, color: "var(--fg)" }}>
              <input type="checkbox" name="envio_contabilidade" defaultChecked={c.envio_contabilidade} />
              Enviar todo mês, por e-mail, as notas fiscais do <b>mês anterior</b> (XML + DANFE) para a contabilidade
            </label>
            <label style={{ maxWidth: 420, marginTop: 10 }}>E-mail do contador<input type="email" name="email_contabilidade" defaultValue={c.email_contabilidade ?? ""} placeholder="contador@escritorio.com.br" /></label>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
              <button className="btn sm" formAction={testarContabilidade} formNoValidate disabled={!emailConfigurado()}>Enviar agora o mês anterior</button>
              <span className="note">{emailConfigurado() ? "O envio automático acontece todo dia 1º às 8h. Salve o e-mail do contador antes de testar." : "Envio de e-mail ainda não ativado no servidor (falta a chave do Resend)."}</span>
            </div>
          </Secao>

          {gestor && <div style={{ textAlign: "center", marginTop: 22 }}><button className="btn primary" style={{ padding: "12px 36px", fontSize: 15 }}>Salvar configurações</button></div>}
        </fieldset>
        {!gestor && <p className="note" style={{ textAlign: "center" }}>Somente dono ou gerente altera estas configurações.</p>}
      </form>
    </>
  );
}
