"use client";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";

type Card = { id: string; numero: number; etapa: string; status: string; cliente?: string; contrato?: string; contratoId?: string; descricao?: string; responsavel?: string; previsao_fim?: string | null; atrasada: boolean };

// Kanban de produção: arraste o card para outra coluna ou use as setas
export default function KanbanOP({ etapas, cards, mover }: { etapas: [string, string][]; cards: Card[]; mover: (id: string, etapa: string) => Promise<void> }) {
  const [pend, start] = useTransition();
  const [lista, setLista] = useOptimistic(cards, (atual: Card[], m: { id: string; etapa: string }) => atual.map((c) => (c.id === m.id ? { ...c, etapa: m.etapa } : c)));
  const ir = (id: string, etapa: string) => start(async () => { setLista({ id, etapa }); await mover(id, etapa); });
  const idx = (e: string) => etapas.findIndex(([k]) => k === e);
  return (
    <div className="kanban" style={{ opacity: pend ? 0.85 : 1 }}>
      {etapas.map(([k, nome]) => {
        const col = lista.filter((c) => c.etapa === k);
        return (
          <section key={k} className="kcol" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData("text/plain"); if (id) ir(id, k); }}>
            <header><b>{nome}</b><span className="note">{col.length} produç{col.length === 1 ? "ão" : "ões"}</span></header>
            {col.map((c) => (
              <article key={c.id} className={"kcard-op" + (c.atrasada ? " atrasada" : "")} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}><b className="num">OP {c.numero}</b>{c.contrato && <Link className="idc" href={`/contratos/${c.contratoId}`}>#{c.contrato}</Link>}</div>
                <div>{c.cliente ?? "Sem contrato"}</div>
                {c.descricao && <div className="note">{c.descricao}</div>}
                <div className="note">{c.responsavel ?? "Sem responsável"}{c.previsao_fim ? ` · até ${c.previsao_fim.split("-").reverse().join("/")}` : ""}</div>
                {c.status === "pausada" && <span className="pill p-warn">Pausada</span>}
                {c.atrasada && <span className="pill p-bad">Atrasada</span>}
                <div className="kmove">
                  <button type="button" className="btn sm" disabled={idx(c.etapa) <= 0} onClick={() => ir(c.id, etapas[idx(c.etapa) - 1][0])} aria-label="Etapa anterior">←</button>
                  <Link className="btn sm" href={`/producao?op=${c.id}`}>Detalhes</Link>
                  <button type="button" className="btn sm" disabled={idx(c.etapa) >= etapas.length - 1} onClick={() => ir(c.id, etapas[idx(c.etapa) + 1][0])} aria-label="Próxima etapa">→</button>
                </div>
              </article>
            ))}
          </section>
        );
      })}
    </div>
  );
}
