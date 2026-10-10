import { contexto } from "@/lib/contexto";
import Imprimir from "@/components/Imprimir";

// Termo de responsabilidade pelas ferramentas, para imprimir e assinar
export default async function Termo({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const sp = await searchParams;
  const ctx = await contexto();
  const eid = ctx.empresa.id;
  const [{ data: pess }, { data: emp }] = await Promise.all([
    ctx.supabase.from("pessoas").select("id, nome, cpf_cnpj, funcao").eq("empresa_id", eid).eq("categoria", "funcionario").order("nome"),
    ctx.supabase.from("empresas").select("nome, razao_social, cnpj, municipio, uf").eq("id", eid).single(),
  ]);
  const p = (pess ?? []).find((x: any) => x.id === sp.r);
  const { data: fs } = p ? await ctx.supabase.from("ferramentas").select("numero, nome, marca, serie, quantidade").eq("empresa_id", eid).eq("responsavel_id", p.id).order("numero") : { data: [] as any[] };
  return (<>
    <form className="nao-imprimir" style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
      <select name="r" defaultValue={sp.r ?? ""} required aria-label="Responsável"><option value="">Escolha o funcionário</option>{(pess ?? []).map((x: any) => <option key={x.id} value={x.id}>{x.nome}</option>)}</select>
      <button className="btn">Gerar termo</button>{p && <Imprimir />}
    </form>
    {p ? (
      <div className="panel termo">
        <h1 style={{ textAlign: "center", fontSize: 20 }}>Termo de responsabilidade pela guarda e uso de ferramentas</h1>
        <p>Eu, <b>{p.nome}</b>{p.cpf_cnpj ? `, CPF ${p.cpf_cnpj}` : ""}{p.funcao ? `, ${p.funcao}` : ""}, declaro ter recebido de <b>{emp?.razao_social || emp?.nome}</b>{emp?.cnpj ? `, CNPJ ${emp.cnpj}` : ""}, as ferramentas abaixo, em perfeito estado de conservação e funcionamento, para uso exclusivo no exercício das minhas atividades.</p>
        <table><thead><tr><th>Código</th><th>Descrição</th><th>Marca</th><th>Série</th><th className="r">Qtd.</th></tr></thead>
          <tbody>{(fs ?? []).map((f: any) => <tr key={f.numero}><td className="num">{f.numero}</td><td>{f.nome}</td><td>{f.marca}</td><td className="num">{f.serie}</td><td className="r num">{f.quantidade}</td></tr>)}
            {!(fs ?? []).length && <tr><td colSpan={5} className="note">Nenhuma ferramenta sob responsabilidade deste funcionário.</td></tr>}</tbody></table>
        <p>Comprometo-me a zelar pela guarda e conservação das ferramentas, devolvendo-as quando solicitado ou no encerramento do vínculo, e a comunicar imediatamente qualquer dano, perda ou furto.</p>
        <p style={{ marginTop: 40 }}>{emp?.municipio ?? "_____________"}{emp?.uf ? "/" + emp.uf : ""}, {new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long", year: "numeric" })}.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginTop: 60 }}>
          <div style={{ borderTop: "1px solid var(--fg)", textAlign: "center", paddingTop: 6 }}>{p.nome}</div>
          <div style={{ borderTop: "1px solid var(--fg)", textAlign: "center", paddingTop: 6 }}>{emp?.razao_social || emp?.nome}</div>
        </div>
      </div>
    ) : <p className="note">Escolha o funcionário para gerar o termo com as ferramentas sob responsabilidade dele.</p>}
  </>);
}
