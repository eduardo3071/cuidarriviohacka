# Roteiro da demonstração (10 min) e plano B

Dados 100% sintéticos: paciente **Marta Albuquerque Lima**, médico **Dr. Henrique** (fictício).

## Modo apresentação (botão "Apresentar")

Um passo a passo guiado para o pitch do software, **sem login, sem banco e sem API** (dados sintéticos, funciona offline). É o plano B natural do roteiro abaixo e também um bom guia de ensaio.

**Como abrir:** em **Ver demonstração**, clique em **Apresentar** (na barra superior; no celular é só o ícone ▶). Ou abra direto `http://localhost:5173/apresentar`
(para ensaiar um trecho: `/apresentar?passo=6`). Offline: `python scripts/dev.py --offline`.

**Links diretos por aba** (demonstração da Marta, sem login nem cadastro): `/inicio`, `/exames`, `/exames/linha-do-tempo`, `/enviar`, `/alertas`, `/privacidade` (apelido `/acessos`). A URL acompanha a aba e o botão voltar do navegador funciona. Em hospedagem estática, o servidor precisa devolver o `index.html` para esses caminhos (já configurado em `apps/web/vercel.json`).

**Como conduzir:** o painel diz **o que falar** em cada passo e **qual gargalo da Rivio ele resolve**; a tela mostra a parte certa e destaca em âmbar o que você está explicando.
| Tecla | Faz |
|---|---|
| `→`, `Espaço`, `PageDown` | próximo passo |
| `←`, `PageUp` | voltar |
| `Home` / `End` | primeiro / último passo |
| `Esc` | sair da apresentação |

No painel: **Próximo/Voltar**, ⇄ para mover o painel de lado (no computador ele já escolhe sozinho o canto que menos cobre o destaque), ⌄ para recolher e ✕ para sair.

| # | Passo (caminho da Marta) | Tela | Tempo |
|---|---|---|---|
| 1 | Uma paciente, vários laboratórios | Início | 30 s |
| 2 | Cada valor contra a faixa do próprio laudo | Início | 40 s |
| 3 | O papel vira dado, com a confirmação dela | Enviar laudo | 45 s |
| 4 | O mesmo exame, vários laboratórios, uma série só | Exames | 45 s |
| 5 | Tudo na mesma linha do tempo | Linha do tempo | 25 s |
| 6 | Alertas que orientam, sem diagnosticar | Alertas | 40 s |
| 7 | Ela decide quem vê, o quê e por quanto tempo | Privacidade | 40 s |
| 8 | O médico vê só quem liberou | Médico | 25 s |
| 9 | Um resumo clínico, somente leitura | Médico | 40 s |
| 10 | O que está pronto e o que vem a seguir | Início | 30 s |

Total sugerido: **6 min** (cabe na parte de software de um pitch de 10 min). Os números das falas (resultados, laboratórios, amostras, alertas) vêm dos dados, não são digitados à mão,
e o passo 10 é honesto sobre os limites (foto/OCR e IA hospedada sem teste real, regras de alerta sem revisão clínica, relógio ainda sem tempo real).

**Limites do modo:** é uma demonstração com dados sintéticos e nada é gravado em banco. Com a API local no ar (`python scripts/dev.py`), as abas **Enviar laudo** e **Privacidade e acessos** funcionam de verdade na tela de demonstração:
- **Enviar laudo** roda a leitura REAL em Python (texto do PDF; OCR/OpenCV para foto, ~20 s). Sugestões: `data/synthetic/marta/exams/demo_upload_2026-11.pdf` e `aurora_2023_foto.jpg`. As leituras confirmadas entram na paciente e na linha do tempo, só na memória do navegador (somem ao recarregar).
- **Privacidade e acessos** é simulada (médicos fictícios, um acesso ativo e histórico de aberturas); liberar, revogar e o registro funcionam como na tela real, mas só na memória. Só o roteiro ao vivo abaixo exercita o banco de verdade.
No celular o painel cobre parte da tela; recolha com ⌄ para ver tudo.

## Antes de subir ao palco (15 min antes)

1. `python scripts/dev.py` roda o pré-voo e sobe API e front. Leia os avisos: dizem o que cai no plano B.
2. Senhas das duas contas definidas por você (`python scripts/set_demo_password.py <email>`).
3. Gere o PDF de demonstração, se ainda não existir (`python scripts/make_demo_upload.py`), e desfaça um ensaio anterior com
   `python scripts/reset_demo_upload.py` (remove só esse laudo, com as leituras e os arquivos dele).
4. Comece do zero: entre como Marta, aba *Privacidade e acessos*, e revogue qualquer acesso ativo
   (o pré-voo mostra quantos há: "Consentimentos ativos agora").
