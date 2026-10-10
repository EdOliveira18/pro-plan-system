// Definição de todos os cadastros. As telas de lista e de formulário são geradas a partir daqui,
// e a gravação só aceita os campos declarados (nada além disso chega ao banco).
import { UFS } from "./fiscal";

export type TipoCampo = "text" | "select" | "date" | "textarea" | "money" | "pct" | "int" | "num" | "bool" | "email" | "tel" | "cep" | "ref" | "membro" | "cor" | "codigo" | "time";
export type Campo = {
  n: string; label: string; tipo?: TipoCampo; obrig?: boolean; opcoes?: [string, string][];
  larg?: 1 | 2 | 3 | 4; padrao?: string; dica?: string; ref?: { tabela: string; rotulo: string; filtro?: Record<string, string> };
};
export type Secao = { titulo?: string; campos: Campo[] };
export type Coluna = { titulo: string; v: (r: any) => string | null | undefined; tipo?: "status" | "num" | "pill" };
export type Entidade = {
  slug: string; tabela: string; filtro?: Record<string, string>;
  singular: string; plural: string; artigo: "o" | "a";
  descricao: string; busca: string; buscaEm: string[];
  colunas: Coluna[]; secoes: Secao[]; ordem?: string;
  vazio: string;
  grupo?: string;          // migalha (ex.: Almoxarifado)
  select?: string;         // colunas extras para a lista (joins)
  lixeira?: boolean;       // excluir = mover para Excluídos (restaurável)
  aviso?: string;          // faixa azul no topo do formulário
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
        { n: "campanha_id", label: "Origem do cliente", tipo: "ref", ref: { tabela: "campanhas", rotulo: "nome" } }] },
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


