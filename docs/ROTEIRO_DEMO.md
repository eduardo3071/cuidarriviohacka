# Roteiro da demonstração (10 min) e plano B

Dados 100% sintéticos: paciente **Marta Albuquerque Lima**, médico **Dr. Henrique** (fictício).

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
| Telas em branco após login | Sem internet / Supabase fora | `Ver demonstração` ou `dev.py --offline` |
| *Enviar laudo* diz "Não consegui falar com a API" | API não subiu (ou usou `--no-api`) | `python scripts/dev.py` (sem `--no-api`); veja `.dev-logs/api.log` |
| Envio diz "já foi enviado e guardado antes" | O laudo da demo já está no histórico | `python scripts/reset_demo_upload.py` e envie de novo |
| Leitura "demora mais que o normal" (3 min) | API travada ou o arquivo não é o PDF da demo | Pule este passo e siga para *Privacidade* |
| `dev.py` diz que a porta está em uso | Sobrou um processo da última execução | Feche o terminal anterior; confira `.dev-logs/` |
| Médico vê "Nenhum paciente liberou" | Consentimento revogado ou vencido | Liberar de novo na conta da Marta |
