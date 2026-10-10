import Link from "next/link";
import { contexto } from "@/lib/contexto";
import { criarOP } from "../acoes";

export default async function NovaOP({ searchParams }: { searchParams: Promise<{ contrato?: string; erro?: string; fim?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: ks }, { data: funcs }, { data: tipos }] = await Promise.all([
    ctx.supabase.from("contratos").select("id, codigo, cliente:clientes(nome)").eq("empresa_id", eid).order("created_at", { ascending: false }).limit(300),
    ctx.supabase.from("pessoas").select("id, nome, funcao").eq("empresa_id", eid).eq("categoria", "funcionario").eq("status", "ativo").order("nome"),
    ctx.supabase.from("tipos_servico").select("id, nome").eq("empresa_id", eid).order("nome"),
  ]);
  const hoje = new Date().toISOString().slice(0, 10);
  return (<>
    <nav className="migalha">Produção › Ordens de produção › Adicionar</nav>
    <div className="head"><div><h1>Nova ordem de produção</h1><p className="sub">A OP entra na coluna Agendada do kanban</p></div></div>
    {sp.erro && <div className="erro">{sp.erro}</div>}
    <form action={criarOP} className="panel cad">
      <div className="cad-grid" style={{ paddingTop: 18 }}>
        <label style={{ gridColumn: "span 2" }}><span>Contrato</span><select name="contrato_id" defaultValue={sp.contrato ?? ""}><option value="">Sem contrato (estoque / interno)</option>{(ks ?? []).map((k: any) => <option key={k.id} value={k.id}>#{k.codigo} · {k.cliente?.nome}</option>)}</select></label>
        <label><span>Tipo de serviço</span><select name="tipo_servico_id" defaultValue=""><option value="">Selecione</option>{(tipos ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}</select></label>
        <label><span>Responsável</span><select name="responsavel_id" defaultValue=""><option value="">Selecione</option>{(funcs ?? []).map((f: any) => <option key={f.id} value={f.id}>{f.nome}{f.funcao ? ` (${f.funcao})` : ""}</option>)}</select></label>
        <label className="cad-area"><span>Descrição</span><textarea name="descricao" rows={3} placeholder="Ex.: Cozinha + lavanderia, 32 peças, MDF branco TX" /></label>
        <label><span>Previsão inicial</span><input type="date" name="previsao_inicio" defaultValue={hoje} /></label>
        <label><span>Previsão final</span><input type="date" name="previsao_fim" defaultValue={sp.fim ?? ""} /></label>
      </div>
      <div className="cad-acoes"><button className="btn primary">Criar OP</button><Link className="btn" href="/producao">Voltar</Link></div>
    </form>
  </>);
}
