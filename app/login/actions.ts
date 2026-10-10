"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";

// só aceita caminhos internos, para o parâmetro next não virar redirecionamento para fora
const destinoSeguro = (v: unknown) => {
  const s = String(v ?? "");
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : "/dashboard";
};
const voltar = (modo: string, campo: "erro" | "msg", m: string, next = "") =>
  redirect(`/login?${modo ? "modo=" + modo + "&" : ""}${next ? "next=" + encodeURIComponent(next) + "&" : ""}${campo}=${encodeURIComponent(m)}`);

export async function entrar(fd: FormData) {
  const next = fd.get("next") ? destinoSeguro(fd.get("next")) : "";
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("senha")) });
  if (error) {
    if (/confirm/i.test(error.message)) voltar("", "erro", "Seu e-mail ainda não foi confirmado. Abra o link que enviamos para a sua caixa de entrada.", next);
    voltar("", "erro", "E-mail ou senha incorretos. Se ainda não tem conta, clique em Criar conta.", next);
  }
  redirect(next || "/dashboard");
}

export async function criarConta(fd: FormData) {
  const next = fd.get("next") ? destinoSeguro(fd.get("next")) : "";
  const supabase = await supabaseServidor();
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get("email")).trim(),
    password: String(fd.get("senha")),
    options: { emailRedirectTo: `${origem}/auth/confirmar${next ? "?next=" + encodeURIComponent(next) : ""}`, data: { nome: String(fd.get("nome") ?? "").trim() } },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) voltar("", "erro", "Esse e-mail já tem conta. Entre com a sua senha.", next);
    if (/password/i.test(error.message)) voltar("criar", "erro", "A senha precisa ter pelo menos 8 caracteres.", next);
    voltar("criar", "erro", "Não foi possível criar a conta: " + error.message, next);
  }
  // sem confirmação de e-mail a sessão já vem pronta; o contexto decide entre equipe convidada e cadastro de empresa
  if (data.session) redirect(next || "/dashboard");
  voltar("", "msg", "Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, é só entrar.", next);
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
