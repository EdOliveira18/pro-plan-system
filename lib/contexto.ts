import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServidor } from "./supabase/server";
import type { Config } from "./olhinho";

export const COOKIE_EMPRESA = "ppt_empresa";

export type Empresa = { id: string; nome: string; cnpj: string | null };
export type Contexto = {
  supabase: Awaited<ReturnType<typeof supabaseServidor>>;
  userId: string;
  email: string;
  nome: string;
  papel: string;
  empresa: Empresa;
  empresas: Empresa[];
};

// Carrega usuário, empresas em que é membro e a empresa ativa (cookie). Sem empresa vai para o onboarding.
export async function contexto(): Promise<Contexto> {
  const supabase = await supabaseServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const buscar = () => supabase
    .from("membros")
    .select("papel, nome, empresa:empresas(id, nome, cnpj)")
    .eq("user_id", user.id)
    .eq("ativo", true);
  // convites pendentes para o e-mail dessa pessoa viram acesso à empresa antes de montar a lista
  await supabase.rpc("aceitar_convites");
  const { data: membros } = await buscar();

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
  };
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
