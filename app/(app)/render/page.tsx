import { contexto } from "@/lib/contexto";
import { data } from "@/lib/formato";
import NovoRender from "./NovoRender";
import Refazer from "./Refazer";

const STATUS: Record<string, [string, string]> = { pendente: ["Na fila", "p-neu"], processando: ["Gerando…", "p-info"], concluido: ["Pronto", "p-good"], erro: ["Erro", "p-bad"] };

export default async function Render({ searchParams }: { searchParams: Promise<{ contrato?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const sb = ctx.supabase;
  const [{ data: contratos }, { data: renders }, { count: usados }] = await Promise.all([
    sb.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false }).limit(200),
    sb.from("renders").select("*, contrato:contratos(codigo), origem:arquivos!renders_origem_arquivo_id_fkey(storage_path), resultado:arquivos!renders_resultado_arquivo_id_fkey(storage_path)")
      .eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false }).limit(60),
    sb.rpc("renders_no_mes", { p_empresa: ctx.empresa.id }).then((r) => ({ count: Number(r.data ?? 0) })),
  ]);
  const limite = Number(ctx.empresa.limite_renders ?? 20);
  const caminhos = (renders ?? []).flatMap((r: any) => [r.origem?.storage_path, r.resultado?.storage_path]).filter(Boolean);
  const { data: urls } = caminhos.length ? await sb.storage.from("arquivos").createSignedUrls(caminhos, 3600) : { data: [] as any[] };
  const url = (p?: string) => (p ? (urls ?? []).find((u: any) => u.path === p)?.signedUrl : undefined);

  return (
    <>
      <div className="head"><div><h1>Render Pro</h1><p className="sub">Planta de arquiteto ou vista do Promob em imagem 3D fotorrealista, salva no contrato</p></div>
        <span className={"pill " + ((usados ?? 0) >= limite ? "p-bad" : "p-neu")}>{usados ?? 0} de {limite} renders neste mês</span></div>
      <NovoRender empresaId={ctx.empresa.id} contratoInicial={sp.contrato ?? ""} contratos={(contratos ?? []).map((c: any) => ({ id: c.id, rotulo: `#${c.codigo} · ${c.cliente?.nome ?? ""}` }))} />
      <div className="galeria mt">
        {(renders ?? []).map((r: any) => (
          <div key={r.id} className="panel" style={{ padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
              <img src={url(r.origem?.storage_path)} alt="Origem" style={{ aspectRatio: "1", objectFit: "contain", background: "#fff" }} />
              {r.status === "concluido" ? (
                <a href={url(r.resultado?.storage_path)} target="_blank" rel="noopener"><img src={url(r.resultado?.storage_path)} alt={`Render ${r.ambiente ?? ""}`} /></a>
              ) : (
                <div style={{ display: "grid", placeItems: "center", background: "var(--sunk)", borderRadius: 9, aspectRatio: "3/2", padding: 8, textAlign: "center" }}>
                  <span className="note">{r.status === "erro" ? r.erro : "A imagem aparece aqui quando ficar pronta."}</span>
                </div>
              )}
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <span><b>{r.ambiente || "Ambiente"}</b> <span className="note">{r.tipo_origem === "planta" ? "da planta" : "do Promob"}{r.contrato ? ` · #${r.contrato.codigo}` : ""}</span></span>
              <span className={"pill " + STATUS[r.status][1]}>{STATUS[r.status][0]}</span>
            </div>
            <div className="row"><span className="note">{data(r.created_at)}</span>{r.status !== "processando" && <Refazer id={r.id} />}</div>
          </div>
        ))}
      </div>
      {!renders?.length && <p className="note mt">Nenhum render ainda. Envie a primeira planta acima.</p>}
    </>
  );
}
