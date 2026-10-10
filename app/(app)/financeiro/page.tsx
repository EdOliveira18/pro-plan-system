import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, pct, data } from "@/lib/formato";
import { periodo, nomeMembro } from "@/lib/periodo";
import SeletorMes from "@/components/SeletorMes";

const ABAS: [string, string][] = [["fluxo", "Fluxo de caixa"], ["contratos", "DRE por contrato"], ["comissoes", "Comissões"], ["fiscal", "Fiscal"]];
const CATEGORIAS = ["recebimento", "fabrica", "frete", "montagem", "comissao_loja", "comissao_rt", "imposto", "taxa", "aluguel", "salarios", "marketing", "despesa_fixa", "outros"];
const ir = (aba: string, mes: string, erro?: string) => {
  revalidatePath("/financeiro");
  redirect(`/financeiro?aba=${aba}&mes=${mes}${erro ? "&erro=" + encodeURIComponent(erro) : ""}`);
};

async function novoLanc(mes: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const valor = Math.abs(Number(String(fd.get("valor")).replace(/\./g, "").replace(",", ".")));
  const { error } = await ctx.supabase.from("lancamentos").insert({
    empresa_id: ctx.empresa.id, contrato_id: String(fd.get("contrato_id") || "") || null, data: String(fd.get("data")),
    descricao: String(fd.get("descricao")).trim(), categoria: String(fd.get("categoria")),
    valor: fd.get("tipo") === "entrada" ? valor : -valor, realizado: fd.get("realizado") === "on",
  });
  ir("fluxo", mes, error ? "Não foi possível lançar. Montador não tem acesso ao financeiro." : undefined);
}
async function alternar(mes: string, id: string, realizado: boolean) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("lancamentos").update({ realizado }).eq("id", id);
  ir("fluxo", mes, error?.message);
}
async function novaNota(mes: string, fd: FormData) {
  "use server";
  const ctx = await contexto();
  const { error } = await ctx.supabase.from("notas_fiscais").insert({
    empresa_id: ctx.empresa.id, contrato_id: String(fd.get("contrato_id") || "") || null, tipo: String(fd.get("tipo")),
    numero: String(fd.get("numero") || "") || null, valor: Number(String(fd.get("valor")).replace(",", ".")), status: String(fd.get("status")),
  });
  ir("fiscal", mes, error?.message);
}
async function statusNota(mes: string, id: string, status: string) {
  "use server";
  const ctx = await contexto();
  await ctx.supabase.from("notas_fiscais").update({ status }).eq("id", id);
  ir("fiscal", mes);
}

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ aba?: string; mes?: string; erro?: string }> }) {
  const sp = await searchParams;
  const aba = sp.aba ?? "fluxo";
  const p = periodo(sp.mes);
  const ctx = await contexto();
  const sb = ctx.supabase;
  const eid = ctx.empresa.id;
  const hoje = new Date().toISOString().slice(0, 10);
  const { data: contratos } = await sb.from("contratos").select("id, codigo, data_venda, valor_total, vpl, custo_previsto, lucro_previsto, vendedor_id, parceiro_id, cliente:clientes(nome), parceiro:parceiros(nome, rt_pct)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(500);
  const K = (contratos ?? []) as any[];
  let corpo: React.ReactNode = null;

  if (aba === "fluxo") {
    const [{ data: doMes }, { data: atrasados }, { data: realizados }] = await Promise.all([
      sb.from("lancamentos").select("*, contrato:contratos(codigo)").eq("empresa_id", eid).gte("data", p.inicio).lt("data", p.fim).order("data"),
      sb.from("lancamentos").select("valor").eq("empresa_id", eid).eq("realizado", false).lt("data", hoje).gt("valor", 0),
      sb.from("lancamentos").select("valor").eq("empresa_id", eid).eq("realizado", true),
    ]);
    const L = (doMes ?? []) as any[];
    const soma = (f: (l: any) => boolean) => L.filter(f).reduce((s, l) => s + Number(l.valor), 0);
    const entPrev = soma((l) => l.valor > 0), saiPrev = -soma((l) => l.valor < 0);
    const entReal = soma((l) => l.valor > 0 && l.realizado), saiReal = -soma((l) => l.valor < 0 && l.realizado);
    const caixa = (realizados ?? []).reduce((s, l) => s + Number(l.valor), 0);
    const vencido = (atrasados ?? []).reduce((s, l) => s + Number(l.valor), 0);
    let saldo = caixa;
    corpo = (<>
      <div className="grid kpis">
        <div className="panel kpi"><div className="l">Saldo realizado acumulado</div><div className="v">{brl(caixa)}</div><div className="s">Entradas menos saídas já pagas</div></div>
        <div className="panel kpi"><div className="l">Entradas no mês</div><div className="v" style={{ color: "var(--good)" }}>{brl(entPrev)}</div><div className="s">{brl(entReal)} já recebido</div></div>
        <div className="panel kpi"><div className="l">Saídas no mês</div><div className="v" style={{ color: "var(--bad)" }}>{brl(saiPrev)}</div><div className="s">{brl(saiReal)} já pago</div></div>
        <div className="panel kpi"><div className="l">Recebimentos vencidos</div><div className="v" style={{ color: vencido ? "var(--bad)" : undefined }}>{brl(vencido)}</div><div className="s">Previstos até ontem e não marcados</div></div>
      </div>
      <div className="panel mt">
        <h2>Lançamentos de {p.nome}</h2>
        <div className="scroll"><table>
          <thead><tr><th>Data</th><th>Descrição</th><th>Contrato</th><th>Categoria</th><th className="r">Valor</th><th className="r">Saldo projetado</th><th></th></tr></thead>
          <tbody>
            {L.map((l) => { if (!l.realizado) saldo += Number(l.valor); return (
              <tr key={l.id} style={{ opacity: l.realizado ? 0.7 : 1 }}>
                <td className="num">{data(l.data)}{!l.realizado && l.data < hoje && Number(l.valor) > 0 && <span className="pill p-bad" style={{ marginLeft: 6 }}>vencido</span>}</td>
                <td>{l.descricao}</td>
                <td>{l.contrato ? <Link className="idc" href={`/contratos/${l.contrato_id}?aba=financeiro`}>#{l.contrato.codigo}</Link> : <span className="note">avulso</span>}</td>
                <td><span className="pill p-neu">{l.categoria}</span></td>
                <td className="r num" style={{ color: Number(l.valor) > 0 ? "var(--good)" : "var(--bad)" }}>{brl(l.valor)}</td>
                <td className="r num">{l.realizado ? <span className="note">realizado</span> : brl(saldo)}</td>
                <td><form action={alternar.bind(null, p.chave, l.id, !l.realizado)}><button className="btn sm">{l.realizado ? "Desfazer" : Number(l.valor) > 0 ? "Recebido" : "Pago"}</button></form></td>
              </tr>); })}
            {!L.length && <tr><td colSpan={7} className="note">Nenhum lançamento neste mês.</td></tr>}
          </tbody>
        </table></div>
        <h2 className="mt">Novo lançamento</h2>
        <form action={novoLanc.bind(null, p.chave)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, alignItems: "end" }}>
          <label>Data<input type="date" name="data" required defaultValue={hoje} /></label>
          <label style={{ gridColumn: "span 2" }}>Descrição<input name="descricao" required placeholder="Ex.: Aluguel do showroom" /></label>
          <label>Tipo<select name="tipo"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label>
          <label>Categoria<select name="categoria" defaultValue="despesa_fixa">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Valor (R$)<input name="valor" inputMode="decimal" required /></label>
          <label>Contrato<select name="contrato_id" defaultValue=""><option value="">Avulso</option>{K.map((k) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
          <label style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" name="realizado" /> Já pago / recebido</label>
          <button className="btn primary">Lançar</button>
        </form>
      </div>
    </>);
  }

  if (aba === "contratos") {
    const { data: lanc } = await sb.from("lancamentos").select("contrato_id, valor, realizado").eq("empresa_id", eid).not("contrato_id", "is", null);
    const linhas = K.map((k) => {
      const ls = (lanc ?? []).filter((l) => l.contrato_id === k.id && l.realizado);
      const rec = ls.filter((l) => Number(l.valor) > 0).reduce((s, l) => s + Number(l.valor), 0);
      const sai = -ls.filter((l) => Number(l.valor) < 0).reduce((s, l) => s + Number(l.valor), 0);
      return { ...k, rec, sai, real: rec - sai };
    });
    const tot = linhas.reduce((a, l) => ({ v: a.v + Number(l.valor_total), lp: a.lp + Number(l.lucro_previsto), r: a.r + l.real, vpl: a.vpl + Number(l.vpl) }), { v: 0, lp: 0, r: 0, vpl: 0 });
    corpo = (<>
      <div className="grid k3">
        <div className="panel kpi"><div className="l">Total vendido</div><div className="v">{brl(tot.v)}</div><div className="s">{linhas.length} contrato(s)</div></div>
        <div className="panel kpi"><div className="l">Lucro previsto</div><div className="v">{brl(tot.lp)}</div><div className="s">Margem {tot.vpl ? pct(tot.lp / tot.vpl) : "n/a"} sobre o VPL</div></div>
        <div className="panel kpi"><div className="l">Lucro já realizado</div><div className="v">{brl(tot.r)}</div><div className="s">Recebido menos pago até hoje</div></div>
      </div>
      <div className="panel mt"><div className="scroll"><table>
        <thead><tr><th>Contrato</th><th>Venda</th><th className="r">Valor</th><th className="r">Recebido</th><th className="r">Pago</th><th className="r">Lucro previsto</th><th className="r">Lucro realizado</th><th className="r">Margem prevista</th></tr></thead>
        <tbody>{linhas.map((l) => (
          <tr key={l.id}>
            <td><Link className="idc" href={`/contratos/${l.id}?aba=financeiro`}>#{l.codigo}</Link> {l.cliente?.nome}</td>
            <td className="num">{data(l.data_venda)}</td>
            <td className="r num">{brl(l.valor_total)}</td><td className="r num" style={{ color: "var(--good)" }}>{brl(l.rec)}</td>
            <td className="r num" style={{ color: "var(--bad)" }}>{brl(l.sai)}</td><td className="r num">{brl(l.lucro_previsto)}</td>
            <td className="r num"><b>{brl(l.real)}</b></td><td className="r num">{Number(l.vpl) ? pct(Number(l.lucro_previsto) / Number(l.vpl)) : "n/a"}</td>
          </tr>))}
          {!linhas.length && <tr><td colSpan={8} className="note">Nenhum contrato ainda.</td></tr>}
        </tbody>
      </table></div></div>
    </>);
  }

  if (aba === "comissoes") {
    const [{ data: cfg }, { data: membros }, { data: rtLanc }] = await Promise.all([
      sb.from("configuracoes").select("faixas_comissao").eq("empresa_id", eid).single(),
      sb.from("membros").select("user_id, nome").eq("empresa_id", eid),
      sb.from("lancamentos").select("contrato_id, valor, realizado").eq("empresa_id", eid).eq("categoria", "comissao_rt"),
    ]);
    const faixas = ((cfg?.faixas_comissao ?? []) as { nome: string; a_partir_de: number; pct: number }[]).sort((a, b) => a.a_partir_de - b.a_partir_de);
    const faixaDe = (v: number) => faixas.filter((f) => v >= f.a_partir_de).pop() ?? { nome: "n/a", pct: 0, a_partir_de: 0 };
    const doMes = K.filter((k) => k.data_venda >= p.inicio && k.data_venda < p.fim);
    const porVend = new Map<string, { vpl: number; n: number }>();
    doMes.forEach((k) => { const x = porVend.get(k.vendedor_id) ?? { vpl: 0, n: 0 }; x.vpl += Number(k.vpl); x.n++; porVend.set(k.vendedor_id, x); });
    const rts = doMes.filter((k) => k.parceiro_id).map((k) => {
      const l = (rtLanc ?? []).find((x) => x.contrato_id === k.id);
      return { k, valor: l ? -Number(l.valor) : 0, pago: !!l?.realizado };
    });
    corpo = (<>
      <div className="panel">
        <h2>Equipe · comissão sobre o VPL de {p.nome}</h2>
        <div className="scroll"><table>
          <thead><tr><th>Vendedor</th><th className="r">Contratos</th><th className="r">VPL vendido</th><th>Faixa</th><th className="r">Percentual</th><th className="r">Comissão</th></tr></thead>
          <tbody>{[...porVend.entries()].sort((a, b) => b[1].vpl - a[1].vpl).map(([id, x]) => { const f = faixaDe(x.vpl); return (
            <tr key={id}><td><b>{nomeMembro(membros, id)}</b></td><td className="r num">{x.n}</td><td className="r num">{brl(x.vpl)}</td>
              <td><span className={"pill " + (f.nome === "Ouro" ? "p-warn" : f.nome === "Prata" ? "p-info" : "p-neu")}>{f.nome}</span></td>
              <td className="r num">{String(f.pct).replace(".", ",")}%</td><td className="r num"><b>{brl(x.vpl * f.pct / 100)}</b></td></tr>); })}
            {!porVend.size && <tr><td colSpan={6} className="note">Nenhuma venda neste mês.</td></tr>}
          </tbody>
        </table></div>
        <p className="note" style={{ marginBottom: 0 }}>Faixas: {faixas.map((f) => `${f.nome} a partir de ${brl(f.a_partir_de)} (${String(f.pct).replace(".", ",")}%)`).join(" · ")}. O VPL já desconta taxa de cartão e RT, então a comissão sai do lucro real da venda.</p>
      </div>
      <div className="panel mt">
        <h2>Parceiros e arquitetos (RT)</h2>
        <div className="scroll"><table>
          <thead><tr><th>Parceiro</th><th>Contrato</th><th className="r">Percentual</th><th className="r">Valor RT</th><th>Situação</th></tr></thead>
          <tbody>{rts.map(({ k, valor, pago }) => (
            <tr key={k.id}><td><b>{k.parceiro?.nome}</b></td><td><Link className="idc" href={`/contratos/${k.id}?aba=financeiro`}>#{k.codigo}</Link> {k.cliente?.nome}</td>
              <td className="r num">{String(k.parceiro?.rt_pct ?? 0).replace(".", ",")}%</td><td className="r num">{brl(valor)}</td>
              <td>{pago ? <span className="pill p-good">Pago</span> : <span className="pill p-warn">A pagar</span>}</td></tr>))}
            {!rts.length && <tr><td colSpan={5} className="note">Nenhuma venda com parceiro neste mês.</td></tr>}
          </tbody>
        </table></div>
        <p className="note" style={{ marginBottom: 0 }}>Para marcar um RT como pago, use o Fluxo de caixa ou a aba Financeiro do contrato.</p>
      </div>
    </>);
  }

  if (aba === "fiscal") {
    const { data: notas } = await sb.from("notas_fiscais").select("*, contrato:contratos(codigo, cliente:clientes(nome))").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(300);
    const N = (notas ?? []) as any[];
    const semNota = K.filter((k) => !N.some((n) => n.contrato_id === k.id));
    corpo = (<>
      <div className="grid k3">
        <div className="panel kpi"><div className="l">Notas autorizadas</div><div className="v">{N.filter((n) => n.status === "autorizada").length}</div></div>
        <div className="panel kpi"><div className="l">Notas pendentes</div><div className="v" style={{ color: "var(--warn)" }}>{N.filter((n) => n.status === "pendente").length}</div></div>
        <div className="panel kpi"><div className="l">Contratos sem nota</div><div className="v" style={{ color: semNota.length ? "var(--bad)" : undefined }}>{semNota.length}</div></div>
      </div>
      <div className="panel mt">
        <div className="lock p-info" style={{ marginTop: 0, marginBottom: 12 }}>A emissão automática na prefeitura e na Sefaz precisa de um provedor fiscal (Focus NFe, PlugNotas ou eNotas) e do certificado digital da empresa. Até essa integração, registre aqui as notas emitidas no seu sistema atual para manter o controle por contrato.</div>
        <div className="scroll"><table>
          <thead><tr><th>Tipo</th><th>Número</th><th>Contrato</th><th className="r">Valor</th><th>Situação</th><th></th></tr></thead>
          <tbody>{N.map((n) => (
            <tr key={n.id}><td><span className="pill p-info">{n.tipo}</span></td><td className="num">{n.numero ?? "n/a"}</td>
              <td>{n.contrato ? <>#{n.contrato.codigo} {n.contrato.cliente?.nome}</> : <span className="note">sem contrato</span>}</td>
              <td className="r num">{brl(n.valor)}</td>
              <td><span className={"pill " + (n.status === "autorizada" ? "p-good" : n.status === "cancelada" ? "p-bad" : "p-warn")}>{n.status}</span></td>
              <td>{n.status === "pendente" && <form action={statusNota.bind(null, p.chave, n.id, "autorizada")}><button className="btn sm">Marcar autorizada</button></form>}</td></tr>))}
            {!N.length && <tr><td colSpan={6} className="note">Nenhuma nota registrada.</td></tr>}
          </tbody>
        </table></div>
        <h2 className="mt">Registrar nota</h2>
        <form action={novaNota.bind(null, p.chave)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 8, alignItems: "end" }}>
          <label>Contrato<select name="contrato_id" defaultValue={semNota[0]?.id ?? ""}><option value="">Sem contrato</option>{K.map((k) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
          <label>Tipo<select name="tipo"><option value="NF-e">NF-e (produto)</option><option value="NFS-e">NFS-e (montagem)</option></select></label>
          <label>Número<input name="numero" /></label>
          <label>Valor (R$)<input name="valor" inputMode="decimal" required /></label>
          <label>Situação<select name="status"><option value="autorizada">Autorizada</option><option value="pendente">Pendente</option></select></label>
          <button className="btn primary">Registrar</button>
        </form>
      </div>
    </>);
  }

  return (
    <>
      <div className="head">
        <div><h1>Financeiro</h1><p className="sub">{ctx.empresa.nome}{ctx.empresa.cnpj ? ` · CNPJ ${ctx.empresa.cnpj}` : ""}</p></div>
        {(aba === "fluxo" || aba === "comissoes") && <SeletorMes base="/financeiro" mes={p.chave} extra={`&aba=${aba}`} />}
      </div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16, overflowX: "auto" }}>
        {ABAS.map(([a, n]) => <Link key={a} href={`/financeiro?aba=${a}&mes=${p.chave}`} style={{ padding: "9px 14px", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", color: aba === a ? "var(--fg)" : "var(--muted)", borderBottom: "2px solid " + (aba === a ? "var(--gold)" : "transparent") }}>{n}</Link>)}
      </div>
      {corpo}
    </>
  );
}
