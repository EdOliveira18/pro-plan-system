import { cnpjValido } from "./cnpj";

// O que ainda falta para a empresa poder emitir nota. Vazio = pronta.
export function pendenciasFiscais(e: Record<string, any> | null, cert: { valido_ate?: string | null } | null, cfg: Record<string, any> | null) {
  const p: string[] = [];
  if (!e?.cnpj || !cnpjValido(e.cnpj)) p.push("CNPJ válido");
  for (const [k, n] of [["razao_social", "razão social"], ["nome_fantasia", "nome fantasia"], ["cnae", "CNAE"], ["regime_tributario", "regime tributário"],
    ["cep", "CEP"], ["logradouro", "endereço"], ["numero", "número"], ["bairro", "bairro"], ["municipio", "cidade"], ["uf", "UF"],
    ["codigo_municipio", "código do município"], ["telefone", "telefone"], ["email_fiscal", "e-mail"]] as const) {
    if (!e?.[k]) p.push(n);
  }
  if (!cert) p.push("certificado digital A1");
  else if (cert.valido_ate && new Date(cert.valido_ate + "T23:59:59") < new Date()) p.push("certificado digital dentro da validade");
  if (!cfg) p.push("parâmetros das notas (série e numeração)");
  return p;
}

export const REGIMES: Record<string, string> = { mei: "MEI", simples: "Simples Nacional", presumido: "Lucro Presumido", real: "Lucro Real" };
export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