5. Abra o front **já logado** numa aba e o modo demonstração (`Ver demonstração`) em outra: a segunda é o seguro.
6. Wi-Fi do local é o ponto fraco. Se cair, pare e rode `python scripts/dev.py --offline` (30 s).

## Roteiro

| Tempo | O que mostrar | O que dizer (a ideia) |
|---|---|---|
| 0:00 | Slide do problema | O histórico de saúde está espalhado em papéis e PDFs de laboratórios que não conversam. |
| 1:00 | Login como **Marta** → *Exames* → Glicemia de jejum | Três laboratórios, unidades diferentes, uma série só. Cada ponto é comparado com a **faixa impressa no próprio laudo**, não com um número genérico. Clique num ponto: veja o valor original, a unidade original e a conversão. |
| 2:45 | *Linha do tempo* (filtros) | Consultas, remédios, vacinas e exames na mesma linha. Se faltar tempo, corte este passo. |
| 3:30 | *Relógio e alertas* → abrir um alerta | Regras fixas, não IA. Cada alerta mostra **por que disparou** (valor, janela, linha de base). Nunca diagnostica: orienta procurar um médico. |
| 5:00 | *Enviar laudo* → arquivo `data/synthetic/marta/exams/demo_upload_2026-11.pdf` | O papel vira dado: em cerca de 10 s o sistema lê 11 resultados. Mostre a **conferência**: o quadro vermelho na imagem do laudo marca onde cada valor foi lido, e a pessoa corrige antes de guardar. Nada entra no histórico sem a confirmação dela. Clique em *Guardar*. |
| 6:15 | Voltar a *Meus dados* → Glicemia de jejum | Apareceu um ponto novo (12/11/2026), na mesma unidade e contra a faixa do próprio laudo. |
| 6:45 | *Privacidade* → liberar para **Dr. Henrique**, **só Exames**, 7 dias | Nada é compartilhado sem permissão: ela escolhe quem, o quê e por quanto tempo. |
| 7:30 | Sair → entrar como **Dr. Henrique** | Só vê Marta, só vê Exames, somente leitura (inclui o laudo novo). *Relógio e alertas* vem vazio: o banco não entrega, não é só a tela que esconde. |
| 8:45 | Sair → Marta → *Quem abriu os seus dados* | A abertura do médico ficou registrada. Clique em **Revogar acesso**. |
| 9:30 | Entrar de novo como Dr. Henrique | Marta sumiu da lista. Revogar vale na hora. |
| 9:50 | Fechamento | Próximos passos: leitura de fotos de laudo, mais wearables, integração com laboratórios. |

## O que NÃO prometer ao vivo

- **Só use o PDF de demonstração** (`demo_upload_2026-11.pdf`). Os outros 3 laudos sintéticos já estão no histórico (o seed usa os mesmos
  valores): enviá-los duplicaria pontos no gráfico.
- **Leitura de foto de laudo**: o OCR é local e fica desligado por padrão (`OCR_ENABLED=false`). Foi testado só com laudos sintéticos.
  Não envie foto ao vivo. O PDF com texto funciona sem OCR e sem IA.
- **IA no upload**: precisa da `ANTHROPIC_API_KEY` no `.env` (hoje vazia). Sem ela, a leitura usa só o texto do PDF, o que basta para o PDF da demo.
- Os limiares dos alertas ainda não passaram pela revisão do enfermeiro: apresente como "regras ajustáveis", não como critério clínico validado.

## Se algo falhar

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Login responde "E-mail ou senha incorretos." | Senha não definida ou digitada errada | Redefinir com `set_demo_password.py` |
| "Enviar laudo" na demonstração dá erro de leitura/API | API local fora do ar ou sem `DEMO_EXTRACT_ENABLED` | Suba com `python scripts/dev.py` (liga as rotas `/demo/*` e o OCR). Foto leva ~20 s no OCR; PDF é instantâneo |
| Telas em branco após login | Sem internet / Supabase fora | `Ver demonstração` ou `dev.py --offline` |
| *Enviar laudo* diz "Não consegui falar com a API" | API não subiu (ou usou `--no-api`) | `python scripts/dev.py` (sem `--no-api`); veja `.dev-logs/api.log` |
| Envio diz "já foi enviado e guardado antes" | O laudo da demo já está no histórico | `python scripts/reset_demo_upload.py` e envie de novo |
| Leitura "demora mais que o normal" (3 min) | API travada ou o arquivo não é o PDF da demo | Pule este passo e siga para *Privacidade* |
| `dev.py` diz que a porta está em uso | Sobrou um processo da última execução | Feche o terminal anterior; confira `.dev-logs/` |
| Médico vê "Nenhum paciente liberou" | Consentimento revogado ou vencido | Liberar de novo na conta da Marta |
