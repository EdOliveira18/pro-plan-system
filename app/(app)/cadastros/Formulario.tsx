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
    case "ref": case "membro": return <select {...comum}><option value="">Selecione</option>{(refs[c.n] ?? []).map((o) => <option key={o.id} value={o.id}>{o.rotulo}</option>)}</select>;
    case "cor": return <input type="color" {...comum} style={{ height: 38, padding: 2 }} />;
    case "time": return <input type="time" {...comum} />;
    case "num": return <input inputMode="decimal" {...comum} />;
    case "codigo": return <input {...comum} defaultValue={v || String(Math.floor(10000000 + Math.random() * 89999999))} />;
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
    let q = ctx.supabase.from(c.ref!.tabela).select(`id, ${c.ref!.rotulo}`).eq("empresa_id", ctx.empresa.id);
    for (const [k, v] of Object.entries(c.ref!.filtro ?? {})) q = q.eq(k, v);
    const { data } = await q.order(c.ref!.rotulo);
    refs[c.n] = ((data ?? []) as any[]).map((d) => ({ id: d.id, rotulo: d[c.ref!.rotulo] }));
  }
  if (camposDe(e).some((c) => c.tipo === "membro")) {
    const { data } = await ctx.supabase.from("membros").select("user_id, nome").eq("empresa_id", ctx.empresa.id).eq("ativo", true).order("nome");
    for (const c of camposDe(e).filter((c) => c.tipo === "membro")) refs[c.n] = (data ?? []).map((m: any) => ({ id: m.user_id, rotulo: m.nome }));
  }
  // dados de pagamento da equipe: quem é do financeiro vê e edita; os demais nem recebem os campos
  let secoes = e.secoes;
  if (e.sigilo) {
    if (ctx.financeiro) {
      if (registro?.id) {
        const { data: sig } = await ctx.supabase.from("pessoas_sigilo").select("*").eq("pessoa_id", registro.id).maybeSingle();
        registro = { ...registro, ...Object.fromEntries(Object.entries(sig ?? {}).filter(([k]) => e.sigilo!.includes(k))) };
      }
    } else {
      secoes = e.secoes.map((s) => ({ ...s, campos: s.campos.filter((c) => !e.sigilo!.includes(c.n)) })).filter((s) => s.campos.length);
    }
  }
  if (registro?.id) secoes = secoes.map((s) => ({ ...s, campos: s.campos.filter((c) => !c.soNovo) })).filter((s) => s.campos.length);
  const acao = salvarCadastro.bind(null, e.slug, registro?.id ?? null);
  return (
    <form action={acao} className="panel cad">
      {e.aviso && <div className="cad-aviso">{e.aviso}</div>}
      {e.sigilo && !ctx.financeiro && <div className="cad-aviso">Salário, comissão e dados bancários ficam visíveis só para dono, gerente e financeiro.</div>}
      {secoes.map((s, i) => (
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