const brlS = (v: unknown) => (v == null ? null : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
export const UNIDADES = op("UN Unidade", "CH Chapa", "M2 Metro quadrado", "M Metro linear", "KG Quilo", "L Litro", "CX Caixa", "PC Peça", "PAR Par", "RL Rolo", "JG Jogo", "H Hora", "DIA Diária").map(([k]): [string, string] => [k.split(" ")[0], k]);
export const TIPOS_PRODUTO = op("Matéria-prima", "Ferragem", "Acessório", "Insumo", "Produto acabado", "Uso e consumo", "Revenda");
const sn = (b: boolean) => (b ? "Sim" : "Não");

ENTIDADES.push(
  {
    slug: "produtos", tabela: "produtos", grupo: "Almoxarifado", singular: "produto", plural: "produtos", artigo: "o", lixeira: true,
    select: "*, categoria:categorias_produto(nome)", ordem: "nome",
    descricao: "Gerencie os produtos do almoxarifado: chapas, ferragens, acessórios e insumos.",
    busca: "Buscar produtos por nome, código ou referência", buscaEm: ["nome", "codigo", "referencia", "marca"],
    vazio: "Cadastre o primeiro produto para controlar o estoque",
    aviso: "Obrigatório o preenchimento dos campos com asterisco.",
    colunas: [{ titulo: "Código", v: (r) => r.codigo, tipo: "num" }, { titulo: "Nome", v: (r) => r.nome }, { titulo: "Categoria", v: (r) => r.categoria?.nome },
      { titulo: "Estoque", v: (r) => `${String(Number(r.estoque)).replace(".", ",")} ${r.unid_producao}${Number(r.estoque) <= Number(r.estoque_minimo) && Number(r.estoque_minimo) > 0 ? " ⚠" : ""}`, tipo: "num" },
      { titulo: "Estoque mín.", v: (r) => String(Number(r.estoque_minimo)).replace(".", ","), tipo: "num" }, { titulo: "Preço", v: (r) => brlS(r.valor_final), tipo: "num" }],
    secoes: [
      { campos: [{ n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "tipo", label: "Tipo", tipo: "select", opcoes: sel(TIPOS_PRODUTO), obrig: true },
        { n: "categoria_id", label: "Categoria", tipo: "ref", ref: { tabela: "categorias_produto", rotulo: "nome" }, obrig: true },
        { n: "codigo", label: "Código interno", tipo: "codigo", obrig: true }, { n: "referencia", label: "Referência" }, { n: "marca", label: "Marca" },
        { n: "acabamento", label: "Acabamento" }, { n: "cor", label: "Cor", tipo: "select", opcoes: sel(op("Branco", "Preto", "Cinza", "Grafite", "Amadeirado", "Off-white", "Areia", "Fendi", "Verde", "Azul", "Inox", "Dourado", "Champanhe", "Bronze", "Transparente", "Outra")) },
        { n: "localizacao", label: "Localização" }, { n: "observacoes", label: "Observações", tipo: "textarea", larg: 2 }] },
      { titulo: "Conversão de unidade", campos: [{ n: "unid_compra", label: "Unid. de compra", tipo: "select", opcoes: UNIDADES, obrig: true, padrao: "UN" },
        { n: "fator_conversao", label: "Equivale a", tipo: "num", padrao: "1", dica: "Quantas unidades de produção vêm em uma de compra" },
        { n: "unid_producao", label: "Unid. de produção", tipo: "select", opcoes: UNIDADES, obrig: true, padrao: "UN" }] },
      { titulo: "Estoque", campos: [{ n: "estoque", label: "Quantidade atual", tipo: "num", obrig: true, padrao: "0", dica: "Depois do cadastro, o estoque muda pelos pedidos de compra e de saída" }, { n: "estoque_minimo", label: "Estoque mínimo", tipo: "num", padrao: "0" }] },
      { titulo: "Fornecedor", campos: [{ n: "fornecedor_id", label: "Fornecedor", tipo: "ref", ref: { tabela: "pessoas", rotulo: "nome", filtro: { categoria: "fornecedor" } }, obrig: true, larg: 2 }] },
      { titulo: "Valores", campos: [{ n: "valor_compra", label: "Valor de compra", tipo: "num", padrao: "0" }, { n: "outras_despesas", label: "Outras despesas", tipo: "num", padrao: "0", dica: "Frete, impostos não recuperáveis…" }] },
      { titulo: "Fiscal", campos: [{ n: "ncm", label: "NCM", dica: "Ex.: 4410.11.10 para MDF" }, { n: "cest", label: "CEST" },
        { n: "origem", label: "Origem", tipo: "select", opcoes: sel([["0", "0 Nacional"], ["1", "1 Estrangeira, importação direta"], ["2", "2 Estrangeira, mercado interno"], ["3", "3 Nacional, conteúdo importado 40% a 70%"], ["5", "5 Nacional, conteúdo importado até 40%"], ["8", "8 Nacional, conteúdo importado acima de 70%"]]) },
        { n: "tributacao", label: "Tributação", tipo: "select", opcoes: [["simples", "SIMPLES"], ["normal", "NORMAL"]], obrig: true, padrao: "simples" }] },
    ],
  },
  {
    slug: "categorias-produto", tabela: "categorias_produto", grupo: "Almoxarifado", singular: "categoria", plural: "categorias de produtos", artigo: "a",
    descricao: "Gerencie as categorias dos produtos.", busca: "Buscar categorias", buscaEm: ["nome"], vazio: "Cadastre a primeira categoria",
    colunas: [{ titulo: "Nome da categoria", v: (r) => r.nome }, { titulo: "Precificação", v: (r) => sn(r.precificacao), tipo: "pill" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome", obrig: true, larg: 3 }, { n: "precificacao", label: "Precificação", tipo: "bool", obrig: true, dica: "Entra no cálculo de preço dos orçamentos" }] }],
  },
  {
    slug: "naturezas", tabela: "naturezas", grupo: "Almoxarifado", singular: "natureza", plural: "naturezas", artigo: "a",
    descricao: "Naturezas de operação usadas na entrada de notas de compra.", busca: "Buscar naturezas", buscaEm: ["nome", "cfop_estadual"], vazio: "Cadastre a primeira natureza",
    colunas: [{ titulo: "Nome", v: (r) => r.nome }, { titulo: "Tipo", v: (r) => (r.tipo === "entrada" ? "Entrada" : "Saída"), tipo: "pill" },
      { titulo: "CFOP estadual", v: (r) => r.cfop_estadual, tipo: "num" }, { titulo: "CFOP interestadual", v: (r) => r.cfop_interestadual, tipo: "num" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "tipo", label: "Tipo", tipo: "select", opcoes: [["entrada", "Entrada"], ["saida", "Saída"]], padrao: "entrada" },
      { n: "cfop_estadual", label: "CFOP interno", obrig: true, dica: "Ex.: 1101, 1102, 1556" }, { n: "cfop_interestadual", label: "CFOP interestadual", obrig: true, dica: "Ex.: 2101, 2102, 2556" }] },
      { titulo: "PIS", campos: [{ n: "pis_cst", label: "Situação tributária", tipo: "select", obrig: true, padrao: "nao_usar", opcoes: [["nao_usar", "Não usar"], ["50", "50 Crédito vinculado a receita tributada"], ["70", "70 Aquisição sem direito a crédito"], ["73", "73 Aquisição a alíquota zero"], ["98", "98 Outras operações de entrada"], ["99", "99 Outras operações"]] }] },
      { titulo: "COFINS", campos: [{ n: "cofins_cst", label: "Situação tributária", tipo: "select", obrig: true, padrao: "nao_usar", opcoes: [["nao_usar", "Não usar"], ["50", "50 Crédito vinculado a receita tributada"], ["70", "70 Aquisição sem direito a crédito"], ["73", "73 Aquisição a alíquota zero"], ["98", "98 Outras operações de entrada"], ["99", "99 Outras operações"]] }] }],
  },
  {
    slug: "tipos-servico", tabela: "tipos_servico", grupo: "Produção", singular: "tipo de serviço", plural: "tipos de serviços", artigo: "o",
    descricao: "Gerencie os tipos de serviços disponíveis para as ordens de produção.", busca: "Buscar serviços", buscaEm: ["nome"], vazio: "Nenhum serviço cadastrado",
    colunas: [{ titulo: "Nome", v: (r) => r.nome }, { titulo: "Unidade", v: (r) => r.unidade, tipo: "num" }, { titulo: "Valor", v: (r) => brlS(r.valor), tipo: "num" },
      { titulo: "Markup", v: (r) => (r.markup_pct != null ? String(r.markup_pct).replace(".", ",") + "%" : null), tipo: "num" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome do serviço", obrig: true }, { n: "unidade", label: "Unidade", tipo: "select", opcoes: sel(UNIDADES), obrig: true, dica: "Como o serviço é medido" },
      { n: "valor", label: "Valor", tipo: "money", dica: "Custo por unidade" }, { n: "markup_pct", label: "Markup % (opcional)", tipo: "pct", dica: "Acréscimo sobre o custo na precificação" }] }],
  },
  {
    slug: "etapas-execucao", tabela: "etapas_execucao", grupo: "Produção", singular: "etapa", plural: "etapas de execução", artigo: "a",
    descricao: "Cadastre as etapas de execução (mão de obra) e o valor/hora padrão de cada uma.", busca: "Buscar etapas", buscaEm: ["nome"], vazio: "Cadastre a primeira etapa",
    colunas: [{ titulo: "Nome", v: (r) => r.nome }, { titulo: "Valor/hora", v: (r) => brlS(r.valor_hora) + "/h", tipo: "num" },
      { titulo: "Markup", v: (r) => (r.markup_pct != null ? String(r.markup_pct).replace(".", ",") + "%" : null), tipo: "num" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "valor_hora", label: "Valor/hora", tipo: "money", padrao: "0" }, { n: "markup_pct", label: "Markup %", tipo: "pct" }] }],
  },
  {
    slug: "status-entrega", tabela: "status_entrega", grupo: "Entregas", singular: "status", plural: "status de entregas", artigo: "o", ordem: "ordem",
    descricao: "Gerencie os status das entregas. A ordem define a sequência no acompanhamento.", busca: "Buscar status", buscaEm: ["nome"], vazio: "Cadastre o primeiro status",
    colunas: [{ titulo: "Nome", v: (r) => r.nome }, { titulo: "Cor", v: (r) => r.cor, tipo: "num" }, { titulo: "Ordem", v: (r) => String(r.ordem), tipo: "num" }, { titulo: "Conclui a entrega", v: (r) => sn(r.final), tipo: "pill" }],
    secoes: [{ campos: [{ n: "nome", label: "Nome", obrig: true, larg: 2 }, { n: "cor", label: "Cor", tipo: "cor", padrao: "#999999" }, { n: "ordem", label: "Ordem", tipo: "int", obrig: true, padrao: "1" },
      { n: "final", label: "Conclui a entrega", tipo: "bool", dica: "Marque no status que significa entregue" }] }],
  },
  {
    slug: "ferramentas", tabela: "ferramentas", grupo: "Ferramentaria", singular: "ferramenta", plural: "ferramentas", artigo: "a", ordem: "numero",
    select: "*, responsavel:pessoas(nome)",
    descricao: "Gerencie as ferramentas da empresa e quem é responsável por cada uma.", busca: "Buscar pelo nome da ferramenta, marca ou série", buscaEm: ["nome", "marca", "serie", "aplicacao"],
    vazio: "Nenhuma ferramenta cadastrada",
    colunas: [{ titulo: "Código", v: (r) => String(r.numero), tipo: "num" }, { titulo: "Nome", v: (r) => r.nome }, { titulo: "Quant.", v: (r) => String(r.quantidade), tipo: "num" },
      { titulo: "Marca", v: (r) => r.marca }, { titulo: "Série", v: (r) => r.serie, tipo: "num" }, { titulo: "Aplicação", v: (r) => r.aplicacao }, { titulo: "Responsável", v: (r) => r.responsavel?.nome }],
    secoes: [{ campos: [{ n: "nome", label: "Descrição", obrig: true, larg: 2 }, { n: "marca", label: "Marca", larg: 2 }, { n: "serie", label: "Série" }, { n: "aplicacao", label: "Aplicação" },
      { n: "quantidade", label: "Quantidade", tipo: "int", obrig: true, padrao: "1" },
      { n: "responsavel_id", label: "Responsável", tipo: "ref", ref: { tabela: "pessoas", rotulo: "nome", filtro: { categoria: "funcionario" } }, obrig: true }] }],
  },
  {
    slug: "plano-contas", tabela: "plano_contas", grupo: "Financeiro", singular: "conta", plural: "plano de contas", artigo: "a", ordem: "codigo",
    descricao: "Estrutura de receitas, custos e despesas usada nos lançamentos e no DRE.", busca: "Buscar conta", buscaEm: ["codigo", "nome"], vazio: "Cadastre a primeira conta",
    colunas: [{ titulo: "Código", v: (r) => r.codigo, tipo: "num" }, { titulo: "Nome", v: (r) => r.nome }, { titulo: "Tipo", v: (r) => ({ receita: "Receita", custo: "Custo", despesa: "Despesa" } as Record<string, string>)[r.tipo], tipo: "pill" }],
    secoes: [{ campos: [{ n: "codigo", label: "Código", obrig: true, dica: "Ex.: 3.1.6" }, { n: "nome", label: "Nome", obrig: true, larg: 2 },
      { n: "tipo", label: "Tipo", tipo: "select", obrig: true, opcoes: [["", "Selecione"], ["receita", "Receita"], ["custo", "Custo"], ["despesa", "Despesa"]] }] }],
  },
);

