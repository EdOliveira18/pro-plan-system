// Roda as mesmas consultas do app contra um PostgREST local (mesmo motor de API do Supabase).
// Uso: PGRST_URL=http://localhost:3456 JWT_SECRET=... node tests/consultas.test.mjs
import { PostgrestClient } from "@supabase/postgrest-js";
import crypto from "node:crypto";
import assert from "node:assert/strict";

const URL_ = process.env.PGRST_URL ?? "http://localhost:3456";
const SECRET = process.env.JWT_SECRET ?? "segredo-de-teste-com-pelo-menos-32-caracteres";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ sub, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
const cli = (sub) => new PostgrestClient(URL_, { headers: { Authorization: `Bearer ${jwt(sub)}` } });
const ANA = "00000000-0000-0000-0000-00000000000a", BRUNO = "00000000-0000-0000-0000-00000000000b";
const ok = (r, nome) => { if (r.error) throw new Error(`${nome}: ${r.error.message}`); console.log("ok", nome); return r.data; };

const a = cli(ANA);
const membros = ok(await a.from("membros").select("papel, nome, empresa:empresas(id, nome, cnpj)").eq("user_id", ANA).eq("ativo", true), "contexto membros+empresa");
const eid = membros[0].empresa.id;
ok(await a.from("configuracoes").select("*").eq("empresa_id", eid).single(), "configuracoes");
ok(await a.from("marcos").select("id, contrato:contratos!inner(marco_atual, encerrado)").eq("empresa_id", eid).is("concluido_em", null).lt("previsto_em", "2099-01-01"), "dashboard marcos atrasados");
const clientes = ok(await a.from("clientes").select("id, nome, telefone, endereco, campanha:campanhas(nome), contratos(id, codigo, valor_total, etapa_workflow, assinatura_cliente)").eq("empresa_id", eid), "clientes com contratos");
assert.ok(clientes[0].contratos.length >= 2);
ok(await a.from("orcamentos").select("id, nome_projeto, status, created_at, calculo, cliente:clientes(nome)").eq("empresa_id", eid), "lista orçamentos");
const orc = ok(await a.from("orcamentos").select("*, cliente:clientes(nome, endereco), parceiro:parceiros(nome)").eq("nome_projeto", "Casa").single(), "orçamento com cliente e parceiro");
ok(await a.from("contratos").select("id, codigo").eq("orcamento_id", orc.id).maybeSingle(), "contrato do orçamento");
const c = ok(await a.from("contratos").select("*, cliente:clientes(nome, telefone, endereco), campanha:campanhas(nome, investimento), parceiro:parceiros(nome)").eq("numero", 1).single(), "contrato detalhe");
ok(await a.from("ambientes").select("id, versao, nome, custo_fabrica, pecas(descricao, codigo, quantidade, custo_unitario)").eq("orcamento_id", c.orcamento_id).in("versao", [1, 2]), "ambientes com peças (diff)");
ok(await a.from("contratos").select("id, codigo, marco_atual, etapa_workflow, vendedor_id, cliente:clientes(nome), marcos(tipo, previsto_em, sla_dias, concluido_em)").eq("empresa_id", eid).eq("encerrado", false), "radar");

// fluxo do render: arquivo de origem + registro + embeds com dica de FK
const arq = ok(await a.from("arquivos").insert({ empresa_id: eid, contrato_id: c.id, tipo: "planta", nome: "planta.png", storage_path: `${eid}/teste/${Date.now()}.png`, mime: "image/png", created_by: ANA }).select("id").single(), "insert arquivo");
const r = ok(await a.from("renders").insert({ empresa_id: eid, contrato_id: c.id, origem_arquivo_id: arq.id, tipo_origem: "planta", ambiente: "Cozinha", estilo: "contemporaneo", created_by: ANA }).select("id").single(), "insert render");
ok(await a.from("renders").select("*, origem:arquivos!renders_origem_arquivo_id_fkey(storage_path, mime)").eq("id", r.id).single(), "render com origem (api)");
ok(await a.from("renders").select("*, contrato:contratos(codigo), origem:arquivos!renders_origem_arquivo_id_fkey(storage_path), resultado:arquivos!renders_resultado_arquivo_id_fkey(storage_path)").eq("empresa_id", eid), "galeria de renders");

// fechamento via RPC, como o app chama
const novo = ok(await a.from("orcamentos").insert({ empresa_id: eid, cliente_id: clientes[0].id, nome_projeto: "Lavanderia" }).select("id").single(), "novo orçamento");
ok(await a.from("ambientes").insert({ empresa_id: eid, orcamento_id: novo.id, nome: "Lavanderia", custo_fabrica: 3000, pontuacao: 3 }), "ambiente");
const cid = ok(await a.rpc("fechar_orcamento", { p_orcamento_id: novo.id, p_valor_total: 9000, p_vpl: 8200, p_custo_previsto: 4500, p_lucro_previsto: 3700, p_custo_fabrica: 3000, p_valor_rt: 0, p_endereco_obra: null, p_liberar_abaixo_minimo: false }), "rpc fechar_orcamento");
ok(await a.rpc("concluir_marco", { p_contrato_id: cid }), "rpc concluir_marco");
ok(await a.rpc("avancar_workflow", { p_contrato_id: cid }), "rpc avancar_workflow");

// isolamento pela API
const b = cli(BRUNO);
const vistos = ok(await b.from("contratos").select("id"), "bruno lista contratos");
assert.equal(vistos.length, 0, "Bruno não pode ver contratos da Ana");
const inv = await b.from("clientes").insert({ empresa_id: eid, nome: "invasor" });
assert.ok(inv.error, "Bruno não pode inserir na empresa da Ana");
console.log("ok isolamento via API\nTODAS AS CONSULTAS DO APP FUNCIONARAM");
