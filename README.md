# Pro Plan System

ERP em nuvem para lojas, franquias e marcenarias de móveis planejados. Tudo gira em torno do **Contrato #N/ANO**.

Stack: Next.js 15 (App Router) + Supabase (Postgres, login, storage) + IA de imagem da OpenAI para o Render Pro.

## O que já funciona (fase 1)

| Módulo | O que faz |
|---|---|
| Login e empresas | Cadastro com e-mail e senha, criação da empresa, troca entre CNPJs (multi-empresa). Cada empresa só enxerga os próprios dados, garantido no banco (RLS). |
| Clientes | Cadastro com origem do lead (campanha) e lista de contratos de cada cliente. |
| Comercial | Orçamento com importação Promob (XML/TXT), pontuação por ambiente, olhinho ao vivo (VPL, taxas de cartão, RT, custos, margem) e trava de pontuação mínima. Dono e gerente podem liberar abaixo do mínimo. |
| Contrato #N/ANO | Numeração automática por empresa e ano. Gera os 6 marcos com SLA e os lançamentos previstos (parcelas, fábrica, RT). Abas de linha do tempo, financeiro/DRE, arquivos, diff pós-medição e assistência. |
| Radar de Prazos | Marcos atrasados, em atenção e no prazo, com filtros. Workflow industrial de 7 estágios em quadro. Expedição avança o radar sozinho. |
| Render Pro | Envio de planta de arquiteto ou vista do Promob em PDF, JPG ou PNG. PDF é convertido no navegador. A IA gera a imagem 3D fotorrealista e salva no contrato. |
| Dashboard | Vendido no mês, margem prevista, a receber em 30 dias, marcos atrasados, workflow e lucro por campanha. |

Próxima fase (tabelas já criadas no banco): CRM Pro com score de IA, Assistência Técnica em quadro, Financeiro geral, Comissões por faixa, Fiscal (NF-e/NFS-e), Ranking, Relatórios, Portal do Montador, assinatura digital integrada.

## Como colocar no ar

### 1. Supabase
1. Crie um projeto em supabase.com (região São Paulo).
2. Em **SQL Editor**, rode os arquivos de `supabase/migrations/` **nesta ordem**:
   `20261010000001_schema.sql`, `20261010000002_rls_funcoes.sql`, `20261010000003_storage.sql`.
   (Ou, com a CLI: `supabase link` e `supabase db push`.)
3. Em **Authentication > URL Configuration**, coloque o endereço do sistema em *Site URL* e adicione `https://SEU-DOMINIO/auth/confirmar` em *Redirect URLs*.
4. Em **Project Settings > API**, copie a *Project URL* e a chave *anon*.

### 2. Rodar no seu computador
```bash
cp .env.example .env.local   # preencha as chaves
npm install
npm run dev                  # abre em http://localhost:3000
```

### 3. Publicar na Vercel
1. Suba esta pasta para um repositório no GitHub.
2. Na Vercel, importe o repositório e cadastre as mesmas variáveis do `.env.example`.
3. O render pode levar mais de 1 minuto. A rota `/api/render` pede até 300 s; confira se o seu plano da Vercel permite essa duração.

### Variáveis
| Nome | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API |
| `OPENAI_API_KEY` | platform.openai.com > API keys (fica só no servidor) |
| `OPENAI_IMAGE_MODEL` | padrão `gpt-image-2` |
| `OPENAI_IMAGE_QUALITY` | `low`, `medium` ou `high` (mais alto custa mais) |

## Testes
```bash
npm test                      # olhinho e leitor do Promob
psql ... -f supabase/tests/stub_supabase.sql -f supabase/migrations/... -f supabase/tests/test_rls.sql
node tests/consultas.test.mjs # consultas do app contra um PostgREST local
```
O teste do banco cobre isolamento entre empresas, numeração #N/ANO, trava de pontuação, permissão de liberação só para gestor, marcos e auto-avanço do radar.

## Pontos para validar com arquivos reais
- **Promob**: o leitor em `lib/promob.ts` é tolerante (procura nós de ambiente e soma o preço das peças), mas o layout muda conforme a versão e a fábrica. Com 2 ou 3 exportações reais, ajuste as expressões `MAPA_*` no topo do arquivo.
- **Render a partir de planta baixa**: a IA interpreta a planta e monta uma perspectiva 3D. Ela pode inventar alturas e detalhes que não estão na planta. Para fidelidade total de medidas, a vista 3D do Promob dá resultado mais preciso.

## Estrutura
```
app/(app)/        telas logadas (dashboard, clientes, comercial, contratos, radar, render)
app/api/render    geração do render no servidor
lib/olhinho.ts    cálculo de VPL e margem (mesmo código no navegador e no servidor)
lib/promob.ts     leitor de XML/TXT do Promob
supabase/         migrations, políticas de acesso e testes do banco
```
