import Link from "next/link";

export const POR_PAGINA = 50;

/** Página atual vinda da URL (?pag=2) e o intervalo para o .range() do Supabase */
export function pagina(v?: string, por = POR_PAGINA) {
  const p = Math.max(1, Math.floor(Number(v) || 1));
  return { pag: p, de: (p - 1) * por, ate: p * por - 1, por };
}

/** Rodapé "Mostrando X a Y de Z" com anterior e próxima, mantendo os outros filtros da URL */
export default function Paginacao({ total, pag, por = POR_PAGINA, base, params }: {
  total: number; pag: number; por?: number; base: string; params: Record<string, string | undefined>;
}) {
  const paginas = Math.max(1, Math.ceil(total / por));
  const link = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "pag" && k !== "erro" && k !== "msg") q.set(k, v);
    if (p > 1) q.set("pag", String(p));
    const s = q.toString();
    return base + (s ? "?" + s : "");
  };
  const ini = total ? (pag - 1) * por + 1 : 0;
  const fim = Math.min(total, pag * por);
  return (
    <div className="cad-rod note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span>Mostrando {ini} a {fim} de {total} registros</span>
      {paginas > 1 && (
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {pag > 1 ? <Link className="btn sm" href={link(pag - 1)}>Anterior</Link> : <span className="btn sm" aria-disabled style={{ opacity: 0.4 }}>Anterior</span>}
          <span>Página {pag} de {paginas}</span>
          {pag < paginas ? <Link className="btn sm" href={link(pag + 1)}>Próxima</Link> : <span className="btn sm" aria-disabled style={{ opacity: 0.4 }}>Próxima</span>}
        </span>
      )}
    </div>
  );
}
