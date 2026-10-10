// Validação, formatação e consulta pública de CNPJ
export const limparCNPJ = (v: string) => (v ?? "").replace(/\D/g, "");

export function cnpjValido(v: string): boolean {
  const c = limparCNPJ(v);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = base.split("").reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.endsWith(`${d1}${d2}`);
}

export const formatarCNPJ = (v: string) => {
  const c = limparCNPJ(v);
  return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : v;
};

export type DadosCNPJ = {
  razao_social?: string; nome_fantasia?: string; cnae?: string; regime_tributario?: "mei" | "simples" | null;
  cep?: string; logradouro?: string; numero?: string; complemento?: string; bairro?: string; municipio?: string; uf?: string;
  codigo_municipio?: string; email_fiscal?: string; telefone?: string; situacao?: string;
};

// Consulta pública (BrasilAPI, dados da Receita). Campos variam, então a leitura é tolerante.
export async function consultarCNPJ(cnpj: string): Promise<DadosCNPJ | null> {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limparCNPJ(cnpj)}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const j: Record<string, any> = await r.json();
    const s = (...ks: string[]) => { for (const k of ks) if (j[k] !== undefined && j[k] !== null && String(j[k]).trim() !== "") return String(j[k]).trim(); return undefined; };
    const tipoLog = s("descricao_tipo_de_logradouro");
    const log = s("logradouro");
    return {
      razao_social: s("razao_social"),
      nome_fantasia: s("nome_fantasia"),
      cnae: s("cnae_fiscal"),
      regime_tributario: j.opcao_pelo_mei === true ? "mei" : j.opcao_pelo_simples === true ? "simples" : null,
      cep: s("cep"),
      logradouro: tipoLog && log && !log.toUpperCase().startsWith(tipoLog.toUpperCase()) ? `${tipoLog} ${log}` : log,
      numero: s("numero"), complemento: s("complemento"), bairro: s("bairro"),
      municipio: s("municipio"), uf: s("uf"),
      codigo_municipio: s("codigo_municipio_ibge", "codigo_ibge"),
      email_fiscal: s("email")?.toLowerCase(),
      telefone: s("ddd_telefone_1"),
      situacao: s("descricao_situacao_cadastral", "situacao_cadastral"),
    };
  } catch {
    return null;
  }
}
