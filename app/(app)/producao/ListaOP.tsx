import Link from "next/link";
import { data } from "@/lib/formato";
import { dias, NOME_ETAPA } from "@/lib/producao";

export default function ListaOP({ ops, modo, q }: { ops: any[]; modo: "aguardando" | "finalizada" | "cancelada"; q?: string }) {
  return (
    <div className="panel" style={{ padding: 0 }}>
      <form className="cad-busca"><input name="q" defaultValue={q ?? ""} placeholder="Buscar por Nº OP, contrato ou cliente" style={{ flex: 1 }} aria-label="Buscar" /><button className="btn">Filtrar</button></form>
      <div className="scroll"><table className="cad-tab">
        <thead><tr><th>Nº OP</th><th>Nº contrato</th><th>Cliente</th>
          {modo === "aguardando" && <><th>Etapa</th><th>Previsão inicial</th><th>Previsão final</th></>}
          {modo === "finalizada" && <><th>Tempo total</th><th>Data finalizada</th><th>Previsão inicial</th><th>Previsão final</th></>}
          {modo === "cancelada" && <><th>Data criação</th><th>Data cancelada</th><th>Motivo</th></>}
          <th className="r">Ações</th></tr></thead>
        <tbody>{ops.map((o) => (
          <tr key={o.id}>
            <td className="num"><b>{o.numero}</b></td>
            <td>{o.contrato ? <Link className="idc" href={`/contratos/${o.contrato.id}`}>#{o.contrato.codigo}</Link> : "n/a"}</td>
            <td>{o.contrato?.cliente?.nome ?? "Sem contrato"}{o.descricao && <div className="note">{o.descricao}</div>}</td>
            {modo === "aguardando" && <><td>{NOME_ETAPA[o.etapa]}</td><td className="num note">{o.previsao_inicio ? data(o.previsao_inicio) : "n/a"}</td><td className="num note" style={{ color: o.atrasada ? "var(--bad)" : undefined }}>{o.previsao_fim ? data(o.previsao_fim) : "n/a"}</td></>}
            {modo === "finalizada" && <><td className="num">{dias(o.iniciada_em ?? o.created_at, o.finalizada_em) ?? "n/a"} dias</td><td className="num note">{o.finalizada_em ? data(o.finalizada_em) : "n/a"}</td>
              <td className="num note">{o.previsao_inicio ? data(o.previsao_inicio) : "n/a"}</td><td className="num note">{o.previsao_fim ? data(o.previsao_fim) : "n/a"}{o.atrasada && <span className="pill p-bad" style={{ marginLeft: 6 }}>com atraso</span>}</td></>}
            {modo === "cancelada" && <><td className="num note">{data(o.created_at)}</td><td className="num note">{o.cancelada_em ? data(o.cancelada_em) : "n/a"}</td><td>{o.motivo_cancelamento ?? "n/a"}</td></>}
            <td className="r">{modo === "aguardando" ? <Link className="btn sm" href={`/producao?op=${o.id}`}>Abrir no kanban</Link> : null}</td>
          </tr>))}</tbody>
      </table></div>
      {!ops.length && <div className="vazio"><b>{modo === "aguardando" ? "Nenhuma produção aguardando início" : modo === "finalizada" ? "Nenhuma produção finalizada encontrada" : "Nenhuma produção cancelada encontrada"}</b>
        <p>{modo === "aguardando" ? "As produções agendadas aparecem aqui até serem iniciadas." : modo === "finalizada" ? "As produções aparecem aqui assim que forem finalizadas." : "As produções canceladas aparecem aqui."}</p></div>}
    </div>
  );
}
