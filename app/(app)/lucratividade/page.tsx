import Link from "next/link";
import { contexto, configuracaoEmpresa } from "@/lib/contexto";
import { brl, pct, data } from "@/lib/formato";
import { hojeISO, inicioMesesAtras } from "@/lib/tempo";
import Paginacao, { pagina } from "@/components/Paginacao";
import { limparTermo, inicioDia, fimDia } from "@/lib/busca";

export default async function Lucratividade({ searchParams }: { searchParams: Promise<{ q?: string; de?: string; ate?: string; pag?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const okData = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");
  const de = okData(sp.de) || inicioMesesAtras(3).slice(0, 10);
  const ate = okData(sp.ate) || hojeISO();
  const pg = pagina(sp.pag);
  const cfg = await configuracaoEmpresa(ctx);
  const minima = Number((cfg as any)?.margem_minima_pct ?? 20) / 100;
  const termo = limparTermo(sp.q);
  let qk = ctx.supabase.from("contratos").select("id, codigo, valor_total, vpl, custo_previsto, lucro_previsto, created_at, cliente:clientes(nome)", { count: "exact" })
    .eq("empresa_id", eid).gte("created_at", inicioDia(de)).lte("created_at", fimDia(ate));
  if (termo) {
    const { data: cs } = await ctx.supabase.from("clientes").select("id").eq("empresa_id", eid).ilike("nome", `%${termo}%`).limit(300);
    const ids = (cs ?? []).map((c: any) => c.id);
    qk = qk.or([`codigo.ilike.%${termo}%`, ...(ids.length ? [`cliente_id.in.(${ids.join(",")})`] : [])].join(","));
  }
  // totais do período inteiro calculados no banco; a tabela mostra uma página por vez
  const [{ data: ks, count }, { data: res }] = await Promise.all([
    qk.order("created_at", { ascending: false }).order("id").range(pg.de, pg.ate),
    ctx.supabase.rpc("lucro_resumo", { p_empresa: eid, p_de: inicioDia(de), p_ate: fimDia(ate), p_minima: minima }),
  ]);
  const ids = (ks ?? []).map((k: any) => k.id);
  const { data: lc } = ids.length
    ? await ctx.supabase.rpc("lucro_contratos", { p_empresa: eid, p_de: inicioDia(de), p_ate: fimDia(ate) }).in("contrato_id", ids)
    : { data: [] as any[] };
  const porK = new Map(((lc ?? []) as any[]).map((x) => [x.contrato_id, x]));
  const linhas = ((ks ?? []) as any[]).map((k) => {
    const x = porK.get(k.id) ?? { recebido: 0, a_receber: 0, custo_lanc: 0, estoque: 0 };
    const estoque = Number(x.estoque), custoReal = Number(x.custo_lanc) + estoque, vpl = Number(k.vpl), lucro = vpl - custoReal;
    return { id: k.id, codigo: k.codigo, cliente: k.cliente?.nome ?? "", faturado: k.created_at, venda: Number(k.valor_total), vpl,
      recebido: Number(x.recebido), aReceber: Number(x.a_receber), custoReal, custoPrevisto: Number(k.custo_previsto), estoque,
      lucro, margem: vpl > 0 ? lucro / vpl : null, semCusto: custoReal === 0 };
  });
  const R = (res ?? {}) as any;
  const r = (k: string) => Number(R[k] ?? 0);
  const vpl = r("vpl"), lucro = r("vpl") - r("custo");
  const prejuizo = r("prejuizo"), abaixo = r("abaixo"), semCusto = r("sem_custo");
  return (
    <>
      <div className="head"><div><h1>Lucratividade</h1><p className="sub">Quanto sobrou de cada contrato: venda, custo real (financeiro e baixas de estoque) e lucro. Clique no contrato para ver o detalhe.</p></div></div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 16 }}>
        <div className="panel kpi"><div className="l">Contratos faturados</div><div className="v">{r("qtd")}</div><div className="s">{semCusto} sem custo lançado</div></div>
        <div className="panel kpi"><div className="l">Vendas</div><div className="v">{brl(r("venda"))}</div><div className="s">recebido {brl(r("recebido"))} · a receber {brl(r("a_receber"))}</div></div>
        <div className="panel kpi"><div className="l">Custo real</div><div className="v">{brl(r("custo"))}</div><div className="s">previsto {brl(r("custo_previsto"))}</div></div>
        <div className="panel kpi" style={{ background: "var(--good-soft)" }}><div className="l">Lucro real</div><div className="v" style={{ color: lucro < 0 ? "var(--bad)" : "var(--good)" }}>{brl(lucro)}</div>
          <div className="s">margem {vpl ? pct(lucro / vpl) : "n/a"} · prevista {vpl ? pct(r("lucro_previsto") / vpl) : "n/a"}</div></div>
        <div className="panel kpi"><div className="l">Alertas</div><div className="v">{prejuizo + abaixo}</div><div className="s">{prejuizo} em prejuízo · {abaixo} abaixo da mínima ({Math.round(minima * 100)}%)</div></div>
      </div>
      <div className="panel" style={{ padding: 0 }}>
        <form className="cad-busca"><input name="q" defaultValue={sp.q ?? ""} placeholder="Buscar contrato ou cliente (os totais acima são do período todo)" style={{ flex: 1 }} aria-label="Buscar" />
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
        <Paginacao total={count ?? 0} pag={pg.pag} base="/lucratividade" params={sp} />
      </div>
      <p className="note">Custo real = saídas do financeiro ligadas ao contrato (pagas ou a pagar: fábrica, compras, frete, montagem, impostos) + baixas de estoque. A comissão RT não entra porque o VPL já é líquido dela. O que ainda não foi lançado no financeiro não aparece aqui; compare com o previsto. A margem mínima de alerta fica em Configurações de orçamentos.</p>
    </>
  );
}
