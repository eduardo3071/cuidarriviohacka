# Rivio Hub de Saúde — Hackathon Gama House

Plataforma que estrutura o histórico de saúde (exames em papel/PDF + wearables) e o mostra ao médico **com consentimento** da pessoa. Dados 100% sintéticos.

## Arquitetura

```
Vercel (React+Vite) ──supabase-js──► Supabase (Postgres + Auth + Storage + RLS)
        │                                   ▲
        └── upload/IA ──► FastAPI (Render) ─┘   valida o JWT do Supabase
                              └─ LLMClient → Ollama (VM/local) | API hospedada
```

- **Supabase** guarda dados, login, arquivos e o **consentimento como policy de RLS**.
- **FastAPI** só cuida do que precisa de IA (extração, normalização, explicação de alertas).
- O backend usa a **chave secreta** (`sb_secret_...`, `SUPABASE_SECRET_KEY`; no Postgres ela vira o papel `service_role`, que ignora RLS)
  → **sempre checar o dono em código**. Ela **não é um JWT**: vai só no cabeçalho `apikey`, nunca em `Authorization: Bearer`.
  O nome antigo `SUPABASE_SERVICE_ROLE_KEY` (chave JWT legada) continua aceito.

## Estrutura

```
apps/api/            FastAPI (Dockerfile para o Render)
apps/web/            React + Vite (a criar)
supabase/migrations/ schema + RLS (SQL versionado)
data/ontology/       biomarcadores, aliases, unidades
data/synthetic/      exames sintéticos + gabarito
```

## Rodando a API

```bash
cd apps/api
python -m venv .venv && .venv/Scripts/activate   # Windows
pip install -r requirements.txt
cp ../../.env.example ../../.env                  # preencha as chaves
uvicorn app.main:app --reload
pytest
```

Ou com Docker: `docker compose up --build` (a imagem usa a raiz do repositório como contexto).

Conferir o `.env` e os adaptadores contra o Supabase **real** (nunca imprime segredos; apaga o que cria):

```bash
python scripts/live_check.py              # só o formato do .env, sem rede
python scripts/live_check.py --db-only    # + banco (precisa de DATABASE_URL)
python scripts/live_check.py --live       # + storage e pipeline completo (precisa também da chave secreta sb_secret_...)
```

O `.env` fica na **raiz** do repositório (ignorado pelo git). Nunca coloque segredos no `.env.example`.

## Seed (dados sintéticos)

`data/ontology/*.csv` e `data/synthetic/marta/*` são a fonte da verdade. Para regenerar o SQL:

```bash
python scripts/build_seed.py   # escreve supabase/seed/01_ontology.sql e 02_marta.sql
```

Os dois arquivos são idempotentes: reaplicar apaga e recria a paciente Marta.

## Extração de laudos (três caminhos, mesmo contrato `ExtractedObservation`)

| Caminho | Como | Quando |
|---|---|---|
| `text_layer` | texto do PDF + regex | PDF digital com uma linha por resultado (rápido, sem IA) |
| `ocr` | OpenCV (acha o papel, corrige perspectiva, tira sombra e linhas de tabela) + RapidOCR + regex | foto/escaneado; devolve a **caixa do valor** (`bbox`) para destacar a origem |
| `llm` | IA hospedada (texto ou imagem) | layouts que a regra não entende (ex.: resultado em outra linha) |

Medir um caminho nos exames de teste:

```bash
apps/api/.venv/Scripts/python.exe scripts/eval_extraction.py --extractor ocr
```

Testes: `pytest` roda os rápidos (~15 s); `pytest -m slow` roda o OCR real (~50 s).
OCR: pico de memória medido ~385 MB por página; **não cabe com folga no Render gratuito (512 MB)**.

## API de documentos (Fase 3)

Todas as rotas exigem `Authorization: Bearer <JWT do Supabase Auth>`; o paciente vem **sempre do token**.
Erros têm corpo estável `{"detail": {"code": "...", "message": "..."}}`.

