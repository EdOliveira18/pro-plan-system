import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { camposDe, exibir, SIM_NAO, type Entidade, type Campo } from "@/lib/cadastros";
import { salvarCadastro } from "./actions";
import CampoCEP from "@/components/CampoCEP";

function Input({ c, v, refs }: { c: Campo; v: string; refs: Record<string, { id: string; rotulo: string }[]> }) {
  const comum = { name: c.n, defaultValue: v, required: c.obrig };
  switch (c.tipo) {
    case "select": return <select {...comum}>{c.opcoes!.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>;
    case "bool": return <select {...comum}>{SIM_NAO.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>;
    case "ref": return <select {...comum}><option value="">Selecione</option>{(refs[c.n] ?? []).map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select>;
    case "textarea": return <textarea {...comum} rows={4} />;
    case "date": return <input type="date" {...comum} />;
    case "email": return <input type="email" {...comum} />;
    case "tel": return <input type="tel" inputMode="tel" placeholder="(11) 90000-0000" {...comum} />;
    case "money": return <input inputMode="decimal" placeholder="0,00" {...comum} />;
    case "pct": return <input inputMode="decimal" placeholder="0,00" {...comum} />;
    case "int": return <input type="number" inputMode="numeric" {...comum} />;
    case "cep": return <CampoCEP defaultValue={v} required={c.obrig} />;
    default: return <input {...comum} />;
  }
}

export default async function Formulario({ e, registro }: { e: Entidade; registro?: Record<string, any> }) {
  const ctx = await contexto();
  const refs: Record<string, { id: string; rotulo: string }[]> = {};
  for (const c of camposDe(e).filter((c) => c.tipo === "ref" && c.ref)) {
    const { data } = await ctx.supabase.from(c.ref!.tabela).select(`id, ${c.ref!.rotulo}`).eq("empresa_id", ctx.empresa.id).order(c.ref!.rotulo);
    refs[c.n] = ((data ?? []) as any[]).map((d) => ({ id: d.id, rotulo: d[c.ref!.rotulo] }));
  }
  const acao = salvarCadastro.bind(null, e.slug, registro?.id ?? null);
  return (
    <form action={acao} className="panel cad">
      {e.secoes.map((s, i) => (
        <section key={i}>
          {s.titulo && (i === 0 ? <h2 className="cad-h1">{s.titulo}</h2> : <h3 className="cad-sec">{s.titulo}</h3>)}
          <div className="cad-grid">
            {s.campos.map((c) => (
              <label key={c.n} style={c.larg ? { gridColumn: `span ${c.larg}` } : undefined} className={c.tipo === "textarea" ? "cad-area" : undefined}>
                <span>{c.label}{c.obrig && <i className="obr">*</i>}</span>
                <Input c={c} v={exibir(c, registro?.[c.n])} refs={refs} />
                {c.dica && <small className="note">{c.dica}</small>}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="cad-acoes">
        <button className="btn primary">Salvar</button>
        <Link className="btn" href={`/cadastros/${e.slug}`}>Voltar</Link>
      </div>
    </form>
  );
}
