import Link from "next/link";
import { notFound } from "next/navigation";
import { contexto, configuracaoEmpresa } from "@/lib/contexto";
import Editor from "./Editor";

export default async function Orcamento({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await contexto();
  const [{ data: o }, { data: ambs }, cfg, { data: contrato }] = await Promise.all([
    ctx.supabase.from("orcamentos").select("*, cliente:clientes(nome, endereco), parceiro:parceiros(nome)").eq("id", id).single(),
    ctx.supabase.from("ambientes").select("id, nome, descricao, prazo_dias, custo_fabrica, pontuacao, origem").eq("orcamento_id", id).eq("versao", 1).order("ordem"),
    configuracaoEmpresa(ctx),
    ctx.supabase.from("contratos").select("id, codigo").eq("orcamento_id", id).maybeSingle(),
  ]);
  if (!o) notFound();
  return (
    <>
      <div className="note" style={{ marginBottom: 6 }}><Link href="/comercial">Comercial</Link> / Orçamento</div>
      <div className="head">
        <div><h1>{o.nome_projeto}</h1><p className="sub">{(o as any).cliente?.nome}{(o as any).parceiro ? ` · Parceiro ${(o as any).parceiro.nome}` : ""}</p></div>
        {contrato && <Link className="btn primary" href={`/contratos/${contrato.id}`}>Abrir contrato #{contrato.codigo}</Link>}
      </div>
      <Editor
        orcamentoId={id}
        fechado={o.status === "fechado"}
        gestor={["dono", "gerente"].includes(ctx.papel)}
        enderecoPadrao={(o as any).cliente?.endereco ?? ""}
        nomeParceiro={(o as any).parceiro?.nome ?? null}
        cfg={cfg}
        inicialAmbientes={(ambs ?? []).map((a) => ({ ...a, custo_fabrica: Number(a.custo_fabrica), pontuacao: Number(a.pontuacao) }))}
        inicialCond={{ desconto_pct: Number(o.desconto_pct), forma_pagamento: o.forma_pagamento, parcelas: o.parcelas, rt_pct: Number(o.rt_pct) }}
      />
    </>
  );
}
