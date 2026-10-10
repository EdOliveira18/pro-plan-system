import { contexto, exigir } from "@/lib/contexto";
// Acesso a esta área: somente administração do Pro Plan System
export default async function Guarda({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  exigir(ctx, ctx.admin);
  return children;
}
