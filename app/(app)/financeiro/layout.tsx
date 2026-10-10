import { contexto, exigir } from "@/lib/contexto";
// Acesso a esta área: dono, gerente e financeiro
export default async function Guarda({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  exigir(ctx, ctx.financeiro);
  return children;
}
