"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Refazer({ id }: { id: string }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  return (
    <button className="btn sm" disabled={rodando} onClick={async () => {
      setRodando(true);
      const resp = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderId: id, novamente: true }) });
      if (!resp.ok) { const j = await resp.json().catch(() => ({})); if (j.erro) alert(j.erro); }
      setRodando(false);
      router.refresh();
    }}>{rodando ? "Gerando…" : "Gerar de novo"}</button>
  );
}
