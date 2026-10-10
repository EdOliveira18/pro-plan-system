import { contexto, exigir } from "@/lib/contexto";
// Acesso a esta área: todos menos montador
export default async function Guarda({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  exigir(ctx, ctx.papel !== "montador");
  return children;
}
