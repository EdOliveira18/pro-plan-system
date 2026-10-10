"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Refazer({ id }: { id: string }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  return (
    <button className="btn sm" disabled={rodando} onClick={async () => {
      setRodando(true);
      await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderId: id }) });
      setRodando(false);
      router.refresh();
    }}>{rodando ? "Gerando…" : "Gerar de novo"}</button>
  );
}
