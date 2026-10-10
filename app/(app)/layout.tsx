import Link from "next/link";
import { contexto, planoAtivo } from "@/lib/contexto";
import Sidebar from "@/components/Sidebar";
import { data } from "@/lib/formato";
import { hojeISO } from "@/lib/tempo";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await contexto();
  const ativo = planoAtivo(ctx.empresa) || ctx.admin;
  const e = ctx.empresa;
  const diasTeste = e.plano === "teste" && e.plano_ate ? Math.ceil((new Date(e.plano_ate + "T12:00:00Z").getTime() - new Date(hojeISO() + "T12:00:00Z").getTime()) / 864e5) : null;
  return (
    <div className="app">
      <Sidebar empresa={ctx.empresa} empresas={ctx.empresas} nome={ctx.nome} email={ctx.email} papel={ctx.papel} financeiro={ctx.financeiro} admin={ctx.admin} />
      <main className="main">
        {diasTeste != null && diasTeste >= 0 && ativo && <div className="cad-aviso" style={{ margin: "0 0 14px" }}>Período de teste: {diasTeste === 0 ? "termina hoje" : `faltam ${diasTeste} dia(s)`} (até {data(e.plano_ate)}). Fale com a gente para assinar e manter tudo funcionando.</div>}
        {ativo ? children : (
          <div className="panel" style={{ maxWidth: 620 }}>
            <h1>{e.plano === "suspenso" ? "Acesso suspenso" : "Período de teste encerrado"}</h1>
            <p>O acesso de <b>{e.nome}</b> {e.plano === "suspenso" ? "está suspenso" : `venceu em ${data(e.plano_ate)}`}. Seus dados continuam guardados e voltam a aparecer assim que a assinatura for ativada.</p>
            <p className="note">Para assinar ou reativar, fale com o suporte do Pro Plan System.</p>
            {ctx.empresas.length > 1 && <p className="note">Você também pode trocar de empresa no menu ao lado.</p>}
            <Link className="btn" href="/login">Sair</Link>
          </div>
        )}
      </main>
    </div>
  );
}
