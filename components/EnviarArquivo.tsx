"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseNavegador } from "@/lib/supabase/client";

// Envia direto do navegador para o Storage (sem passar pelo servidor) e registra na tabela arquivos.
export default function EnviarArquivo(p: { empresaId: string; contratoId?: string; orcamentoId?: string; tipo: string; accept?: string; rotulo?: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<string | null>(null);
  async function enviar(files: FileList | null) {
    if (!files?.length) return;
    const sb = supabaseNavegador();
    const { data: { user } } = await sb.auth.getUser();
    for (const f of Array.from(files)) {
      setEstado(`Enviando ${f.name}…`);
      const pasta = p.contratoId ? `contratos/${p.contratoId}` : p.orcamentoId ? `orcamentos/${p.orcamentoId}` : "geral";
      const caminho = `${p.empresaId}/${pasta}/${p.tipo}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const up = await sb.storage.from("arquivos").upload(caminho, f, { contentType: f.type });
      if (up.error) { setEstado("Erro ao enviar: " + up.error.message); return; }
      const { error } = await sb.from("arquivos").insert({
        empresa_id: p.empresaId, contrato_id: p.contratoId ?? null, orcamento_id: p.orcamentoId ?? null, tipo: p.tipo,
        nome: f.name, storage_path: caminho, mime: f.type, tamanho: f.size, created_by: user?.id,
      });
      if (error) { setEstado("Erro ao registrar: " + error.message); return; }
    }
    setEstado(null);
    router.refresh();
  }
  return (
    <label className="btn sm" style={{ cursor: "pointer" }}>
      {estado ?? p.rotulo ?? "Enviar arquivo"}
      <input type="file" hidden multiple accept={p.accept} onChange={(e) => { enviar(e.target.files); e.target.value = ""; }} />
    </label>
  );
}