| Rota | O que faz | Status |
|---|---|---|
| `POST /documents` (multipart `file`) | envia PDF/JPEG/PNG/WebP; tipo pelo **conteúdo**, não pelo cabeçalho | `202` novo · `200` mesmo arquivo de novo (idempotente) · `413` · `415` · `422` · `502` |
| `GET /jobs/{id}` | andamento da extração | `200` · `404` |
| `GET /documents/{id}` | estado do documento | `200` · `404` |
| `GET /documents/{id}/review` | leituras com caixa, confiança, notas e páginas (URL temporária) | `200` · `404` · `409` (ainda não pronto, falhou ou já confirmado) |
| `POST /documents/{id}/confirm` | grava as leituras **revisadas** no histórico | `200` (`already: true` se repetido) · `404` · `409` · `422` |

Fluxo: upload → job → `text_layer` (PDF com texto) → OCR local (se `OCR_ENABLED`) → IA hospedada (se houver chave) → revisão → confirmação.
A atomicidade e a idempotência vivem nas funções SQL `create_document_once` e `confirm_document`
(`supabase/migrations/..._documents_pipeline.sql`); o Python só as chama.

Docker: o contexto de build é a **raiz** (`docker build -f apps/api/Dockerfile .`), porque a API lê `data/ontology`.
No Render: *Root Directory* = raiz do repositório, *Dockerfile Path* = `apps/api/Dockerfile`.

## Usuários de demonstração (Supabase Auth)

| Papel | E-mail (domínio `.test`, não recebe e-mail) | Ligado a |
|---|---|---|
| paciente | `marta@demo.rivio.test` | `patients` — Marta (sintética) |
| médico | `dr.henrique@demo.rivio.test` | `doctors` — Dr. Henrique (fictício) |

```bash
python scripts/seed_auth_users.py      # cria/liga (idempotente; nunca sobrescreve outra ligação)
python scripts/live_auth_check.py      # login real + API HTTP + RLS/consentimento com esses usuários (se limpa sozinho)
```

As contas foram criadas **sem que ninguém definisse senha**. Os testes obtêm tokens reais pelo fluxo administrativo de
link mágico. Para entrar pela tela de login do front, **você** define a senha no seu terminal (lida com `getpass`, não
aparece na tela nem no histórico, só aceita contas `@demo.rivio.test`):

```bash
python scripts/set_demo_password.py marta@demo.rivio.test
python scripts/set_demo_password.py dr.henrique@demo.rivio.test
```

(ou pelo painel do Supabase, *Authentication → Users*). O verificador de JWT tolera 30 s de desvio de relógio (o
Supabase estava ~1,5 s à frente de um notebook, o que derrubava tokens recém-emitidos).

## Login, privacidade e visão do médico (Fase 6)

O front (`apps/web`) lê o Supabase direto com a chave **publicável** e o token do usuário; quem decide o que cada pessoa
vê é o **RLS**, não o código do front. O papel (paciente/médico) só escolhe a tela.

- **Paciente**: *Meus dados* (exames, linha do tempo, relógio e alertas) e *Privacidade e acessos*: escolhe o médico, as
  categorias (exames, histórico, relógio e alertas) e o prazo (7 dias a 1 ano), revoga na hora e vê quem abriu o quê.
- **Médico**: lista só os pacientes com consentimento ativo; abre em **somente leitura**, vendo só as categorias liberadas.
  Cada abertura é gravada no `access_log` **antes** de mostrar os dados (se não der para registrar, não mostra).
- Sem `VITE_SUPABASE_*` no `.env`, ou pelo botão “Ver demonstração”, o app roda em modo demonstração sem login.
- O `.env` é lido da **raiz** (`envDir`); só variáveis `VITE_*` chegam ao navegador.

```bash
cd apps/web && npm test                          # lógica, telas (SSR) e login: 80 testes
cd apps/web && npm run test:live                 # AO VIVO, sessões reais: papéis, RLS, consentimento, auditoria (se limpa sozinho)
cd apps/web && npm run build
python scripts/check_bundle.py                   # confere que o bundle não vazou nenhum segredo do .env (não imprime valores)
```

