"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServidor } from "@/lib/supabase/server";

const erro = (m: string) => redirect("/login?erro=" + encodeURIComponent(m));

export async function entrar(fd: FormData) {
  const supabase = await supabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: String(fd.get("email")), password: String(fd.get("senha")) });
  if (error) erro("E-mail ou senha incorretos.");
  redirect("/dashboard");
}

export async function criarConta(fd: FormData) {
  const supabase = await supabaseServidor();
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const { data, error } = await supabase.auth.signUp({
    email: String(fd.get("email")),
    password: String(fd.get("senha")),
    options: { emailRedirectTo: `${origem}/auth/confirmar` },
  });
  if (error) erro(error.message.includes("registered") ? "Esse e-mail já tem conta. Use Entrar." : "Não foi possível criar a conta: " + error.message);
  if (data.session) redirect("/onboarding");
  redirect("/login?msg=" + encodeURIComponent("Enviamos um link de confirmação para o seu e-mail."));
}

export async function sair() {
  const supabase = await supabaseServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