export const entidade = (slug: string) => ENTIDADES.find((e) => e.slug === slug);
export const camposDe = (e: Entidade) => e.secoes.flatMap((s) => s.campos);

// Converte o valor digitado no formulário para o tipo do banco
export function converter(c: Campo, bruto: FormDataEntryValue | null): unknown {
  const s = String(bruto ?? "").trim();
  switch (c.tipo) {
    case "bool": return s === "sim" ? true : s === "nao" ? false : c.obrig ? null : false;
    case "money": case "pct": {
      if (!s) return null;
      const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
      return Number.isFinite(n) ? n : null;
    }
    case "int": { if (!s) return null; const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; }
    case "num": {
      if (!s) return c.obrig ? null : 0;
      const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
      return Number.isFinite(n) ? n : null;
    }
    default: return s || null;
  }
}

// Valor do banco para exibir no campo
export function exibir(c: Campo, v: unknown): string {
  if (v === null || v === undefined) return c.padrao ?? "";
  if (c.tipo === "bool") return v ? "sim" : "nao";
  if (c.tipo === "money") return Number(v).toFixed(2).replace(".", ",");
  if (c.tipo === "pct" || c.tipo === "num") return String(Number(v)).replace(".", ",");
  if (c.tipo === "time") return String(v).slice(0, 5);
  return String(v);
}
