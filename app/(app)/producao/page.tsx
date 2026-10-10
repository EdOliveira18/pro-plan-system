import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import { ETAPAS_OP, NOME_ETAPA, STATUS_OP } from "@/lib/producao";
import KanbanOP from "@/components/KanbanOP";
import Confirmar from "@/components/Confirmar";
import NavProd from "./NavProd";
import { carregarOPs, filtrar } from "./dados";
import { moverOP, statusOP } from "./acoes";

export default async function Producao({ searchParams }: { searchParams: Promise<{ q?: string; f?: string; t?: string; op?: string; msg?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const [ops, { data: funcs }, { data: tipos }] = await Promise.all([
    carregarOPs(ctx, ["aguardando", "em_producao", "pausada"]),
    ctx.supabase.from("pessoas").select("id, nome").eq("empresa_id", ctx.empresa.id).eq("categoria", "funcionario").order("nome"),
    ctx.supabase.from("tipos_servico").select("id, nome").eq("empresa_id", ctx.empresa.id).order("nome"),
  ]);
  const lista = filtrar(ops, sp.q).filter((o) => (!sp.f || o.responsavel?.id === sp.f) && (!sp.t || o.tipo?.id === sp.t));
  const sel = sp.op ? ops.find((o) => o.id === sp.op) : null;
  return (<>
    <div className="head"><div><nav className="migalha">Produção › Kanban</nav><h1>Kanban de Produção</h1><p className="sub">Arraste o card para a próxima etapa. Ao sair de Agendada a produção é marcada como iniciada.</p></div>
      <Link className="btn primary" href="/producao/nova">Cadastrar</Link></div>
    <NavProd atual="/producao" />
    {sp.msg && <div className="ok">{sp.msg}</div>}
    <form style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, alignItems: "end" }}>
      <label>Board de produção<select name="t" defaultValue={sp.t ?? ""}><option value="">Produção (todos os serviços)</option>{(tipos ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
      <label>Funcionário<select name="f" defaultValue={sp.f ?? ""}><option value="">Todos</option>{(funcs ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
      <label style={{ flex: 1, minWidth: 200 }}>Buscar<input name="q" defaultValue={sp.q ?? ""} placeholder="Cliente, contrato ou OP…" /></label>
      <button className="btn">Filtrar</button><Link className="btn" href="/producao">Limpar</Link>
    </form>
    {sel && (
      <div className="panel" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div><h2 style={{ margin: 0 }}>OP {sel.numero} · {sel.contrato?.cliente?.nome ?? "Sem contrato"}</h2>
            <div className="note">{NOME_ETAPA[sel.etapa]} · <span className={"pill " + STATUS_OP[sel.status][1]}>{STATUS_OP[sel.status][0]}</span> · previsão {sel.previsao_inicio ? data(sel.previsao_inicio) : "n/a"} a {sel.previsao_fim ? data(sel.previsao_fim) : "n/a"}{sel.tipo ? ` · ${sel.tipo.nome}` : ""}</div>
            {sel.descricao && <p style={{ margin: "6px 0 0" }}>{sel.descricao}</p>}</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "start" }}>
            {sel.status !== "em_producao" && <form action={statusOP.bind(null, sel.id, "em_producao")}><button className="btn sm">{sel.status === "pausada" ? "Retomar" : "Iniciar"}</button></form>}
            {sel.status === "em_producao" && <form action={statusOP.bind(null, sel.id, "pausada")}><button className="btn sm">Pausar</button></form>}
            <form action={statusOP.bind(null, sel.id, "finalizada")}><Confirmar className="btn primary sm" texto="Finalizar esta ordem de produção?">Finalizar</Confirmar></form>
            <details className="cad-imp"><summary className="btn sm">Cancelar</summary>
              <form action={statusOP.bind(null, sel.id, "cancelada")} className="panel" style={{ display: "grid", gap: 8 }}><label>Motivo<input name="motivo" required /></label><button className="btn sm">Cancelar OP</button></form></details>
            <Link className="btn sm" href="/producao">Fechar</Link>
          </div>
        </div>
      </div>
    )}
    <KanbanOP etapas={ETAPAS_OP} mover={moverOP} cards={lista.map((o) => ({ id: o.id, numero: o.numero, etapa: o.etapa, status: o.status, cliente: o.contrato?.cliente?.nome, contrato: o.contrato?.codigo,
      contratoId: o.contrato?.id, descricao: o.descricao ?? undefined, responsavel: o.responsavel?.nome, previsao_fim: o.previsao_fim, atrasada: o.atrasada }))} />
  </>);
}
