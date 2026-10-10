"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

const LADO_MAX = 2048;

// Converte uma página do PDF em PNG no navegador (a IA de imagem só aceita PNG, JPG ou WebP)
async function pdfParaPng(arquivo: File, pagina: number): Promise<{ blob: Blob; total: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data: await arquivo.arrayBuffer() }).promise;
  const p = await doc.getPage(Math.min(pagina, doc.numPages));
  const base = p.getViewport({ scale: 1 });
  const escala = LADO_MAX / Math.max(base.width, base.height);
  const vp = p.getViewport({ scale: escala });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(vp.width);
  canvas.height = Math.round(vp.height);
  const c2d = canvas.getContext("2d")!;
  c2d.fillStyle = "#fff";
  c2d.fillRect(0, 0, canvas.width, canvas.height);
  await p.render({ canvasContext: c2d, viewport: vp }).promise;
  const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/png"));
  return { blob, total: doc.numPages };
}

export default function NovoRender(p: { empresaId: string; contratos: { id: string; rotulo: string }[]; contratoInicial: string }) {
  const router = useRouter();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [imagem, setImagem] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [paginas, setPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [estado, setEstado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function preparar(f: File, pg = 1) {
    setErro(null);
    setArquivo(f);
    try {
      if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) {
        setEstado("Lendo PDF…");
        const { blob, total } = await pdfParaPng(f, pg);
        setPaginas(total);
        setImagem(blob);
        setPreview(URL.createObjectURL(blob));
      } else if (/^image\/(png|jpeg|webp)$/.test(f.type)) {
        setPaginas(1);
        setImagem(f);
        setPreview(URL.createObjectURL(f));
      } else {
        throw new Error("Formato não aceito. Envie PDF, JPG ou PNG.");
      }
    } catch (e) {
      setErro((e as Error).message);
      setImagem(null);
      setPreview(null);
    }
    setEstado(null);
  }

  async function gerar(form: HTMLFormElement) {
    if (!arquivo || !imagem) return setErro("Escolha a planta ou a imagem do projeto.");
    const fd = new FormData(form);
    const tipo = String(fd.get("tipo_origem"));
    const contratoId = String(fd.get("contrato_id") || "") || null;
    setErro(null);
    const sb = supabaseNavegador();
    const { data: { user } } = await sb.auth.getUser();
    const base = `${p.empresaId}/${contratoId ? "contratos/" + contratoId : "render"}/origem/${Date.now()}`;
    const limpo = arquivo.name.replace(/[^\w.\-]/g, "_");

    setEstado("Enviando arquivo…");
    // guarda o original (PDF ou imagem) e, se for PDF, a página convertida que vai para a IA
    if (imagem !== arquivo) {
      const upOrig = await sb.storage.from("arquivos").upload(`${base}-${limpo}`, arquivo, { contentType: arquivo.type });
      if (!upOrig.error) {
        await sb.from("arquivos").insert({ empresa_id: p.empresaId, contrato_id: contratoId, tipo: tipo === "planta" ? "planta" : "projeto_imagem", nome: arquivo.name, storage_path: `${base}-${limpo}`, mime: arquivo.type, tamanho: arquivo.size, created_by: user?.id });
      }
    }
    const caminho = imagem === arquivo ? `${base}-${limpo}` : `${base}-pagina${pagina}.png`;
    const up = await sb.storage.from("arquivos").upload(caminho, imagem, { contentType: imagem.type || "image/png" });
    if (up.error) { setEstado(null); return setErro("Falha no envio: " + up.error.message); }
    const { data: arq, error: e1 } = await sb.from("arquivos").insert({
      empresa_id: p.empresaId, contrato_id: contratoId, tipo: tipo === "planta" ? "planta" : "projeto_imagem",
      nome: imagem === arquivo ? arquivo.name : `${arquivo.name} (página ${pagina})`, storage_path: caminho, mime: imagem.type || "image/png", tamanho: imagem.size, created_by: user?.id,
    }).select("id").single();
    if (e1) { setEstado(null); return setErro(e1.message); }
    const { data: r, error: e2 } = await sb.from("renders").insert({
      empresa_id: p.empresaId, contrato_id: contratoId, origem_arquivo_id: arq.id, tipo_origem: tipo,
      ambiente: String(fd.get("ambiente") || ""), estilo: String(fd.get("estilo")), instrucoes: String(fd.get("instrucoes") || ""), created_by: user?.id,
    }).select("id").single();
    if (e2) { setEstado(null); return setErro(e2.message); }

    setEstado("Gerando render com IA. Pode levar até 2 minutos…");
    router.refresh();
    const resp = await fetch("/api/render", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ renderId: r.id }) });
    const json = await resp.json().catch(() => ({}));
    setEstado(null);
    if (!resp.ok) setErro(json.erro ?? "Não foi possível gerar o render.");
    else { form.reset(); setArquivo(null); setImagem(null); setPreview(null); }
    router.refresh();
  }

  return (
    <div className="panel">
      <h2>Novo render</h2>
      {erro && <div className="erro">{erro}</div>}
      <form onSubmit={(e) => { e.preventDefault(); gerar(e.currentTarget); }} className="grid two">
        <div className="grid" style={{ gap: 12, alignContent: "start" }}>
          <label>O que você está enviando?
            <select name="tipo_origem" defaultValue="planta">
              <option value="planta">Planta baixa de arquiteto (vira 3D em perspectiva)</option>
              <option value="promob">Vista 3D do Promob (vira foto realista)</option>
            </select>
          </label>
          <label>Arquivo (PDF, JPG ou PNG)<input type="file" accept=".pdf,image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && preparar(e.target.files[0])} /></label>
          {paginas > 1 && (
            <label>Página do PDF<select value={pagina} onChange={(e) => { const n = Number(e.target.value); setPagina(n); if (arquivo) preparar(arquivo, n); }}>
              {Array.from({ length: paginas }, (_, i) => <option key={i} value={i + 1}>Página {i + 1}</option>)}</select></label>
          )}
          <div className="form">
            <label>Ambiente<input name="ambiente" placeholder="Ex.: Cozinha" /></label>
            <label>Estilo<select name="estilo" defaultValue="contemporaneo">
              <option value="contemporaneo">Contemporâneo claro</option><option value="amadeirado">Amadeirado</option><option value="minimalista">Minimalista</option><option value="industrial">Industrial</option><option value="classico">Clássico</option></select></label>
          </div>
          <label>Pedidos do cliente<textarea name="instrucoes" rows={2} placeholder="Ex.: bancada em quartzo branco, puxadores pretos" /></label>
          <label>Vincular ao contrato<select name="contrato_id" defaultValue={p.contratoInicial}><option value="">Sem contrato (pré-venda)</option>{p.contratos.map((c) => <option key={c.id} value={c.id}>{c.rotulo}</option>)}</select></label>
          <div><button className="btn primary" disabled={!!estado || !imagem}>{estado ?? "Gerar render"}</button></div>
        </div>
        <div style={{ display: "grid", placeItems: "center", background: "var(--sunk)", borderRadius: 10, minHeight: 240, padding: 8 }}>
          {preview ? <img src={preview} alt="Prévia do arquivo enviado" style={{ maxHeight: 360, maxWidth: "100%", objectFit: "contain", background: "#fff" }} /> : <span className="note">A prévia da planta aparece aqui</span>}
        </div>
      </form>
    </div>
  );
}
