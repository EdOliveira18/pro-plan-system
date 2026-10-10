// Definição de todos os cadastros. As telas de lista e de formulário são geradas a partir daqui,
// e a gravação só aceita os campos declarados (nada além disso chega ao banco).
import { UFS } from "./fiscal";

export type TipoCampo = "text" | "select" | "date" | "textarea" | "money" | "pct" | "int" | "bool" | "email" | "tel" | "cep" | "ref";
export type Campo = {
  n: string; label: string; tipo?: TipoCampo; obrig?: boolean; opcoes?: [string, string][];
  larg?: 1 | 2 | 3 | 4; padrao?: string; dica?: string; ref?: { tabela: string; rotulo: string };
};
export type Secao = { titulo?: string; campos: Campo[] };
export type Coluna = { titulo: string; v: (r: any) => string | null | undefined; tipo?: "status" | "num" | "pill" };
export type Entidade = {
  slug: string; tabela: string; filtro?: Record<string, string>;
  singular: string; plural: string; artigo: "o" | "a";
  descricao: string; busca: string; buscaEm: string[];
  colunas: Coluna[]; secoes: Secao[]; ordem?: string;
  vazio: string;
};

const op = (...xs: string[]): [string, string][] => xs.map((x) => [x, x]);
export const SIM_NAO: [string, string][] = [["", "Selecione"], ["sim", "Sim"], ["nao", "Não"]];
export const BANCOS = op("001 Banco do Brasil", "033 Santander", "077 Banco Inter", "104 Caixa Econômica Federal", "136 Unicred", "197 Stone",
  "208 BTG Pactual", "212 Banco Original", "237 Bradesco", "260 Nubank", "290 PagBank", "323 Mercado Pago", "336 C6 Bank", "341 Itaú",
  "380 PicPay", "422 Safra", "655 Votorantim", "707 Daycoval", "748 Sicredi", "756 Sicoob", "Outro");
const PIX = op("CPF", "CNPJ", "E-mail", "Celular", "Chave aleatória");
const TIPO_PESSOA: [string, string][] = [["pf", "Pessoa Física"], ["pj", "Pessoa Jurídica"]];
const STATUS: [string, string][] = [["ativo", "Ativo"], ["inativo", "Inativo"]];
const IMOVEL = op("Casa", "Apartamento", "Casa em condomínio", "Comercial", "Galpão", "Chácara / sítio", "Outro");
const UF_OP: [string, string][] = [["", "Selecione"], ...UFS.map((u): [string, string] => [u, u])];
const PAIS = op("Brasil", "Outro");
export const FONTES = op("Instagram", "Facebook", "Google", "Site", "WhatsApp", "Indicação de cliente", "Arquiteto", "Loja física", "Feira / evento", "Outro");
export const FUNCOES = op("Vendedor(a)", "Projetista", "Gerente", "Medidor", "Montador", "Marceneiro", "Ajudante", "Motorista", "Conferente", "Administrativo", "Financeiro", "Outro");

const sel = (opcoes: [string, string][]): [string, string][] => [["", "Selecione"], ...opcoes];

function endereco(obrig = false, comTipo = false): Secao {
  return { titulo: "Endereço", campos: [
    ...(comTipo ? [{ n: "end_tipo", label: "Tipo", tipo: "select" as const, opcoes: sel(op("Residencial", "Comercial", "Endereço da obra")) }] : []),
    { n: "cep", label: "CEP", tipo: "cep", obrig },
    { n: "logradouro", label: "Endereço", obrig, larg: 2 },
    { n: "numero", label: "Número", obrig },
    { n: "complemento", label: "Complemento" },
    { n: "referencia", label: "Ponto de referência" },
    { n: "tipo_imovel", label: "Tipo imóvel", tipo: "select", opcoes: obrig ? IMOVEL : sel(IMOVEL), obrig },
    { n: "bairro", label: "Bairro", obrig },
    { n: "cidade", label: "Cidade", obrig },
    { n: "uf", label: "Estado", tipo: "select", opcoes: UF_OP, obrig },
    { n: "pais", label: "País", tipo: "select", opcoes: PAIS },
  ] };
}
const bancarios = (titulo = "Dados bancários"): Secao => ({ titulo, campos: [
  { n: "banco", label: "Banco", tipo: "select", opcoes: sel(BANCOS) }, { n: "agencia", label: "Agência" }, { n: "conta", label: "Conta" },
] });
const pix: Secao = { titulo: "Pix", campos: [{ n: "pix_tipo", label: "Tipo", tipo: "select", opcoes: sel(PIX) }, { n: "pix_chave", label: "Chave", larg: 2 }] };
const comissao = (campoPct: string): Secao => ({ titulo: "Comissão padrão", campos: [
  { n: "comissao_usa_pct", label: "Usar porcentagem", tipo: "bool" },
  { n: campoPct, label: "Comissão (%)", tipo: "pct", dica: "Aplicada sobre o valor líquido da venda" },
] });
const obs: Secao = { titulo: "Dados adicionais", campos: [{ n: "observacoes", label: "Observações", tipo: "textarea", larg: 2 }] };
const geral = (doc: string, docObrig = false, padraoTipo = "pf"): Campo[] => [
  { n: "tipo_pessoa", label: "Tipo", tipo: "select", opcoes: TIPO_PESSOA, padrao: padraoTipo },
  { n: "status", label: "Status", tipo: "select", opcoes: STATUS, padrao: "ativo" },
  { n: "cpf_cnpj", label: doc, obrig: docObrig },
];

