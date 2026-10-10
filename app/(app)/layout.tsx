import { contexto } from "@/lib/contexto";
import Sidebar from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  return (
    <div className="app">
      <Sidebar empresa={ctx.empresa} empresas={ctx.empresas} nome={ctx.nome} email={ctx.email} />
      <main className="main">{children}</main>
    </div>
  );
}
