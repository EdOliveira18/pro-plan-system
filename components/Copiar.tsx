"use client";
import { useState } from "react";
export default function Copiar({ texto }: { texto: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="btn sm" onClick={async () => { try { await navigator.clipboard.writeText(texto); setOk(true); setTimeout(() => setOk(false), 1500); } catch { prompt("Copie o link:", texto); } }}>{ok ? "Copiado" : "Copiar link"}</button>;
}