const fone = (r: any) => [r.celular, r.telefone].filter(Boolean).join(" · ");
const colsPessoa: Coluna[] = [
  { titulo: "Nome", v: (r) => r.nome },
  { titulo: "CPF/CNPJ", v: (r) => r.cpf_cnpj, tipo: "num" },
  { titulo: "Telefone/Celular", v: fone },
  { titulo: "Status", v: (r) => r.status, tipo: "status" },
];

export const ENTIDADES: Entidade[] = [
  {
    slug: "arquitetos", tabela: "parceiros", filtro: { tipo: "arquiteto" }, singular: "arquiteto", plural: "arquitetos", artigo: "o",
    descricao: "Gerencie todos os arquitetos parceiros. A comissão cadastrada aqui vira o RT automático nos orçamentos.",
    busca: "Pesquise pelo nome, CPF ou CNPJ do arquiteto", buscaEm: ["nome", "cpf_cnpj"],
    vazio: "Cadastre seu primeiro arquiteto para gerenciar seus parceiros de projeto",
    colunas: [...colsPessoa.slice(0, 3), { titulo: "RT", v: (r) => (r.rt_pct != null ? String(r.rt_pct).replace(".", ",") + "%" : null), tipo: "num" }, colsPessoa[3]],
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CPF / CNPJ"), { n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "registro_cau", label: "Registro CAU" }, { n: "nascimento", label: "Data nascimento", tipo: "date" }] },
      endereco(),
      { titulo: "Contatos", campos: [{ n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "telefone_comercial", label: "Comercial", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }] },
      bancarios(), comissao("rt_pct"), pix, obs,
    ],
  },
  {
    slug: "clientes", tabela: "clientes", singular: "cliente", plural: "clientes", artigo: "o",
    descricao: "Gerencie todos os clientes. Cada contrato fica ligado ao cliente.",
    busca: "Buscar clientes por nome, CPF/CNPJ ou telefone", buscaEm: ["nome", "cpf_cnpj", "celular", "telefone", "email"],
    vazio: "Cadastre seu primeiro cliente para começar a gerenciar seus projetos",
    colunas: colsPessoa,
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CPF / CNPJ"), { n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "conjuge", label: "Cônjuge", larg: 2 },
        { n: "nascimento", label: "Data nascimento", tipo: "date" }, { n: "produtor_rural", label: "Produtor rural", tipo: "bool" }, { n: "rg", label: "RG / IE" },
        { n: "estado_civil", label: "Estado civil", tipo: "select", opcoes: sel(op("Solteiro(a)", "Casado(a)", "União estável", "Divorciado(a)", "Viúvo(a)")) },
        { n: "profissao", label: "Profissão" }] },
      endereco(false, true),
      { titulo: "Contatos", campos: [{ n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "telefone_comercial", label: "Telefone comercial", tipo: "tel" },
        { n: "ramal", label: "Ramal" }, { n: "telefone_conjuge", label: "Telefone cônjuge", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }, { n: "site", label: "Site" }] },
      { titulo: "Dados adicionais", campos: [{ n: "observacoes", label: "Observações", tipo: "textarea", larg: 2 }, { n: "indicacao", label: "Indicação da loja" },
        { n: "campanha_id", label: "Origem (campanha)", tipo: "ref", ref: { tabela: "campanhas", rotulo: "nome" } }] },
    ],
  },
  {
    slug: "funcionarios", tabela: "pessoas", filtro: { categoria: "funcionario" }, singular: "funcionário", plural: "funcionários", artigo: "o",
    descricao: "Gerencie todos os funcionários. Salário e dados de contrato ficam visíveis só para dono, gerente e financeiro.",
    busca: "Buscar funcionários", buscaEm: ["nome", "cpf_cnpj", "funcao"],
    vazio: "Cadastre seu primeiro funcionário para gerenciar sua equipe",
    colunas: [colsPessoa[0], colsPessoa[1], { titulo: "Função", v: (r) => r.funcao }, colsPessoa[2], colsPessoa[3]],
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CPF", true), { n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "rg", label: "RG" }, { n: "nascimento", label: "Data nascimento", tipo: "date" },
        { n: "escolaridade", label: "Grau escolaridade", tipo: "select", opcoes: sel(op("Fundamental incompleto", "Fundamental completo", "Médio incompleto", "Médio completo", "Técnico", "Superior incompleto", "Superior completo", "Pós-graduação")) }] },
      endereco(true),
      { titulo: "Contatos", campos: [{ n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }] },
      bancarios("Conta bancária"), comissao("comissao_pct"), pix,
      { titulo: "Dados de contrato", campos: [{ n: "funcao", label: "Função", tipo: "select", opcoes: sel(FUNCOES), obrig: true }, { n: "salario", label: "Salário fixo", tipo: "money" },
        { n: "dia_pagamento", label: "Dia de pagamento", tipo: "int" }, { n: "admissao", label: "Data de admissão", tipo: "date" }] },
      obs,
    ],
  },
  {
    slug: "leads", tabela: "leads", singular: "lead", plural: "leads", artigo: "o",
    descricao: "Gerencie todos os leads. Todo lead cadastrado aqui entra no funil do CRM Pro.",
    busca: "Digite o nome ou e-mail do lead", buscaEm: ["nome", "email", "telefone"],
    vazio: "Cadastre seu primeiro lead para começar a captar novos clientes",
    colunas: [{ titulo: "Nome", v: (r) => r.nome }, { titulo: "Celular", v: (r) => r.telefone, tipo: "num" }, { titulo: "E-mail", v: (r) => r.email }, { titulo: "Fonte", v: (r) => r.fonte, tipo: "pill" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome", obrig: true }, { n: "telefone", label: "Celular (+55)", tipo: "tel", obrig: true }, { n: "email", label: "E-mail", tipo: "email" },
      { n: "fonte", label: "Fonte", tipo: "select", opcoes: sel(FONTES), obrig: true }] }],
  },
  {
    slug: "socios", tabela: "pessoas", filtro: { categoria: "socio" }, singular: "sócio", plural: "sócios", artigo: "o",
    descricao: "Gerencie os sócios da empresa, participação e pró-labore.",
    busca: "Buscar sócios", buscaEm: ["nome", "cpf_cnpj"], vazio: "Cadastre os sócios para controlar participação e pró-labore",
    colunas: [colsPessoa[0], colsPessoa[1], { titulo: "Participação", v: (r) => (r.participacao_pct != null ? String(r.participacao_pct).replace(".", ",") + "%" : null), tipo: "num" }, colsPessoa[2], colsPessoa[3]],
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CPF / CNPJ", true), { n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "rg", label: "RG" }, { n: "nascimento", label: "Data nascimento", tipo: "date" }] },
      endereco(),
      { titulo: "Contatos", campos: [{ n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }] },
      { titulo: "Sociedade", campos: [{ n: "participacao_pct", label: "Participação (%)", tipo: "pct" }, { n: "pro_labore", label: "Pró-labore", tipo: "money" }, { n: "dia_pagamento", label: "Dia de pagamento", tipo: "int" }, { n: "admissao", label: "Entrada na sociedade", tipo: "date" }] },
      bancarios(), pix, obs,
    ],
  },
  {
    slug: "fornecedores", tabela: "pessoas", filtro: { categoria: "fornecedor" }, singular: "fornecedor", plural: "fornecedores", artigo: "o",
    descricao: "Fábricas, distribuidores de chapas, ferragens, vidros e prestadores de serviço.",
    busca: "Buscar fornecedores por nome, CNPJ ou ramo", buscaEm: ["nome", "nome_fantasia", "cpf_cnpj", "ramo"], vazio: "Cadastre seu primeiro fornecedor",
    colunas: [{ titulo: "Nome", v: (r) => r.nome_fantasia || r.nome }, colsPessoa[1], { titulo: "Ramo", v: (r) => r.ramo }, colsPessoa[2], colsPessoa[3]],
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CNPJ / CPF", false, "pj"), { n: "nome", label: "Razão social / nome", obrig: true, larg: 2 }, { n: "nome_fantasia", label: "Nome fantasia", larg: 2 },
        { n: "inscricao_estadual", label: "Inscrição estadual" },
        { n: "ramo", label: "Ramo", tipo: "select", opcoes: sel(op("Fábrica / indústria", "MDF e chapas", "Ferragens", "Vidros e espelhos", "Pedras e mármores", "Eletros", "Iluminação", "Montagem terceirizada", "Serviços", "Outro")) },
        { n: "prazo_entrega_dias", label: "Prazo de entrega (dias)", tipo: "int" }] },
      endereco(),
      { titulo: "Contatos", campos: [{ n: "contato", label: "Pessoa de contato" }, { n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }, { n: "site", label: "Site" }] },
      bancarios(), pix, obs,
    ],
  },
  {
    slug: "impostos", tabela: "impostos", singular: "imposto", plural: "impostos", artigo: "o",
    descricao: "Gerencie todos os impostos usados nos cálculos e nas notas fiscais.",
    busca: "Buscar impostos", buscaEm: ["sigla", "nome"], vazio: "Nenhum imposto cadastrado", ordem: "categoria",
    colunas: [{ titulo: "Categoria", v: (r) => ({ federal: "Imposto Federal", estadual: "Imposto Estadual", municipal: "Imposto Municipal" } as Record<string, string>)[r.categoria] },
      { titulo: "Sigla", v: (r) => r.sigla, tipo: "num" }, { titulo: "Nome", v: (r) => r.nome },
      { titulo: "Alíquota", v: (r) => (r.aliquota != null ? String(r.aliquota).replace(".", ",") + "%" : null), tipo: "num" }],
    secoes: [{ campos: [{ n: "categoria", label: "Tipo do imposto", tipo: "select", obrig: true, opcoes: [["", "Selecione"], ["federal", "Imposto Federal"], ["estadual", "Imposto Estadual"], ["municipal", "Imposto Municipal"]] },
      { n: "sigla", label: "Sigla", obrig: true }, { n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "aliquota", label: "Alíquota (%)", tipo: "pct", dica: "Opcional" }] }],
  },
  {
    slug: "transportadoras", tabela: "pessoas", filtro: { categoria: "transportadora" }, singular: "transportadora", plural: "transportadoras", artigo: "a",
    descricao: "Transportadoras e fretistas usados nas entregas da fábrica e da loja.",
    busca: "Buscar transportadoras", buscaEm: ["nome", "nome_fantasia", "cpf_cnpj"], vazio: "Cadastre sua primeira transportadora",
    colunas: [{ titulo: "Nome", v: (r) => r.nome_fantasia || r.nome }, colsPessoa[1], colsPessoa[2], colsPessoa[3]],
    secoes: [
      { titulo: "Dados gerais", campos: [...geral("CNPJ / CPF", false, "pj"), { n: "nome", label: "Razão social / nome", obrig: true, larg: 2 }, { n: "nome_fantasia", label: "Nome fantasia", larg: 2 },
        { n: "inscricao_estadual", label: "Inscrição estadual" }, { n: "rntrc", label: "RNTRC (ANTT)" }] },
      endereco(),
      { titulo: "Contatos", campos: [{ n: "contato", label: "Pessoa de contato" }, { n: "telefone", label: "Telefone", tipo: "tel" }, { n: "celular", label: "Celular", tipo: "tel" }, { n: "email", label: "E-mail", tipo: "email" }] },
      bancarios(), pix, obs,
    ],
  },
];

export const entidade = (slug: string) => ENTIDADES.find((e) => e.slug === slug);
export const camposDe = (e: Entidade) => e.secoes.flatMap((s) => s.campos);

// Converte o valor digitado no formulário para o tipo do banco
export function converter(c: Campo, bruto: FormDataEntryValue | null): unknown {
  const s = String(bruto ?? "").trim();
  switch (c.tipo) {
    case "bool": return s === "sim" ? true : s === "nao" ? false : c.n === "produtor_rural" || c.n === "comissao_usa_pct" ? false : null;
    case "money": case "pct": {
      if (!s) return null;
      const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
      return Number.isFinite(n) ? n : null;
    }
    case "int": { if (!s) return null; const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; }
    default: return s || null;
  }
}

// Valor do banco para exibir no campo
export function exibir(c: Campo, v: unknown): string {
  if (v === null || v === undefined) return c.padrao ?? "";
  if (c.tipo === "bool") return v ? "sim" : "nao";
  if (c.tipo === "money") return Number(v).toFixed(2).replace(".", ",");
  if (c.tipo === "pct") return String(v).replace(".", ",");
  return String(v);
}
