"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_EMPRESA } from "@/lib/contexto";

export async function trocarEmpresa(id: string) {
  (await cookies()).set(COOKIE_EMPRESA, id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
