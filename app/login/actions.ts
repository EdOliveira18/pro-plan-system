"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";

const voltar = (modo: string, campo: "erro" | "msg", m: string) =>
  redirect(`/login?${modo ? "modo=" + modo + "&" : ""}${campo}=${encodeURIComponent(m)}`);

export async function entrar(fd: FormData) {
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")).trim(), password: String(fd.get("senha")) });
  if (error) {
    if (/confirm/i.test(error.message)) voltar("", "erro", "Seu e-mail ainda não foi confirmado. Abra o link que enviamos para a sua caixa de entrada.");
    voltar("", "erro", "E-mail ou senha incorretos. Se ainda não tem conta, clique em Criar conta.");
  }
  redirect("/dashboard");
}

export async function criarConta(fd: FormData) {
  const supabase = await supabaseServidor();
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get("email")).trim(),
    password: String(fd.get("senha")),
    options: { emailRedirectTo: `${origem}/auth/confirmar`, data: { nome: String(fd.get("nome") ?? "").trim() } },
  });
  if (error) {
    if (/registered|exists/i.test(error.message)) voltar("", "erro", "Esse e-mail já tem conta. Entre com a sua senha.");
    if (/password/i.test(error.message)) voltar("criar", "erro", "A senha precisa ter pelo menos 8 caracteres.");
    voltar("criar", "erro", "Não foi possível criar a conta: " + error.message);
  }
  // sem confirmação de e-mail a sessão já vem pronta; o contexto decide entre equipe convidada e cadastro de empresa
  if (data.session) redirect("/dashboard");
  voltar("", "msg", "Conta criada. Enviamos um link de confirmação para o seu e-mail; depois de confirmar, é só entrar.");
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
