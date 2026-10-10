import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, pct, data } from "@/lib/formato";
import { periodo, nomeMembro } from "@/lib/periodo";
import SeletorMes from "@/components/SeletorMes";
import { importarOFX, vincular, criarDaMovimentacao, ignorar, desfazer, reconciliar, sincronizarAgora } from "./banco-actions";
import ConectarBanco from "@/components/ConectarBanco";
import { sugerir } from "@/lib/banco/conciliar";

const ABAS: [string, string][] = [["fluxo", "Fluxo de caixa"], ["banco", "Banco e conciliação"], ["contratos", "DRE por contrato"], ["comissoes", "Comissões"], ["fiscal", "Fiscal"]];
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
  const { error } = await ctx.supabase.from("lancamentos").update({ realizado, pago_em: realizado ? new Date().toISOString().slice(0, 10) : null }).eq("id", id);
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

export default async function Financeiro({ searchParams }: { searchParams: Promise<{ aba?: string; mes?: string; erro?: string; msg?: string }> }) {
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
      sb.from("lancamentos").select("*, contrato:contratos(codigo)").is("excluido_em", null).eq("empresa_id", eid).gte("data", p.inicio).lt("data", p.fim).order("data"),
      sb.from("lancamentos").select("valor").is("excluido_em", null).eq("empresa_id", eid).eq("realizado", false).lt("data", hoje).gt("valor", 0),
      sb.from("lancamentos").select("valor").is("excluido_em", null).eq("empresa_id", eid).eq("realizado", true),
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

  if (aba === "banco") {
    const [{ data: contas }, { data: pend }, { data: conc }, { data: abertos }, { data: conexoes }] = await Promise.all([
      sb.from("contas_bancarias").select("*").eq("empresa_id", eid).order("created_at"),
      sb.from("extrato").select("*, conta:contas_bancarias(nome)").eq("empresa_id", eid).eq("status", "pendente").order("data", { ascending: false }).limit(200),
      sb.from("extrato").select("*, lancamento:lancamentos(descricao, categoria, contrato:contratos(codigo))").eq("empresa_id", eid).eq("status", "conciliado").order("data", { ascending: false }).limit(30),
      sb.from("lancamentos").select("id, data, valor, descricao, contrato:contratos(codigo)").is("excluido_em", null).eq("empresa_id", eid).eq("realizado", false),
      sb.from("conexoes_bancarias").select("*").eq("empresa_id", eid).neq("status", "DELETED").order("created_at"),
    ]);
    const openFinanceAtivo = !!process.env.PLUGGY_CLIENT_ID;
    const A = ((abertos ?? []) as any[]).map((l) => ({ ...l, valor: Number(l.valor) }));
    corpo = (<>
      <div className="grid two">
        <div className="panel">
          <h2>Importar extrato</h2>
          <p className="note" style={{ marginTop: -6 }}>No internet banking, procure Extrato e exporte em <b>OFX</b> (às vezes chamado de "Money" ou "Microsoft Money"). Pode importar o mesmo período de novo: o sistema ignora o que já entrou.</p>
          <form action={importarOFX} className="grid" style={{ gap: 10 }}>
            <input type="file" name="arquivo" accept=".ofx,.OFX,application/x-ofx" required aria-label="Arquivo OFX" />
            <input name="nome" placeholder="Nome da conta, só na primeira importação (ex.: Itaú PJ)" aria-label="Nome da conta" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}><button className="btn primary">Importar e conciliar</button></div>
          </form>
          <p className="note" style={{ marginBottom: 0 }}>A conciliação casa cada movimentação com o lançamento previsto de mesmo valor, com até 5 dias de diferença na data. Quando casa, o lançamento vira realizado sozinho.</p>
        </div>
        <div className="panel">
          <h2>Contas</h2>
          {(contas ?? []).map((c: any) => (
            <div key={c.id} className="row"><span><b>{c.nome}</b><br /><span className="note">Banco {c.banco} · ag. {c.agencia ?? "n/a"} · conta {c.conta} · via {c.origem.toUpperCase()}</span></span>
              <span style={{ textAlign: "right" }}><span className="num">{c.saldo !== null ? brl(c.saldo) : "n/a"}</span><br /><span className="note">{c.saldo_em ? "saldo em " + data(c.saldo_em) : ""}</span></span></div>
          ))}
          {!contas?.length && <p className="note">Nenhuma conta ainda. Ela é criada na primeira importação.</p>}
          <h2 className="mt">Open Finance <span className="note">CNPJ {ctx.empresa.cnpj ?? "não cadastrado"}</span></h2>
          {(conexoes ?? []).map((cx: any) => (
            <div key={cx.id} className="row" style={{ alignItems: "center" }}>
              <span><b>{cx.instituicao ?? "Banco"}</b><br /><span className="note">{cx.ultimo_sync ? "Sincronizado " + new Date(cx.ultimo_sync).toLocaleString("pt-BR") : "Aguardando primeira sincronização"}</span>
                {cx.erro && <><br /><span className="pill p-bad">{cx.erro}</span></>}</span>
              <span style={{ display: "flex", gap: 6 }}>
                <form action={sincronizarAgora.bind(null, cx.id)}><button className="btn sm">Atualizar agora</button></form>
                {cx.status && cx.status !== "UPDATED" && <ConectarBanco sandbox={process.env.PLUGGY_SANDBOX === "1"} itemId={cx.item_id} rotulo="Reconectar" />}
              </span>
            </div>
          ))}
          {openFinanceAtivo ? (
            <>
              <ConectarBanco sandbox={process.env.PLUGGY_SANDBOX === "1"} />
              <p className="note" style={{ marginBottom: 0 }}>A autorização é feita no app do próprio banco, com o login da conta PJ da empresa. Depois disso, cada movimentação nova chega sozinha e é conciliada automaticamente.</p>
            </>
          ) : <div className="lock p-info" style={{ marginBottom: 0 }}>O Open Finance está instalado e aguardando as credenciais da Pluggy no servidor. Enquanto isso, a importação de OFX funciona normalmente.</div>}
        </div>
      </div>

      <div className="panel mt">
        <h2>Aguardando classificação <span className="pill p-warn">{pend?.length ?? 0}</span>
          {!!pend?.length && <form action={reconciliar} style={{ marginLeft: "auto" }}><button className="btn sm">Tentar conciliar de novo</button></form>}</h2>
        {!pend?.length ? <p className="note" style={{ margin: 0 }}>Nada pendente. Tudo o que entrou no banco já está ligado a um lançamento.</p> : (
          <div className="scroll"><table>
            <thead><tr><th>Data</th><th>Movimentação</th><th className="r">Valor</th><th>Lançamento parecido</th><th>Ou criar lançamento</th><th></th></tr></thead>
            <tbody>{(pend as any[]).map((m) => {
              const sug = sugerir({ id: m.id, data: m.data, valor: Number(m.valor) }, A) as any[];
              return (
                <tr key={m.id}>
                  <td className="num">{data(m.data)}</td>
                  <td>{m.descricao}<div className="note">{m.conta?.nome}</div></td>
                  <td className="r num" style={{ color: Number(m.valor) > 0 ? "var(--good)" : "var(--bad)" }}>{brl(m.valor)}</td>
                  <td>{sug.length ? sug.map((s) => (
                    <form key={s.id} action={vincular.bind(null, m.id, s.id)} style={{ marginBottom: 4 }}>
                      <button className="btn sm" title={s.descricao}>{s.contrato ? `#${s.contrato.codigo} · ` : ""}{s.descricao.slice(0, 28)} · {brl(s.valor)} · {data(s.data)}</button>
                    </form>)) : <span className="note">nenhum</span>}</td>
                  <td>
                    <form action={criarDaMovimentacao.bind(null, m.id)} style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      <select name="categoria" defaultValue={Number(m.valor) > 0 ? "recebimento" : "outros"} aria-label="Categoria">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
                      <select name="contrato_id" defaultValue="" aria-label="Contrato"><option value="">Sem contrato</option>{K.map((k) => <option key={k.id} value={k.id}>#{k.codigo}</option>)}</select>
                      <button className="btn sm primary">Criar</button>
                    </form>
                  </td>
                  <td><form action={ignorar.bind(null, m.id)}><button className="btn sm">Ignorar</button></form></td>
                </tr>);
            })}</tbody>
          </table></div>
        )}
      </div>

      <div className="panel mt">
        <h2>Conciliadas recentemente</h2>
        <div className="scroll"><table>
          <thead><tr><th>Data</th><th>No banco</th><th>No sistema</th><th className="r">Valor</th><th></th></tr></thead>
          <tbody>{((conc ?? []) as any[]).map((m) => (
            <tr key={m.id}><td className="num">{data(m.data)}</td><td>{m.descricao}</td>
              <td>{m.lancamento?.contrato ? <span className="idc">#{m.lancamento.contrato.codigo} </span> : null}{m.lancamento?.descricao} <span className="pill p-neu">{m.lancamento?.categoria}</span></td>
              <td className="r num">{brl(m.valor)}</td>
              <td><form action={desfazer.bind(null, m.id)}><button className="btn sm">Desfazer</button></form></td></tr>))}
            {!conc?.length && <tr><td colSpan={5} className="note">Nenhuma ainda.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>);
  }

  if (aba === "contratos") {
    const { data: lanc } = await sb.from("lancamentos").select("contrato_id, valor, realizado").is("excluido_em", null).eq("empresa_id", eid).not("contrato_id", "is", null);
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
      sb.from("lancamentos").select("contrato_id, valor, realizado").is("excluido_em", null).eq("empresa_id", eid).eq("categoria", "comissao_rt"),
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
      {sp.msg && <div className="ok">{sp.msg}</div>}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16, overflowX: "auto" }}>
        {ABAS.map(([a, n]) => <Link key={a} href={`/financeiro?aba=${a}&mes=${p.chave}`} style={{ padding: "9px 14px", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", color: aba === a ? "var(--fg)" : "var(--muted)", borderBottom: "2px solid " + (aba === a ? "var(--gold)" : "transparent") }}>{n}</Link>)}
      </div>
      {corpo}
    </>
  );
}
