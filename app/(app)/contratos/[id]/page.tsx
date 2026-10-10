import Link from "next/link";
import { notFound } from "next/navigation";
import { contexto } from "@/lib/contexto";
import { brl, pct, data, diasAte, MARCOS, ETAPAS_WF, ASSINATURA } from "@/lib/formato";
import EnviarArquivo from "@/components/EnviarArquivo";
import { concluirMarco, avancarWorkflow, marcarAssinatura, marcarRealizado, novoLancamento, importarRevisao, abrirChamado } from "./actions";
import { hojeISO, dataHora, somaDias } from "@/lib/tempo";

const ABAS: [string, string][] = [["linha", "Linha do tempo"], ["financeiro", "Financeiro e DRE"], ["arquivos", "Arquivos e renders"], ["revisao", "Diff pós-medição"], ["assistencia", "Assistência"]];
const TIPO_ARQ: Record<string, string> = { planta: "Planta", promob: "Promob", projeto_imagem: "Imagem do projeto", foto_obra: "Foto da obra", foto_montagem: "Foto da montagem", contrato: "Contrato", render: "Render", documento: "Documento" };

export default async function Contrato({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ aba?: string; erro?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const ctx = await contexto();
  const verValores = ctx.papel !== "montador";
  // financeiro e diff de custo só para quem pode ver valores (financeiro: dono, gerente e financeiro)
  const abasPermitidas = ABAS.filter(([a]) => (a === "financeiro" ? ctx.financeiro : a === "revisao" ? verValores : true));
  const aba = abasPermitidas.some(([a]) => a === sp.aba) ? sp.aba! : "linha";
  const sb = ctx.supabase;
  const { data: c } = await sb.from("contratos").select("*, cliente:clientes(nome, telefone, endereco), campanha:campanhas(nome, investimento), parceiro:parceiros(nome)").eq("id", id).single();
  if (!c) notFound();
  const k = c as any;
  const etapaIdx = ETAPAS_WF.findIndex(([e]) => e === k.etapa_workflow);

  let corpo: React.ReactNode = null;

  if (aba === "linha") {
    const { data: marcos } = await sb.from("marcos").select("*").eq("contrato_id", id).order("ordem");
    corpo = (
      <div className="grid two">
        <div className="panel">
          <h2>Marcos e prazos</h2>
          {(marcos ?? []).map((m) => {
            const atual = m.tipo === k.marco_atual && !k.encerrado;
            const d = diasAte(m.previsto_em);
            return (
              <div key={m.id} className="tl">
                <span className={"c " + (m.concluido_em ? "ok" : atual ? "now" : "")} />
                <div><b>{MARCOS[m.tipo]}</b><div className="note">SLA {m.sla_dias} dias · previsto {data(m.previsto_em)}</div></div>
                <span className="note">{m.concluido_em ? `Concluído ${data(m.concluido_em)}` : atual ? (d < 0 ? <span className="pill p-bad">{-d} d de atraso</span> : <span className="pill p-warn">{d} d restantes</span>) : ""}</span>
              </div>
            );
          })}
          {!k.encerrado && <form action={concluirMarco.bind(null, id)} className="mt"><button className="btn primary">Concluir {MARCOS[k.marco_atual]}</button></form>}
          {k.encerrado && <div className="ok mt">Contrato concluído.</div>}
        </div>
        <div className="grid" style={{ alignContent: "start" }}>
          <div className="panel">
            <h2>Workflow industrial</h2>
            <b>{ETAPAS_WF[etapaIdx]?.[1]}</b>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginTop: 8 }}>
              {ETAPAS_WF.map(([e], i) => <i key={e} style={{ height: 6, borderRadius: 99, background: i < etapaIdx ? "var(--accent)" : i === etapaIdx ? "var(--gold)" : "var(--sunk)" }} />)}
            </div>
            {etapaIdx < 6 && <form action={avancarWorkflow.bind(null, id)} className="mt"><button className="btn sm">Avançar para {ETAPAS_WF[etapaIdx + 1][1]}</button></form>}
            <p className="note" style={{ marginBottom: 0 }}>Ao chegar em Expedição, o radar avança sozinho para Material na loja.</p>
          </div>
          <div className="panel">
            <h2>Assinatura</h2>
            <div className="row"><span>Empresa (ICP-Brasil)</span><span className={"pill " + (k.assinatura_empresa === "assinado" ? "p-good" : "p-warn")}>{ASSINATURA[k.assinatura_empresa]}</span></div>
            <div className="row"><span>Cliente (link de aceite)</span><span className={"pill " + (k.assinatura_cliente === "assinado" ? "p-good" : "p-warn")}>{ASSINATURA[k.assinatura_cliente]}</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {k.assinatura_empresa !== "assinado" && <form action={marcarAssinatura.bind(null, id, "empresa", "assinado")}><button className="btn sm">Marcar empresa assinada</button></form>}
              {k.assinatura_cliente === "pendente" && <form action={marcarAssinatura.bind(null, id, "cliente", "enviado")}><button className="btn sm">Marcar link enviado</button></form>}
              {k.assinatura_cliente !== "assinado" && <form action={marcarAssinatura.bind(null, id, "cliente", "assinado")}><button className="btn sm">Marcar cliente assinou</button></form>}
            </div>
            <p className="note" style={{ marginBottom: 0 }}>Integração com provedor de assinatura (ICP-Brasil) entra na próxima fase. Por enquanto o status é controlado aqui.</p>
          </div>
        </div>
      </div>
    );
  }

  if (aba === "financeiro") {
    const { data: lanc } = await sb.from("lancamentos").select("*").is("excluido_em", null).eq("contrato_id", id).order("data");
    const L = lanc ?? [];
    const rec = L.filter((l) => Number(l.valor) > 0 && l.realizado).reduce((s, l) => s + Number(l.valor), 0);
    const sai = -L.filter((l) => Number(l.valor) < 0 && l.realizado).reduce((s, l) => s + Number(l.valor), 0);
    const inv = Number(k.campanha?.investimento ?? 0);
    corpo = (
      <>
        <div className="grid k3">
          <div className="panel kpi"><div className="l">Recebido</div><div className="v" style={{ color: "var(--good)" }}>{brl(rec)}</div><div className="bar"><span style={{ width: `${Math.min(100, (rec / Number(k.valor_total)) * 100)}%`, background: "var(--good)" }} /></div><div className="s">{pct(rec / Number(k.valor_total))} de {brl(k.valor_total)}</div></div>
          <div className="panel kpi"><div className="l">Saídas pagas</div><div className="v" style={{ color: "var(--bad)" }}>{brl(sai)}</div><div className="s">Custo previsto {brl(k.custo_previsto)}</div></div>
          <div className="panel kpi"><div className="l">Lucro realizado até agora</div><div className="v">{brl(rec - sai)}</div><div className="s">Previsto no fechamento {brl(k.lucro_previsto)}</div></div>
        </div>
        {k.campanha && <p className="note mt">Origem do lead {k.campanha.nome}{inv > 0 ? ` · investimento da campanha ${brl(inv)}` : ""}</p>}
        <div className="panel mt">
          <h2>Lançamentos do contrato</h2>
          <div className="scroll"><table>
            <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="r">Valor</th><th>Situação</th></tr></thead>
            <tbody>{L.map((l) => (
              <tr key={l.id}>
                <td className="num">{data(l.data)}</td><td>{l.descricao}</td><td><span className="pill p-neu">{l.categoria}</span></td>
                <td className="r num" style={{ color: Number(l.valor) > 0 ? "var(--good)" : "var(--bad)" }}>{brl(l.valor)}</td>
                <td><form action={marcarRealizado.bind(null, id, l.id, !l.realizado)}><button className={"btn sm"}>{l.realizado ? "Realizado ✓" : "Marcar realizado"}</button></form></td>
              </tr>
            ))}</tbody>
          </table></div>
          <form action={novoLancamento.bind(null, id)} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, alignItems: "end", marginTop: 12 }}>
            <label>Data<input name="data" type="date" required defaultValue={hojeISO()} /></label>
            <label>Descrição<input name="descricao" required /></label>
            <label>Tipo<select name="tipo"><option value="saida">Saída</option><option value="entrada">Entrada</option></select></label>
            <label>Categoria<select name="categoria">{["fabrica", "frete", "montagem", "comissao_rt", "comissao_loja", "imposto", "taxa", "recebimento", "outros"].map((c) => <option key={c}>{c}</option>)}</select></label>
            <label>Valor (R$)<input name="valor" inputMode="decimal" required /></label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><input type="checkbox" name="realizado" /> Já realizado</label>
            <button className="btn">Adicionar lançamento</button>
          </form>
        </div>
      </>
    );
  }

  if (aba === "arquivos") {
    const [{ data: arqs }, { data: renders }] = await Promise.all([
      sb.from("arquivos").select("*").eq("contrato_id", id).order("created_at", { ascending: false }),
      sb.from("renders").select("id, status, ambiente, resultado_arquivo_id").eq("contrato_id", id),
    ]);
    const caminhos = (arqs ?? []).map((a) => a.storage_path);
    const { data: urls } = caminhos.length ? await sb.storage.from("arquivos").createSignedUrls(caminhos, 3600) : { data: [] as any[] };
    const url = (p: string) => (urls ?? []).find((u: any) => u.path === p)?.signedUrl;
    corpo = (
      <div className="panel">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <EnviarArquivo empresaId={ctx.empresa.id} contratoId={id} tipo="planta" accept=".pdf,image/*" rotulo="Enviar planta" />
          <EnviarArquivo empresaId={ctx.empresa.id} contratoId={id} tipo="foto_obra" accept="image/*" rotulo="Enviar fotos da obra" />
          <EnviarArquivo empresaId={ctx.empresa.id} contratoId={id} tipo="documento" rotulo="Enviar documento" />
          <Link className="btn sm primary" href={`/render?contrato=${id}`}>Gerar render</Link>
        </div>
        <div className="galeria">
          {(arqs ?? []).filter((a) => a.mime?.startsWith("image/")).map((a) => (
            <a key={a.id} href={url(a.storage_path)} target="_blank" rel="noopener" style={{ textDecoration: "none", color: "var(--fg)" }}>
              <img src={url(a.storage_path)} alt={a.nome} /><div className="note">{TIPO_ARQ[a.tipo]} · {a.nome}</div>
            </a>
          ))}
        </div>
        <div className="scroll mt"><table>
          <thead><tr><th>Arquivo</th><th>Tipo</th><th>Enviado</th></tr></thead>
          <tbody>{(arqs ?? []).map((a) => <tr key={a.id}><td><a href={url(a.storage_path)} target="_blank" rel="noopener">{a.nome}</a></td><td><span className="pill p-neu">{TIPO_ARQ[a.tipo]}</span></td><td className="note">{data(a.created_at)}</td></tr>)}
            {!arqs?.length && <tr><td colSpan={3} className="note">Nenhum arquivo ainda.</td></tr>}</tbody>
        </table></div>
        {!!renders?.length && <p className="note">{renders.length} render(s) ligados a este contrato.</p>}
      </div>
    );
  }

  if (aba === "revisao") {
    const { data: ambs } = await sb.from("ambientes").select("id, versao, nome, custo_fabrica, pecas(descricao, codigo, quantidade, custo_unitario)").eq("orcamento_id", k.orcamento_id).in("versao", [1, 2]);
    const v1 = (ambs ?? []).filter((a) => a.versao === 1), v2 = (ambs ?? []).filter((a) => a.versao === 2);
    const chave = (amb: string, p: any) => `${amb}|${p.codigo || p.descricao}`;
    const mapa = new Map<string, { amb: string; desc: string; q1: number; c1: number; q2: number; c2: number }>();
    v1.forEach((a: any) => a.pecas.forEach((p: any) => mapa.set(chave(a.nome, p), { amb: a.nome, desc: p.descricao, q1: Number(p.quantidade), c1: Number(p.custo_unitario), q2: 0, c2: 0 })));
    v2.forEach((a: any) => a.pecas.forEach((p: any) => {
      const x = mapa.get(chave(a.nome, p)) ?? { amb: a.nome, desc: p.descricao, q1: 0, c1: 0, q2: 0, c2: 0 };
      x.q2 = Number(p.quantidade); x.c2 = Number(p.custo_unitario); mapa.set(chave(a.nome, p), x);
    }));
    const linhas = [...mapa.values()].map((x) => ({ ...x, t1: x.q1 * x.c1, t2: x.q2 * x.c2 })).filter((x) => Math.abs(x.t2 - x.t1) > 0.004 || x.q1 !== x.q2);
    const tot1 = v1.reduce((s, a) => s + Number(a.custo_fabrica), 0), tot2 = v2.reduce((s, a) => s + Number(a.custo_fabrica), 0);
    corpo = (
      <div className="panel">
        <h2>Projeto vendido contra revisado pós-medição</h2>
        <form action={importarRevisao.bind(null, id)} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="file" name="arquivo" accept=".xml,.txt" required />
          <button className="btn sm primary">Importar Promob revisado</button>
          <span className="note">Substitui a revisão anterior, se houver.</span>
        </form>
        {!v2.length ? <p className="note mt">Ainda não há revisão importada. Depois da medição, exporte o projeto revisado do Promob e importe aqui.</p> : (<>
          <div className="grid k3 mt">
            <div className="panel kpi"><div className="l">Custo vendido (v1)</div><div className="v">{brl(tot1)}</div></div>
            <div className="panel kpi"><div className="l">Custo revisado (v2)</div><div className="v">{brl(tot2)}</div></div>
            <div className="panel kpi"><div className="l">Variação</div><div className="v" style={{ color: tot2 > tot1 ? "var(--bad)" : "var(--good)" }}>{tot2 >= tot1 ? "+" : ""}{brl(tot2 - tot1)}</div><div className="s">Impacto direto no lucro previsto de {brl(k.lucro_previsto)}</div></div>
          </div>
          <div className="scroll mt"><table>
            <thead><tr><th>Ambiente</th><th>Peça</th><th className="r">Qtd v1</th><th className="r">Qtd v2</th><th className="r">Custo v1</th><th className="r">Custo v2</th><th className="r">Diferença</th></tr></thead>
            <tbody>{linhas.map((x, i) => (
              <tr key={i} style={{ background: x.q1 === 0 ? "var(--good-soft)" : x.q2 === 0 ? "var(--bad-soft)" : "var(--warn-soft)" }}>
                <td>{x.amb}</td><td>{x.desc} {x.q1 === 0 ? <span className="pill p-good">nova</span> : x.q2 === 0 ? <span className="pill p-bad">removida</span> : null}</td>
                <td className="r num">{x.q1}</td><td className="r num">{x.q2}</td><td className="r num">{brl(x.t1)}</td><td className="r num">{brl(x.t2)}</td>
                <td className="r num" style={{ color: x.t2 > x.t1 ? "var(--bad)" : "var(--good)" }}>{x.t2 >= x.t1 ? "+" : ""}{brl(x.t2 - x.t1)}</td>
              </tr>
            ))}{!linhas.length && <tr><td colSpan={7} className="note">Nenhuma peça mudou entre as versões.</td></tr>}</tbody>
          </table></div>
        </>)}
      </div>
    );
  }

  if (aba === "assistencia") {
    const { data: ch } = await sb.from("chamados").select("*").eq("contrato_id", id).order("aberto_em", { ascending: false });
    corpo = (
      <div className="panel">
        <form action={abrirChamado.bind(null, id)} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input name="descricao" required placeholder="Descreva a ocorrência" style={{ flex: 1, minWidth: 220 }} />
          <button className="btn primary">Abrir chamado</button>
        </form>
        <div className="scroll"><table>
          <thead><tr><th>Aberto em</th><th>Ocorrência</th><th>Situação</th></tr></thead>
          <tbody>{(ch ?? []).map((x) => <tr key={x.id}><td className="num">{data(x.aberto_em)}</td><td>{x.descricao}</td><td><span className={"pill " + (x.status === "resolvido" ? "p-good" : "p-warn")}>{x.status}</span></td></tr>)}
            {!ch?.length && <tr><td colSpan={3} className="note">Nenhum chamado para este contrato.</td></tr>}</tbody>
        </table></div>
      </div>
    );
  }

  return (
    <>
      <div className="note" style={{ marginBottom: 6 }}>{verValores ? <Link href="/cadastros/clientes">Clientes</Link> : <Link href="/producao">Produção</Link>} / Contrato</div>
      <div className="head">
        <div><h1><span className="num">#{k.codigo}</span> · {k.cliente?.nome}</h1><p className="sub">{k.endereco_obra ?? "Endereço da obra não informado"}</p></div>
        <div style={{ display: "flex", gap: 8 }}>{k.orcamento_id && verValores && <Link className="btn" href={`/comercial/${k.orcamento_id}`}>Ver orçamento</Link>}</div>
      </div>
      {sp.erro && <div className="erro">{sp.erro}</div>}
      <div className="grid kpis" style={{ marginBottom: 16 }}>
        {verValores && <div className="panel kpi"><div className="l">Valor do contrato</div><div className="v">{brl(k.valor_total)}</div><div className="s">{k.parcelas}x · {k.forma_pagamento}</div></div>}
        {ctx.financeiro && <div className="panel kpi"><div className="l">Lucro previsto</div><div className="v">{brl(k.lucro_previsto)}</div><div className="s">Margem {pct(Number(k.lucro_previsto) / Number(k.vpl))} sobre VPL {brl(k.vpl)}</div></div>}
        <div className="panel kpi"><div className="l">Marco atual</div><div className="v" style={{ fontSize: 17 }}>{k.encerrado ? "Concluído" : MARCOS[k.marco_atual]}</div><div className="s">Venda em {data(k.data_venda)}</div></div>
        <div className="panel kpi"><div className="l">Origem e parceiro</div><div className="v" style={{ fontSize: 15, fontFamily: "var(--f-body)" }}>{k.campanha?.nome ?? "Sem origem"}</div><div className="s">{k.parceiro ? `RT ${k.parceiro.nome}` : "Sem parceiro"}</div></div>
      </div>
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--line)", marginBottom: 16, overflowX: "auto" }}>
        {abasPermitidas.map(([a, n]) => <Link key={a} href={`/contratos/${id}?aba=${a}`} style={{ padding: "9px 14px", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap", color: aba === a ? "var(--fg)" : "var(--muted)", borderBottom: "2px solid " + (aba === a ? "var(--gold)" : "transparent") }}>{n}</Link>)}
      </div>
      {corpo}
    </>
  );
}
