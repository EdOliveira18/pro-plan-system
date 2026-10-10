"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { tokenConexao, registrarConexao } from "@/app/(app)/financeiro/banco-actions";

const PluggyConnect = dynamic(() => import("react-pluggy-connect").then((m) => m.PluggyConnect), { ssr: false });

export default function ConectarBanco({ sandbox, itemId, rotulo }: { sandbox: boolean; itemId?: string; rotulo?: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [estado, setEstado] = useState<{ t: "erro" | "ok" | "info"; m: string } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function abrir() {
    setCarregando(true);
    setEstado(null);
    const r = await tokenConexao(itemId);
    setCarregando(false);
    if (r.ok) setToken(r.token);
    else setEstado({ t: "erro", m: r.erro });
  }

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div><button className="btn primary" onClick={abrir} disabled={carregando}>{carregando ? "Abrindo…" : rotulo ?? "Conectar banco pelo Open Finance"}</button></div>
      {estado && <div className={estado.t === "erro" ? "erro" : "ok"} style={{ marginBottom: 0 }}>{estado.m}</div>}
      {token && (
        <PluggyConnect
          connectToken={token}
          includeSandbox={sandbox}
          updateItem={itemId}
          onClose={() => setToken(null)}
          onError={(e) => setEstado({ t: "erro", m: "O banco recusou a conexão: " + (e?.message ?? "tente de novo") })}
          onSuccess={async (d) => {
            setToken(null);
            setEstado({ t: "info", m: "Banco conectado. Trazendo contas e movimentações…" });
            const r = await registrarConexao(d.item.id);
            setEstado(r.ok ? { t: "ok", m: r.resumo ?? "Conectado." } : { t: "erro", m: r.erro ?? "Falha ao sincronizar." });
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
