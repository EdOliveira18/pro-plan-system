"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { calcularOlhinho, type Config, type Condicoes } from "@/lib/olhinho";
import { brl, pct, dec, lerValor } from "@/lib/formato";
import { salvarCondicoes, salvarAmbiente, adicionarAmbiente, removerAmbiente, importarArquivoProjeto, aplicarValorVendido, fecharContrato } from "./actions";

type Amb = { id: string; nome: string; descricao: string | null; prazo_dias: number | null; custo_fabrica: number; pontuacao: number; origem: string };
const LADO_MAX = 2048;
const ACEITOS = ".xml,.txt,.csv,.tsv,.pdf,.png,.jpg,.jpeg,.webp,text/xml,text/plain,text/csv,application/pdf,image/*";

// Imagem reduzida para no máximo 2048px em JPEG, para caber no envio e na leitura da IA
async function canvasParaJpeg(desenhar: (c: CanvasRenderingContext2D, w: number, h: number) => Promise<void> | void, w0: number, h0: number): Promise<Blob> {
  const esc = Math.min(1, LADO_MAX / Math.max(w0, h0));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w0 * esc); canvas.height = Math.round(h0 * esc);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff"; c.fillRect(0, 0, canvas.width, canvas.height);
  await desenhar(c, canvas.width, canvas.height);
  return new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.85));
}
async function imagemReduzida(f: File): Promise<Blob> {
  const bmp = await createImageBitmap(f);
  return canvasParaJpeg((c, w, h) => c.drawImage(bmp, 0, 0, w, h), bmp.width, bmp.height);
}
// PDF: extrai o texto de todas as páginas; se for escaneado (sem texto), manda a 1ª página como imagem
async function lerPdf(f: File): Promise<{ texto: string; imagem?: Blob }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await f.arrayBuffer() }).promise;
  let texto = "";
  for (let i = 1; i <= Math.min(doc.numPages, 40); i++) {
    const pg = await doc.getPage(i);
    const tc = await pg.getTextContent();
    texto += `\n--- página ${i} ---\n` + tc.items.map((it: any) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : "")).join("");
  }
  if (texto.replace(/[\s\-página\d]/g, "").length > 40) return { texto };
  const pg = await doc.getPage(1);
  const vp1 = pg.getViewport({ scale: 1 });
  const escala = LADO_MAX / Math.max(vp1.width, vp1.height);
  const vp = pg.getViewport({ scale: escala });
  const imagem = await canvasParaJpeg(async (c) => { await pg.render({ canvasContext: c, viewport: vp }).promise; }, vp.width, vp.height);
  return { texto: "", imagem };
}

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

  const [lendo, setLendo] = useState(false);
  const [vendido, setVendido] = useState("");
  async function importar(f: File | undefined) {
    if (!f) return;
    const fd = new FormData();
    setMsg(null);
    setLendo(true);
    try {
      const nome = f.name.toLowerCase();
      if (f.type === "application/pdf" || nome.endsWith(".pdf")) {
        const { texto, imagem } = await lerPdf(f);
        if (texto) fd.set("texto", texto);
        if (imagem) fd.set("imagem", imagem, "pagina1.jpg");
      } else if (f.type.startsWith("image/")) {
        fd.set("imagem", await imagemReduzida(f), "imagem.jpg");
      }
      // o original segue junto para ficar salvo no orçamento, se couber no envio
      fd.set("arquivo", f.size < 3_500_000 || !(fd.has("texto") || fd.has("imagem")) ? f : new File([], f.name, { type: f.type }));
    } catch {
      setLendo(false);
      return setMsg({ t: "erro", m: "Não consegui abrir esse arquivo no navegador. Tente exportar de novo ou mandar em PDF." });
    }
    start(async () => {
      const res = await importarArquivoProjeto(p.orcamentoId, fd);
      setLendo(false);
      setMsg(res.ok ? { t: "ok", m: `${res.qtd} ambiente(s) importados de ${f.name}.${res.aviso ? " " + res.aviso : ""}` } : { t: "erro", m: res.erro });
      router.refresh();
    });
  }
  function aplicarVendido() {
    const v = lerValor(vendido);
    if (!(v > 0)) return setMsg({ t: "erro", m: "Informe o valor vendido do projeto." });
    start(async () => {
      const res = await aplicarValorVendido(p.orcamentoId, v);
      aviso(res, `Valor vendido de ${brl(v)} aplicado. A pontuação de cada ambiente foi ajustada.`);
      if (res.ok) { setVendido(""); router.refresh(); }
    });
  }
  // valor de venda de um ambiente: vira pontuação = venda / custo
  function mudarVenda(a: Amb, texto: string) {
    const v = lerValor(texto);
    if (!(v > 0) || !(a.custo_fabrica > 0)) return;
    const pts = Math.round((v / a.custo_fabrica) * 1e6) / 1e6;
    mudarPts(a.id, pts);
    salvarAmbiente(p.orcamentoId, a.id, { pontuacao: pts });
  }
  function mudarCusto(a: Amb, texto: string) {
    const c = lerValor(texto);
    if (!(c >= 0) || c === a.custo_fabrica) return;
    setAmbs((l) => l.map((x) => (x.id === a.id ? { ...x, custo_fabrica: c } : x)));
    salvarAmbiente(p.orcamentoId, a.id, { custo_fabrica: c });
  }
  async function addManual(form: HTMLFormElement) {
    const fd = new FormData(form);
    const nome = String(fd.get("nome") ?? "").trim(), custo = lerValor(fd.get("custo")), venda = lerValor(fd.get("venda"));
    if (!nome) return setMsg({ t: "erro", m: "Informe o nome do ambiente." });
    if (!(custo > 0)) return setMsg({ t: "erro", m: "Informe o custo de fábrica do ambiente (ex.: 20.000,00)." });
    start(async () => {
      const res = await adicionarAmbiente(p.orcamentoId, { nome, custo_fabrica: custo, prazo_dias: Number(fd.get("prazo")) || 45, valor_venda: venda || undefined });
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
              <b style={{ color: "var(--fg)" }}>Importar orçamento ou projeto</b>
              <span className="note">PDF, foto ou print, planilha CSV, ou XML/TXT do Promob. Cada ambiente vira uma linha com custo e valor de venda; no XML do Promob as peças ficam salvas para o diff pós-medição.</span>
              <span className="btn">{lendo || pend ? "Lendo arquivo…" : "Escolher arquivo"}</span>
              <input type="file" accept={ACEITOS} hidden disabled={lendo || pend} onChange={(e) => { importar(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
          )}
          {ambs.length > 0 && (
            <div className="scroll mt"><table>
              <thead><tr><th>Ambiente</th><th className="r">Prazo</th><th className="r">Custo fábrica</th><th className="r">Pontuação</th><th className="r">Valor de venda</th><th></th></tr></thead>
              <tbody>{ambs.map((a) => (
                <tr key={a.id}>
                  <td><b>{a.nome}</b> {a.origem === "promob" && <span className="pill p-info">Promob</span>}{a.origem === "ia" && <span className="pill p-info">IA</span>}<div className="note">{a.descricao}</div></td>
                  <td className="r num">{a.prazo_dias ?? "n/a"} d</td>
                  <td className="r">{bloqueado ? <span className="num">{brl(a.custo_fabrica)}</span> :
                    <input key={`c${a.id}${a.custo_fabrica}`} className="num" inputMode="decimal" defaultValue={dec(a.custo_fabrica)} style={{ width: 120, textAlign: "right", color: a.custo_fabrica > 0 ? undefined : "var(--bad)" }}
                      onBlur={(e) => mudarCusto(a, e.target.value)} aria-label={`Custo de fábrica de ${a.nome}`} />}</td>
                  <td className="r"><input className="pts num" type="number" step="0.05" min="1" value={Math.round(a.pontuacao * 1000) / 1000} disabled={bloqueado}
                    style={{ color: a.pontuacao < p.cfg.pontuacao_minima ? "var(--bad)" : undefined }}
                    onChange={(e) => mudarPts(a.id, Number(e.target.value))}
                    onBlur={(e) => salvarAmbiente(p.orcamentoId, a.id, { pontuacao: Number(e.target.value) })} aria-label={`Pontuação de ${a.nome}`} /></td>
                  <td className="r">{bloqueado || !(a.custo_fabrica > 0) ? <b className="num">{brl(a.custo_fabrica * a.pontuacao)}</b> :
                    <input key={`v${a.id}${a.pontuacao}`} className="num" inputMode="decimal" defaultValue={dec(a.custo_fabrica * a.pontuacao)} style={{ width: 130, textAlign: "right", fontWeight: 600 }}
                      onBlur={(e) => mudarVenda(a, e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-label={`Valor de venda de ${a.nome}`} />}</td>
                  <td>{!bloqueado && <button className="btn sm" aria-label="Remover ambiente" onClick={() => start(async () => { aviso(await removerAmbiente(p.orcamentoId, a.id)); router.refresh(); })}>×</button>}</td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
          {!bloqueado && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ cursor: "pointer", color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>Adicionar ambiente manualmente</summary>
              <form onSubmit={(e) => { e.preventDefault(); addManual(e.currentTarget); }} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8, alignItems: "end", marginTop: 8 }}>
                <label>Ambiente<input name="nome" placeholder="Ex.: Lavanderia" /></label>
                <label>Custo fábrica (R$)<input name="custo" inputMode="decimal" placeholder="20.000,00" /></label>
                <label>Valor vendido (R$)<input name="venda" inputMode="decimal" placeholder="Opcional" /></label>
                <label>Prazo (dias)<input name="prazo" type="number" defaultValue={45} /></label>
                <button className="btn" disabled={pend}>Adicionar</button>
              </form>
            </details>
          )}
          {!bloqueado && ambs.some((a) => a.custo_fabrica > 0) && (
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap", marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line, rgba(127,127,127,.2))" }}>
              <label style={{ flex: "1 1 220px" }}>Valor vendido do projeto (R$)
                <input inputMode="decimal" placeholder={dec(r.valorProposta)} value={vendido} onChange={(e) => setVendido(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") aplicarVendido(); }} />
              </label>
              <button className="btn" disabled={pend || !vendido} onClick={aplicarVendido}>Aplicar valor vendido</button>
              <span className="note" style={{ flexBasis: "100%" }}>Fecha a proposta exatamente nesse valor (já com o desconto) e distribui entre os ambientes pelo custo de cada um.</span>
            </div>
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