## Relógio e alertas (Fase 5)

Regras **determinísticas** (nenhuma IA decide) sobre os dados do relógio: `apps/api/app/services/alerts/`.
Cada alerta leva a **evidência** (regra, observado, janela, pontos e linhas de referência) para a tela "Por que disparou?",
orienta procurar um médico e **nunca diagnostica** (testes travam isso). Dado insuficiente não dispara.

| Alerta | Regra (limiares de demonstração: **precisam de revisão clínica**) | Severidade |
|---|---|---|
| Ritmo irregular | ≥ 2 avisos do relógio em 14 dias (a detecção é do relógio; o painel só conta) | atenção |
| Oxigênio baixo no sono | mínimo noturno < 90% em ≥ 3 das últimas 7 noites (≥ 4 noites de dado) | atenção |
| Pressão alta | média de 7 dias ≥ 135/85 mmHg (≥ 4 medidas); qualquer medida ≥ 180/120 | atenção / **urgente** |
| FC de repouso subiu | mediana da semana ≥ 8 bpm acima do padrão (≥ 12: atenção) | info |
| HRV caiu | mediana da semana ≤ 70% do padrão (≤ 55%: atenção) | info |
| Sono mais curto | média da semana < 6 h e ≥ 45 min abaixo do padrão | info |

O "padrão" é a mediana de 28 dias que **termina 14 dias atrás**: a folga evita que um episódio em curso contamine a
própria linha de base (limite conhecido: uma deriva mais longa que 2 semanas ainda contamina).

```bash
python scripts/make_wearables.py            # gera data/synthetic/marta/wearables.csv (90 dias, determinístico)
python scripts/load_wearables.py --dry-run  # mostra os alertas de hoje (12/11/2026) sem gravar
python scripts/load_wearables.py            # grava amostras + alertas (precisa da migration da Fase 5)
```

Na demonstração: a linha de base (24 dias avaliados) tem **0 alarmes**, mesmo com ruído, 1 dia atípico, 3 dias sem dados e
1 aviso de ritmo isolado; o episódio (a partir de 22/10) dispara ritmo irregular em +5 dias, oxigênio em +11, pressão em +15.
Dados 100% sintéticos: esses atrasos descrevem a história inventada, não o desempenho clínico.

## Séries e linha do tempo (Fase 4)

Cada leitura guarda o que o laudo disse (valor, unidade, **faixa do laudo**) e ganha o valor na unidade canônica.
A bandeira (acima/na faixa/abaixo) é decidida pela faixa do **próprio laudo**: o mesmo 101 mg/dL pode estar na faixa
em um laboratório e acima em outro.

- **SQL:** views `observation_series` e `timeline_events` (`security_invoker`: o RLS vale para quem consulta, então o
  paciente vê o dele e o médico só o que o consentimento cobre). `supabase/migrations/..._series_and_timeline_views.sql`.
- **Referência em Python** (`app/services/normalization/series.py`, Decimal): o hash das 75 leituras do seed é igual ao da view
  SQL no banco real (`tests/test_demo_data.py`).
- **Front** (`apps/web`, React + Vite + TypeScript): gráfico SVG com uma barra de faixa por ponto, lista de exames e linha do tempo.
  Hoje lê `src/demo/marta.json` (sintético, gerado por `scripts/build_demo_data.py`); o adaptador do Supabase usa as mesmas colunas.

```bash
cd apps/web && npm install && npm run dev      # http://localhost:5173
npm test                                        # testes (lógica + SVG + telas)
python scripts/build_demo_data.py               # regenera os dados de demonstração
```

## Fases

0. Esqueleto de ponta a ponta · 1. Schema + seed · 2. Teste da extração · 3. Extração completa · 4. Normalização + linha do tempo · 5. Wearables + alertas · 6. Consentimento + visão do médico · 7. Endurecer a demo
