"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcularOlhinho, type Config, type Condicoes } from "@/lib/olhinho";
import { brl, pct, dec } from "@/lib/formato";
import { salvarCondicoes, salvarAmbiente, adicionarAmbiente, removerAmbiente, importarPromob, fecharContrato } from "./actions";

type Amb = { id: string; nome: string; descricao: string | null; prazo_dias: number | null; custo_fabrica: number; pontuacao: number; origem: string };
const CORES: Record<string, string> = { fabrica: "var(--gold)", frete: "var(--accent)", comissao_loja: "var(--warn)", montagem: "var(--good)", impostos: "var(--bad)", outros: "var(--muted)" };

export default function Editor(p: {
  orcamentoId: string; fechado: boolean; gestor: boolean; enderecoPadrao: string; nomeParceiro: string | null;
  cfg: Config; inicialAmbientes: Amb[]; inicialCond: Condicoes;
}) {
  const router = useRouter();
  const [ambs, setAmbs] = useState<Amb[]>(p.inicialAmbientes);
  const [cond, setCond] = useState<Condicoes>(p.inicialCond);
  const [msg, setMsg] = useState<{ t: "erro" | "ok"; m: string } | null>(null);
  const [pend, start] = useTransition();
  const [endereco, setEndereco] = useState(p.enderecoPadrao);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const r = useMemo(() => calcularOlhinho(ambs, cond, p.cfg), [ambs, cond, p.cfg]);
  const bloqueado = p.fechado;

  const mudarCond = (c: Partial<Condicoes>) => {
    const novo = { ...cond, ...c };
    setCond(novo);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => salvarCondicoes(p.orcamentoId, novo), 500);
  };
  const mudarPts = (id: string, v: number) => setAmbs((a) => a.map((x) => (x.id === id ? { ...x, pontuacao: v } : x)));
  const aviso = (res: { ok: boolean; erro?: string }, ok?: string) => setMsg(res.ok ? (ok ? { t: "ok", m: ok } : null) : { t: "erro", m: res.erro! });

  async function importar(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    fd.set("arquivo", f);
    start(async () => {
      const res = await importarPromob(p.orcamentoId, fd);
      aviso(res as any, res.ok ? `${(res as any).qtd} ambiente(s) importados de ${f.name}` : undefined);
      router.refresh();
    });
  }
  async function addManual(form: HTMLFormElement) {
    const fd = new FormData(form);
    const nome = String(fd.get("nome")).trim(), custo = Number(String(fd.get("custo")).replace(",", "."));
    if (!nome || !(custo > 0)) return setMsg({ t: "erro", m: "Informe nome e custo de fábrica do ambiente." });
    start(async () => {
      const res = await adicionarAmbiente(p.orcamentoId, { nome, custo_fabrica: custo, prazo_dias: Number(fd.get("prazo")) || 45 });
      aviso(res);
      if (res.ok) { form.reset(); router.refresh(); }
    });
  }
  function fechar(liberar: boolean) {
    start(async () => {
      const res = await fecharContrato(p.orcamentoId, endereco, liberar);
      if (res.ok && res.id) router.push(`/contratos/${res.id}`);
      else aviso(res);
    });
  }

  // sincroniza ambientes vindos do servidor depois de importar/adicionar
  const idsServidor = p.inicialAmbientes.map((a) => a.id).join();
  const idsLocal = useRef(idsServidor);
  if (idsLocal.current !== idsServidor) { idsLocal.current = idsServidor; setAmbs(p.inicialAmbientes); }

  const R = 34, L = 2 * Math.PI * R, m = Math.max(0, Math.min(1, r.margem));
  return (
    <div className="wiz">
      <div className="grid" style={{ gap: 16 }}>
        {msg && <div className={msg.t}>{msg.m}</div>}
        {bloqueado && <div className="ok">Este orçamento já virou contrato. Os valores ficaram congelados.</div>}

        <div className="panel">
          <h2>Ambientes do projeto</h2>
          {!bloqueado && (
            <label className="drop" style={{ cursor: "pointer" }}>
              <b style={{ color: "var(--fg)" }}>Importar XML ou TXT exportado do Promob</b>
              <span className="note">Cada ambiente vira uma linha com custo de fábrica, e as peças ficam salvas para o diff pós-medição.</span>
              <span className="btn">{pend ? "Processando…" : "Escolher arquivo"}</span>
              <input type="file" accept=".xml,.txt,text/xml,text/plain" hidden onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          {ambs.length > 0 && (
            <div className="scroll mt"><table>
              <thead><tr><th>Ambiente</th><th className="r">Prazo</th><th className="r">Custo fábrica</th><th className="r">Pontuação</th><th className="r">Preço sugerido</th><th></th></tr></thead>
              <tbody>{ambs.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.nome}</b> {a.origem === "promob" && <span className="pill p-info">Promob</span>}<div className="note">{a.descricao}</div></td>
                  <td className="r num">{a.prazo_dias ?? "n/a"} d</td>
                  <td className="r num">{brl(a.custo_fabrica)}</td>
                  <td className="r"><input className="pts num" type="number" step="0.05" min="1" value={a.pontuacao} disabled={bloqueado}
                    style={{ color: a.pontuacao < p.cfg.pontuacao_minima ? "var(--bad)" : undefined }}
                    onChange={(e) => mudarPts(a.id, Number(e.target.value))}
                    onBlur={(e) => salvarAmbiente(p.orcamentoId, a.id, { pontuacao: Number(e.target.value) })} aria-label={`Pontuação de ${a.nome}`} /></td>
                  <td className="r num"><b>{brl(a.custo_fabrica * a.pontuacao)}</b></td>
                  <td>{!bloqueado && <button className="btn sm" aria-label="Remover ambiente" onClick={() => start(async () => { aviso(await removerAmbiente(p.orcamentoId, a.id)); router.refresh(); })}>×</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {!bloqueado && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>Adicionar ambiente manualmente</summary>
              <form onSubmit={(e) => { e.preventDefault(); addManual(e.currentTarget); }} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, alignItems: "end", marginTop: 8 }}>
                <label>Ambiente<input name="nome" placeholder="Ex.: Lavanderia" /></label>
                <label>Custo fábrica (R$)<input name="custo" inputMode="decimal" /></label>
                <label>Prazo (dias)<input name="prazo" type="number" defaultValue={45} /></label>
                <button className="btn">Adicionar</button>
              </form>
            </details>
          )}
        </div>

        <div className="panel">
          <h2>Condições de pagamento</h2>
          <div className="form">
            <label>Desconto sobre a tabela (%)<input type="number" min={0} max={50} step={0.5} value={cond.desconto_pct} disabled={bloqueado} onChange={(e) => mudarCond({ desconto_pct: Number(e.target.value) })} /></label>
            <label>Forma de pagamento<select value={cond.forma_pagamento} disabled={bloqueado} onChange={(e) => mudarCond({ forma_pagamento: e.target.value as Condicoes["forma_pagamento"] })}>
              <option value="avista">À vista (Pix)</option><option value="boleto">Boleto parcelado</option><option value="cartao">Cartão sem juros para o cliente</option></select></label>
            <label>Parcelas<input type="number" min={1} max={24} value={cond.parcelas} disabled={bloqueado || cond.forma_pagamento === "avista"} onChange={(e) => mudarCond({ parcelas: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <label>RT do parceiro (%)<input type="number" min={0} step={0.5} value={cond.rt_pct} disabled={bloqueado} onChange={(e) => mudarCond({ rt_pct: Number(e.target.value) })} /></label>
            <label style={{ gridColumn: "1 / -1" }}>Endereço da obra<input value={endereco} disabled={bloqueado} onChange={(e) => setEndereco(e.target.value)} /></label>
          </div>
          {!bloqueado && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              <button className="btn primary" disabled={pend || !ambs.length || r.travado} onClick={() => fechar(false)}>Gerar contrato</button>
              {r.travado && p.gestor && <button className="btn" disabled={pend} onClick={() => fechar(true)}>Liberar abaixo do mínimo e gerar contrato</button>}
            </div>
          )}
        </div>
      </div>

      <div className="panel eye">
        <h2>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>
          Olhinho <span className="note">ao vivo</span>
        </h2>
        {!ambs.length ? <p className="note">Importe o Promob ou adicione ambientes para ver VPL, custos e margem.</p> : (<>
          <div className="row"><span>Valor da proposta</span><span className="num">{brl(r.valorProposta)}</span></div>
          <div className="row minus"><span>{cond.forma_pagamento === "cartao" ? `Taxa do cartão (${cond.parcelas}x · ${dec(r.taxaPagamentoPct, 1)}%)` : cond.forma_pagamento === "boleto" ? "Custo do boleto" : "Taxa"}</span><span className="num">−{brl(r.taxaPagamento)}</span></div>
          <div className="row minus"><span>Parceiro {p.nomeParceiro ?? ""} ({dec(cond.rt_pct, 1)}%)</span><span className="num">−{brl(r.valorRT)}</span></div>
          <div className="row big"><span>VPL</span><span className="num">{brl(r.vpl)}</span></div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "12px 0" }}>
            <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden="true">
              <circle cx="42" cy="42" r={R} fill="none" stroke="var(--sunk)" strokeWidth="9" />
              <circle cx="42" cy="42" r={R} fill="none" stroke={r.margem < 0.35 ? "var(--bad)" : "var(--good)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={`${L * m} ${L}`} transform="rotate(-90 42 42)" />
              <text x="42" y="46" textAnchor="middle" fontSize="14" fontWeight="600" fill="var(--fg)" fontFamily="JetBrains Mono, monospace">{pct(r.margem)}</text>
            </svg>
            <div><div className="note">Lucro estimado</div><div className={"lucro" + (r.lucro < 0 ? " neg" : "")}>{brl(r.lucro)}</div><div className="note">Markup {dec(r.markup)}x · pontuação média {dec(r.pontuacaoMedia)}</div></div>
          </div>
          {r.custos.map((c) => <div key={c.chave} className="row"><span><i className="dot" style={{ background: CORES[c.chave] }} />{c.nome}</span><span className="num">{brl(c.valor)}</span></div>)}
          <div className="row big"><span>Total de custos</span><span className="num">{brl(r.custoTotal)}</span></div>
          <div className={"lock " + (r.travado ? "p-bad" : "p-good")}>
            {r.travado ? `Travado. Pontuação média ${dec(r.pontuacaoMedia)} abaixo do mínimo ${dec(p.cfg.pontuacao_minima)}. ${p.gestor ? "Você pode liberar como gestor." : "Peça liberação a um gerente."}` : "Liberado para fechar dentro da margem da loja."}
          </div>
        </>)}
      </div>
    </div>
  );
}
