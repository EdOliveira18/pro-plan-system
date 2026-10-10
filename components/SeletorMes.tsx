import Link from "next/link";
import { periodo } from "@/lib/periodo";

export default function SeletorMes({ base, mes, extra = "" }: { base: string; mes?: string; extra?: string }) {
  const p = periodo(mes);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <Link className="btn sm" href={`${base}?mes=${p.anterior}${extra}`} aria-label="Mês anterior">‹</Link>
      <b style={{ minWidth: 150, textAlign: "center", textTransform: "capitalize" }}>{p.nome}</b>
      <Link className="btn sm" href={`${base}?mes=${p.proximo}${extra}`} aria-label="Próximo mês">›</Link>
    </div>
  );
}
