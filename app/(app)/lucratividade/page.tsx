import Link from "next/link";
import { contexto, configuracaoEmpresa } from "@/lib/contexto";
import { brl, pct, data } from "@/lib/formato";
import { lucratividade } from "@/lib/lucratividade";

export default async function Lucratividade({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const hoje = new Date();
  const de = sp.de ?? new Date(hoje.getFullYear(), hoje.getMonth() - 3, hoje.getDate()).toISOString().slice(0, 10);
  const ate = sp.ate ?? hoje.toISOString().slice(0, 10);
  const { data: ks } = await ctx.supabase.from("contratos").select("id, codigo, valor_total, vpl, custo_previsto, lucro_previsto, created_at, cliente:clientes(nome)")
    .eq("empresa_id", eid).gte("created_at", de).lte("created_at", ate + "T23:59:59").order("created_at", { ascending: false });
  const ids = (ks ?? []).map((k: any) => k.id);
  const [{ data: lancs }, { data: movs }, cfg] = await Promise.all([
    ids.length ? ctx.supabase.from("lancamentos").select("contrato_id, valor, realizado, categoria, excluido_em").in("contrato_id", ids) : Promise.resolve({ data: [] as any[] }),
    ids.length ? ctx.supabase.from("estoque_movimentos").select("contrato_id, tipo, quantidade, custo_unit").in("contrato_id", ids) : Promise.resolve({ data: [] as any[] }),
    configuracaoEmpresa(ctx),
  ]);
  const minima = Number((cfg as any)?.margem_minima_pct ?? 20) / 100;
  const t = (sp.q ?? "").toLowerCase().trim();
  const linhas = lucratividade(ks ?? [], lancs ?? [], movs ?? []).filter((l) => !t || [l.codigo, l.cliente].some((x) => x.toLowerCase().includes(t)));
  const S = (f: (l: any) => number) => linhas.reduce((a, l) => a + f(l), 0);
  const vpl = S((l) => l.vpl), lucro = S((l) => l.lucro);
  const prejuizo = linhas.filter((l) => l.lucro < 0).length, abaixo = linhas.filter((l) => l.margem != null && l.margem >= 0 && l.margem < minima).length, semCusto = linhas.filter((l) => l.semCusto).length;
  return (
    <>
      <div className="head"><div><h1>Lucratividade</h1><p className="sub">Quanto sobrou de cada contrato: venda, custo real (financeiro e baixas de estoque) e lucro. Clique no contrato para ver o detalhe.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 16 }}>
        <div className="panel kpi"><div className="l">Contratos faturados</div><div className="v">{linhas.length}</div><div className="s">{semCusto} sem custo lançado</div></div>
        <div className="panel kpi"><div className="l">Vendas</div><div className="v">{brl(S((l) => l.venda))}</div><div className="s">recebido {brl(S((l) => l.recebido))} · a receber {brl(S((l) => l.aReceber))}</div></div>
        <div className="panel kpi"><div className="l">Custo real</div><div className="v">{brl(S((l) => l.custoReal))}</div><div className="s">previsto {brl(S((l) => l.custoPrevisto))}</div></div>
        <div className="panel kpi" style={{ background: "var(--good-soft)" }}><div className="l">Lucro real</div><div className="v" style={{ color: lucro < 0 ? "var(--bad)" : "var(--good)" }}>{brl(lucro)}</div>
          <div className="s">margem {vpl ? pct(lucro / vpl) : "n/a"} · prevista {vpl ? pct(S((l) => (l.margemPrevista ?? 0) * l.vpl) / vpl) : "n/a"}</div></div>
        <div className="panel kpi"><div className="l">Alertas</div><div className="v">{prejuizo + abaixo}</div><div className="s">{prejuizo} em prejuízo · {abaixo} abaixo da mínima ({Math.round(minima * 100)}%)</div></div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar contrato ou cliente" style={{ flex: 1 }} aria-label="Buscar" />
          <span className="note" style={{ alignSelf: "center" }}>Faturados de</span><input type="date" name="de" defaultValue={de} aria-label="De" /><span className="note" style={{ alignSelf: "center" }}>a</span><input type="date" name="ate" defaultValue={ate} aria-label="Até" /><button className="btn">Filtrar</button></form>
        <div className="scroll"><table className="cad-tab">
          <thead><tr><th>Contrato</th><th>Faturado</th><th className="r">Venda</th><th className="r">VPL</th><th className="r">Custo real</th><th className="r">Lucro real</th><th className="r">Margem</th></tr></thead>
          <tbody>{linhas.map((l) => (
            <tr key={l.id}>
              <td><Link className="idc" href={`/contratos/${l.id}`}>#{l.codigo}</Link><div className="note">{l.cliente}</div></td>
              <td className="num note">{data(l.faturado)}</td>
              <td className="r num">{brl(l.venda)}<div className="note">recebido {brl(l.recebido)}</div></td>
              <td className="r num">{brl(l.vpl)}</td>
              <td className="r num">{brl(l.custoReal)}<div className="note">previsto {brl(l.custoPrevisto)}{l.estoque ? ` · estoque ${brl(l.estoque)}` : ""}</div></td>
              <td className="r num" style={{ color: l.lucro < 0 ? "var(--bad)" : undefined, fontWeight: 600 }}>{brl(l.lucro)}</td>
              <td className="r">{l.margem == null ? "n/a" : <span className={"pill " + (l.margem < 0 ? "p-bad" : l.margem < minima ? "p-warn" : "p-good")}>{pct(l.margem)}</span>}
                {l.semCusto && <div className="note">sem custo lançado</div>}</td>
            </tr>))}</tbody>
        </table></div>
        {!linhas.length && <div className="vazio"><b>Nenhum contrato faturado no período.</b></div>}
      </div>
      <p className="note">Custo real = saídas do financeiro ligadas ao contrato (pagas ou a pagar: fábrica, compras, frete, montagem, impostos) + baixas de estoque. A comissão RT não entra porque o VPL já é líquido dela. O que ainda não foi lançado no financeiro não aparece aqui; compare com o previsto. A margem mínima de alerta fica em Configurações de orçamentos.</p>
    </>
  );
}
