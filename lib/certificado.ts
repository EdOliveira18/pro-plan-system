import forge from "node-forge";

export type InfoCertificado = { titular: string; cnpj: string | null; validoAte: Date; validoDe: Date };

// Abre o .pfx com a senha e extrai titular, CNPJ e validade. Lança erro se a senha estiver errada.
export function lerCertificadoA1(pfx: Uint8Array, senha: string): InfoCertificado {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.binary.raw.encode(pfx));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, senha);
  } catch {
    throw new Error("Não consegui abrir o certificado. Confira se o arquivo é o .pfx do certificado A1 e se a senha está correta.");
  }
  const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [];
  if (!keyBags.length) throw new Error("O arquivo não tem a chave privada. Exporte o certificado A1 com a chave, no formato .pfx.");
  // certificado do titular: o que não é emissor de nenhum outro da cadeia
  const certs = bags.map((b) => b.cert!).filter(Boolean);
  const titularCert = certs.find((c) => !certs.some((o) => o !== c && o.issuer.hash === c.subject.hash)) ?? certs[0];
  if (!titularCert) throw new Error("Não encontrei o certificado dentro do arquivo.");
  const cn = String(titularCert.subject.getField("CN")?.value ?? "");
  // ICP-Brasil: CN costuma ser "RAZAO SOCIAL:CNPJ"; o OID 2.16.76.1.3.3 também traz o CNPJ
  let cnpj = cn.match(/:(\d{14})$/)?.[1] ?? null;
  if (!cnpj) {
    const ext = titularCert.getExtension("subjectAltName") as any;
    for (const alt of ext?.altNames ?? []) {
      if (alt.type === 0 && typeof alt.value === "string") {
        const m = alt.value.match(/\d{14}/);
        if (alt.value.includes("2.16.76.1.3.3") && m) cnpj = m[0];
      }
    }
  }
  return { titular: cn.split(":")[0] || cn, cnpj, validoAte: titularCert.validity.notAfter, validoDe: titularCert.validity.notBefore };
}
