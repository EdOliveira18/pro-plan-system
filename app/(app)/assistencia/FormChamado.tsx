import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { STATUS_AT, MODALIDADES } from "@/lib/assistencia";
import { salvarChamado } from "./acoes";

export default async function FormChamado({ c, contrato }: { c?: any; contrato?: string }) {
  const ctx = await contexto();
  const [{ data: ks }, { data: funcs }] = await Promise.all([
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", ctx.empresa.id).order("created_at", { ascending: false }).limit(500),
    ctx.supabase.from("pessoas").select("id, nome, funcao").eq("empresa_id", ctx.empresa.id).eq("categoria", "funcionario").eq("status", "ativo").order("nome"),
  ]);
  return (
    <form action={salvarChamado.bind(null, c?.id ?? null)} className="panel cad">
      <div className="cad-grid" style={{ paddingTop: 18 }}>
        <label style={{ gridColumn: "span 2" }}><span>Cliente / contrato<i className="obr">*</i></span><select name="contrato_id" required defaultValue={c?.contrato_id ?? contrato ?? ""}><option value="">Selecione</option>{(ks ?? []).map((k: any) => <option key={k.id} value={k.id}>{k.cliente?.nome} · contrato #{k.codigo}</option>)}</select></label>
        <label><span>Modalidade</span><select name="modalidade" defaultValue={c?.modalidade ?? "reparo"}>{MODALIDADES.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label><span>Status</span><select name="status" defaultValue={c?.status ?? "aberto"}>{STATUS_AT.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
        <label className="cad-area"><span>Problema relatado<i className="obr">*</i></span><textarea name="descricao" rows={6} required defaultValue={c?.descricao ?? ""} /></label>
        <label className="cad-area"><span>Histórico do serviço executado</span><textarea name="historico" rows={6} defaultValue={c?.historico ?? ""} /></label>
        <label className="cad-area"><span>Observações</span><textarea name="observacoes" rows={4} defaultValue={c?.observacoes ?? ""} /></label>
        <label><span>Dia visita</span><input type="date" name="agendado_para" defaultValue={c?.agendado_para ?? ""} /></label>
        <label><span>Hora</span><input type="time" name="hora_visita" defaultValue={c?.hora_visita?.slice(0, 5) ?? ""} /></label>
        <label style={{ gridColumn: "span 2" }}><span>Montador / técnico</span><select name="montador_id" defaultValue={c?.montador_id ?? ""}><option value="">Selecione</option>{(funcs ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}{f.funcao ? ` (${f.funcao})` : ""}</option>)}</select></label>
      </div>
      <div className="cad-acoes"><button className="btn primary">{c ? "Salvar" : "Adicionar"}</button><Link className="btn" href="/assistencia">Voltar</Link></div>
    </form>
  );
}
