import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServidor } from "./supabase/server";
import type { Config } from "./olhinho";

export const COOKIE_EMPRESA = "ppt_empresa";

export type Empresa = { id: string; nome: string; cnpj: string | null; plano?: string; plano_ate?: string; limite_renders?: number; cnpj_verificado?: boolean };
export type Contexto = {
  supabase: Awaited<ReturnType<typeof supabaseServidor>>;
  userId: string;
  email: string;
  nome: string;
  papel: string;
  empresa: Empresa;
  empresas: Empresa[];
  admin: boolean;        // administração do Pro Plan System (planos, verificação de CNPJ)
  financeiro: boolean;   // dono, gerente ou financeiro: vê caixa, salários e lucratividade
  gestor: boolean;       // dono ou gerente
};

export const PAPEIS_FINANCEIRO = ["dono", "gerente", "financeiro"];

// Carrega usuário, empresas em que é membro e a empresa ativa (cookie). Sem empresa vai para o onboarding.
export async function contexto(): Promise<Contexto> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const buscar = () => supabase
    .from("membros")
    .select("papel, nome, empresa:empresas(id, nome, cnpj, plano, plano_ate, limite_renders, cnpj_verificado)")
    .eq("user_id", user.id)
    .eq("ativo", true);
  // convites agora só valem pelo link (/convite/...), nunca automaticamente pelo e-mail
  const [{ data: membros }, { data: admin }] = await Promise.all([buscar(), supabase.rpc("eh_admin_plataforma")]);

  const lista = (membros ?? []).filter((m) => m.empresa) as unknown as { papel: string; nome: string; empresa: Empresa }[];
  if (!lista.length) redirect("/onboarding");

  const escolhida = (await cookies()).get(COOKIE_EMPRESA)?.value;
  const atual = lista.find((m) => m.empresa.id === escolhida) ?? lista[0];
  return {
    supabase,
    userId: user.id,
    email: user.email ?? "",
    nome: atual.nome,
    papel: atual.papel,
    empresa: atual.empresa,
    empresas: lista.map((m) => m.empresa),
    admin: admin === true,
    financeiro: PAPEIS_FINANCEIRO.includes(atual.papel),
    gestor: ["dono", "gerente"].includes(atual.papel),
  };
}

/** Bloqueia a página para quem não tem o papel necessário */
export function exigir(ctx: Contexto, permitido: boolean) {
  if (!permitido) redirect("/sem-acesso");
}

/** Plano vencido ou suspenso: o sistema fica só para consulta da assinatura */
export function planoAtivo(e: Empresa) {
  if (e.plano === "suspenso") return false;
  return !e.plano_ate || e.plano_ate >= new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export async function configuracaoEmpresa(ctx: Contexto): Promise<Config & { sla_marcos: Record<string, number> }> {
  const { data } = await ctx.supabase.from("configuracoes").select("*").eq("empresa_id", ctx.empresa.id).single();
  if (!data) throw new Error("Configuração da empresa não encontrada");
  const num = (v: unknown) => Number(v) || 0;
  return {
    pontuacao_minima: num(data.pontuacao_minima),
    frete_pct: num(data.frete_pct),
    comissao_loja_pct: num(data.comissao_loja_pct),
    montagem_pct: num(data.montagem_pct),
    impostos_pct: num(data.impostos_pct),
    outros_pct: num(data.outros_pct),
    boleto_pct: num(data.boleto_pct),
    taxas_cartao: data.taxas_cartao ?? {},
    sla_marcos: data.sla_marcos ?? {},
  };
}
