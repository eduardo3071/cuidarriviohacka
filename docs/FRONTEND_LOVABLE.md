# Plano de fases do front (redesign de UX/UI no Lovable, desktop e celular)

Objetivo: o produto já funciona de ponta a ponta; o que falta é **parecer um produto de saúde confiável, em qualquer tela**. O Lovable
refaz a camada visual; a lógica, os dados e a segurança **não mudam**.

> **Prazo:** a demo é hoje (sábado 14/11) e roda na interface atual, que está testada. Este plano é a **próxima iteração**.

## Acompanhamento: o que já foi enviado ao Lovable

Marque aqui a cada passo. **✅ = confirmado pelas suas capturas de tela ou pela conversa do Lovable.**

| Passo | O que é | Enviado | Aprovado |
|---|---|---|---|
| Contexto 1, 1B, 1C, 2, 2B, 2C | Regras, celular, direção de arte, contratos, componentes, textos fixos | ✅ | n/a |
| **Contexto 3** | **Mapa visual global (medidas, casco, receitas de componentes, cores por token)** | [ ] | n/a |
| Fase 0 | Fundação visual e guia de estilo | ✅ | ✅ (o Lovable chama de "visual aprovado") |
| **Fase 1 (refazer)** | Login: a v1 foi entregue; refazer com o mapa | ✅ v1 | [ ] v2 |
| Fase 1B | Primeiro acesso | [ ] | [ ] |
| Fase 2 | Início e Exames | [ ] | [ ] |
| Fase 3 | Linha do tempo, relógio e alertas | [ ] | [ ] |
| Fase 4 | Enviar laudo e conferência | [ ] | [ ] |
| Fase 5A | Privacidade (paciente) | [ ] | [ ] |
| Fase 5B | Médico: lista e resumo clínico | [ ] | [ ] |
| Fase 6 | Revisão para celular | [ ] | [ ] |
| Fase 7 | Polimento | [ ] | [ ] |
| Fase 8 | Verificação e fechamento | (comigo) | |

**Próximo passo:** enviar o **Contexto 3** (uma vez) e depois refazer a **Fase 1**.

## Como usar

1. **Envie o Contexto 3 uma vez** (próxima seção). Ele fixa as medidas, o casco do app e a cor de cada componente. Depois, cada fase traz só o **mapa da própria tela**.
2. **Uma fase por vez.** Cole o prompt da fase, confira com o **Aceite** e com a tabela de testes da seção 1C, marque no quadro.
3. Cada prompt termina pedindo um **mapa de conformidade** (elemento → token de cor → valor). Use-o para conferir o que o Lovable fez contra o que foi pedido.
4. Se o Lovable desviar, **reenvie só o bloco do mapa daquela tela** com uma frase: "o formulário está esticado; corrija conforme o mapa".

### O Lovable está ligado ao repositório (GitHub). Cuidado com isto

Pelas suas capturas, o Lovable edita o repositório de verdade (ele rodou os testes e disse "118 testes aprovados"). Isso é bom, mas exige uma trava. O Contexto 3 inclui a regra:
**só apresentação** (`src/components`, `src/pages`, `src/auth/Login.tsx`, estilos). **Proibido alterar** `src/data`, `src/lib`, `src/auth/useAuth.ts`, `src/auth/messages.ts`,
`src/config.ts`, `src/test`, `src/live`, `vite.config.ts` e os testes existentes, que devem continuar passando.

**Antes de continuar:** o Lovable grava no GitHub e o seu repositório local também tem commits (inclusive este documento, ainda sem commit). Para não gerar conflito, avise quando o Lovable commitar:
eu faço `git pull` do remoto, rodo os testes e a verificação ao vivo (Fase 8).

---

# Contexto 3 — Mapa visual global (envie UMA vez, antes da Fase 1)

Define as medidas, o casco do app (barras e navegação) e a receita de cada componente, com **o token de cor de cada propriedade**. Os nomes dos tokens são variáveis CSS.
Tudo em pixels. "Celular" é abaixo de 1024 px de largura; "computador" é de 1024 px para cima.

```text
MAPA VISUAL GLOBAL (vale para todas as telas). Siga exatamente. Medidas em px. Tokens = variáveis CSS (--bg, --surface...).

REGRA DO REPOSITÓRIO: altere SOMENTE apresentação (src/components, src/pages, src/auth/Login.tsx, estilos). NÃO altere src/data, src/lib, src/auth/useAuth.ts, src/auth/messages.ts,
src/config.ts, src/test, src/live, vite.config.ts nem os testes existentes. Os testes devem continuar passando. Não conecte backend novo.

1) TOKENS → VALORES (claro | escuro)
 bg #F7F4EC | #0A1F1E      surface #FFFFFF | #102B29      surface-2 #FBF8F1 | #153634      line #E6DFCF | #234542
 ink #0E2B2A | #EAF3F1     ink-2 #4A6360 | #9FBAB6
 brand #0B4F4A | #4FD1B8   brand-on #FFFFFF | #052320     brand-soft #DDF0EA | #123F3A
 amber #F59E0B | #F5B13D   amber-ink #8A4B00 | #F5B13D
 up-fg #A33E08 | #FFB584   up-bg #FDEBDD | #3A2214        down-fg #1E40AF | #9DB8FF    down-bg #E4ECFD | #16264F
 in-fg #0A6A5C | #7BE0C8   in-bg #DDF3EC | #0F3A34        none-fg #546461 | #A9B9B6    none-bg #EDF0EF | #1B2B29
 info-fg #2F5D7C | #A9CDE8 info-bg #E3EEF5 | #14303F      warn-fg #8A5300 | #F5C76B    warn-bg #FEF0CC | #3A2D0B
 urg-fg #9B1C1C | #FF9E9E  urg-bg #FDE4E4 | #3F1717        overlay rgba(14,43,42,.45) | rgba(0,0,0,.6)
 sombra do cartão: 0 1px 2px rgba(14,43,42,.06), 0 8px 24px rgba(14,43,42,.06)  (escuro: 0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.3))
 "selo" = fundo: 16% de amber sobre surface (color-mix), texto amber-ink.

2) TIPOS (família / tamanho celular-computador / peso / entrelinha)
 hero  Playfair Display 44/64 700 1.05      title Playfair Display 28/36 700 1.15      section Playfair Display 22/26 700 1.2
 body  Inter 16/17 400 1.5                  label Inter 16 600 1.4                      caption Inter 14 500 1.4 (cor ink-2)
 num (valores) Inter 20 700, tabular-nums.  Nada abaixo de 14 px (13 só nos rótulos do eixo dos gráficos).

3) GRADE E CASCO
 CELULAR (375 de referência): margem lateral 16, largura útil 343, espaço vertical 16 entre blocos e 24 entre seções.
   Barra superior y0–56 (fixa) · Faixa do selo y56–88 (fixa) · conteúdo começa em y88 com padding-top 16 · Barra inferior: 64 + área segura (colada no fundo, fixa).
   O conteúdo rola entre as duas barras; padding-bottom = 88 (112 quando há barra de ação fixa).
 COMPUTADOR (1280 de referência): barra lateral x0–248 (fixa). Principal x248–1280 (1032). Barra superior do principal: altura 72, padding x 32, fixa.
   Conteúdo: padding 32 (largura útil 968), grade de 12 colunas com espaço 24 (span 7 ≈ 555 · span 5 ≈ 389 · span 4 ≈ 307 · span 8 ≈ 713 · span 4 de 12 ≈ 307).
 TABLET (768): usa o casco do celular, conteúdo centralizado em 720.

4) CASCO (posições e cores)
 Barra superior (celular): fundo bg; borda inferior 1 line (só quando rola). Esquerda x16: logotipo atual (ícone 28×28, fundo brand, glifo brand-on) + nome em Playfair 700 18, cor ink.
   Direita x359: botão de conta 44×44, círculo, fundo surface-2, borda 1 line, ícone user 20 cor ink-2.
 Faixa do selo (celular): largura total, altura 32, fundo = selo, texto "Dados sintéticos de demonstração" caption 14/600 cor amber-ink, centralizado.
 Barra inferior (celular): fundo surface, borda superior 1 line. 5 colunas iguais (75 de largura): Início, Exames, Enviar, Alertas, Acessos.
   Item: ícone 22 sobre rótulo caption 14/500. Inativo: ícone e texto ink-2. Ativo: texto brand 700; ícone brand dentro de pílula 52×32 fundo brand-soft.
   "Enviar": círculo 44×44 fundo brand, ícone brand-on, elevado 14 acima da linha da barra, com a sombra do cartão; rótulo abaixo. Quando ativo, rótulo brand 700.
 Barra lateral (computador): largura 248, fundo surface, borda direita 1 line. Topo (altura 72, padding 24): logotipo 32 + nome Playfair 700 22 ink.
   Itens (altura 44, raio 12, padding x 12, espaço 12, ícone 20, texto label 16): inativo texto ink-2 500; ativo fundo brand-soft, texto e ícone brand 700; hover fundo surface-2.
   Itens do paciente: Início, Exames, Enviar laudo, Alertas, Privacidade e acessos. Médico: só "Meus pacientes". Nenhum botão cheio na barra lateral.
 Barra superior (computador): fundo bg, borda inferior 1 line. Esquerda: título da página (title 28 ink). Direita: selo (altura 28) + botão de conta 44×44 como no celular.

5) RECEITAS DE COMPONENTES (cada propriedade → token)
 Botão (altura 48, raio 12, padding x 20, Inter 600 16, ícone 20, espaço 8, foco: contorno 3 brand com afastamento 2)
   cheio: fundo brand · texto e ícone brand-on · sem borda.   contorno: fundo transparente · borda 1.5 brand · texto brand.
   perigoso (contorno): fundo transparente · borda 1.5 urg-fg · texto urg-fg.   perigoso cheio: fundo urg-fg · texto #FFFFFF (claro) / #3F1717 (escuro).
   link: altura 44, sem fundo, texto brand, sublinhado com afastamento 3.   desabilitado: fundo line · texto ink-2.
 Cartão: fundo surface · borda 1 line · raio 16 · sombra do cartão · padding 16 (celular) / 20 (computador). Cartão interno de lista: igual, SEM sombra.
 Chip de estado: altura 28, raio 999, padding x 10, caption 14/600, ícone 16, espaço 6. Cores: acima = up-fg sobre up-bg (ícone seta p/ cima) · abaixo = down-fg sobre down-bg (seta p/ baixo)
   · dentro = in-fg sobre in-bg (check) · sem faixa = none-fg sobre none-bg (traço). Chip neutro (categoria): fundo brand-soft · texto e ícone brand.
 Chip de severidade: mesma forma. info = info-fg/info-bg · atenção = warn-fg/warn-bg · urgente = urg-fg/urg-bg (sempre com ícone e texto).
 Campo: altura 48, raio 12, fundo surface, borda 1 line, texto ink 16, placeholder ink-2. Foco: borda 2 brand. Erro: borda 2 urg-fg + mensagem caption urg-fg com ícone. Rótulo acima: label ink, espaço 8.
 Régua da faixa: largura 100% do bloco, trilho altura 12, raio 999, fundo = line a 70%. Faixa do laudo: fundo brand-soft, contorno interno 1.5 brand a 40%. Ponto 20×20, fundo = cor do estado (fg), borda 3 surface,
   anel externo 2 na cor do estado. Posição do ponto limitada a 4%–96%.
 Controle segmentado: altura 48, fundo surface-2, borda 1 line, raio 12, padding 4. Item: altura 40, raio 8. Ativo: fundo surface, sombra do cartão, texto ink 600. Inativo: texto ink-2 500.
 Chip de filtro: altura 40, raio 999, padding x 14. Inativo: fundo surface, borda 1 line, texto e ícone ink-2. Ativo: fundo brand-soft, borda 1.5 brand, texto brand 600, ícone check brand.
 Folha de baixo: fundo surface, raio 24 24 0 0, alça 40×4 raio 999 cor line (centralizada, y8), padding 16 + área segura, fundo da tela atrás = overlay. Diálogo (computador): largura 440, raio 16, mesma cor.
 Faixa de aviso (somente leitura, nota): raio 12 (celular largura total), padding 12 16, ícone 20; info: info-fg sobre info-bg.
 Toast: acima da barra inferior (64 + 12), largura 343, raio 12, fundo ink, texto bg (invertido) 16/600, ícone 20.
 Esqueleto: fundo line a 60%, mesmo raio do componente, sem animação em loop.
 Ícones: Lucide, traço 1.75, 20 ou 24.

6) AO TERMINAR cada pedido: imprima o MAPA DE CONFORMIDADE (tabela: elemento → token de cor usado → valor computado) e liste qualquer elemento que ficou diferente do mapa.
```

---

# Fases (cada prompt traz o mapa da própria tela)

> Cada prompt supõe o **contexto já enviado** (1, 1B, 1C, 2, 2B, 2C) e o **Contexto 3**. Nos mapas, os nomes dos tokens são os do Contexto 3.
> As alturas marcadas "auto" resultam do conteúdo; as fixas estão em número.

## Fase 1 — Login (refazer)
**Observado na entrega v1:** as cores, o ícone dos benefícios e o botão cheio estão certos. **Corrigir:** (1) no computador o formulário está esticado na largura toda, e o cartão deve ter 440; (2) no computador deve haver duas colunas; (3) manter o logotipo atual.
**Entrega:** Login conforme o mapa. **Aceite:** a 1280 px o cartão tem 440 de largura, centralizado na coluna direita; a 375 px cabe sem rolar; nenhum campo abaixo de 48 de altura.

```text
FASE 1 (REFAZER): LOGIN. Ajuste o Login existente ao mapa abaixo. Mantenha o formulário, as validações, o botão "Ver demonstração" e o logotipo atual. Só muda a apresentação.
Estados: carregando (botão com spinner brand-on, desabilitado), erro de credencial, erro de rede ("Sem conexão com o servidor. Verifique a internet e tente de novo."), validação ("Informe um e-mail válido.", "Informe a senha.").

CELULAR 375×812 (sem barras do casco; página inteira rola)
 y24–56    Logotipo (ícone 32 + nome Playfair 700 22, ink), alinhado à esquerda, x16
 y80       Título "Seu histórico de saúde, organizado e só seu" (title 28/36, ink), até 3 linhas (≈108)
 y204      Três benefícios, cada linha de altura 32: ícone 20 (brand) + texto body 16 (ink-2); espaço 8: "Organiza exames de papel e PDF" · "Mostra cada resultado contra a faixa do próprio laudo" · "Você decide quem pode ver"
 y324      Cartão do formulário (largura 343, padding 20, SEM sombra): "Entre na sua conta" (section 22, ink) → 20 → Rótulo "E-mail" → 8 → Campo (48) → 16 → Rótulo "Senha" → 8 → Campo (48)
           → 8 → área da mensagem de erro (24 reservados) → Botão cheio "Entrar" (48, largura total). Cartão termina ≈ y674.
 y690      Link "Ver demonstração com dados sintéticos" (altura 44, centralizado, texto brand, sublinhado)
 Fundo da página: degradê vertical bg → brand-soft de y0 a y320, depois bg liso.

COMPUTADOR 1280×800 (duas colunas, altura total, sem barra lateral)
 Coluna esquerda x0–640: fundo = degradê 180° de bg a brand-soft; padding 64. Logotipo em x64 y64 (ícone 32 + nome 22).
   Título hero 64/67 (Playfair 700, ink), largura 512, x64, começa em y168 (≈4 linhas). Benefícios em x64 a partir de y468 (cada linha 40, ícone 24 brand, texto 18 ink-2).
   Selo (altura 28) em x64 y704: "Dados sintéticos de demonstração".
 Coluna direita x640–1280: fundo bg. Cartão do formulário: largura 440, centralizado na coluna (x740–1180), centralizado na vertical (≈ y170–630), padding 32, COM sombra.
   Conteúdo igual ao celular. Link "Ver demonstração..." logo abaixo do cartão (espaço 16), centralizado.

MAPA DE CORES
 Elemento                    | Fundo                  | Texto          | Borda                 | Ícone
 Página (celular)            | bg (+ degradê no topo) | —              | —                     | —
 Coluna esquerda (computador)| degradê bg→brand-soft  | —              | —                     | —
 Logotipo: ícone             | brand                  | —              | —                     | brand-on
 Nome da marca / título      | —                      | ink            | —                     | —
 Benefícios                  | —                      | ink-2          | —                     | brand
 Cartão do formulário        | surface                | —              | 1 line                | —
 Título do cartão / rótulos  | —                      | ink            | —                     | —
 Campo                       | surface                | ink (ph: ink-2)| 1 line (foco 2 brand) | —
 Campo com erro              | surface                | ink            | 2 urg-fg              | —
 Mensagem de erro            | urg-bg (raio 8, 8 12)  | urg-fg         | —                     | urg-fg
 Botão Entrar (cheio)        | brand                  | brand-on       | —                     | brand-on
 Link demonstração           | —                      | brand          | —                     | —
 Selo (computador)           | selo                   | amber-ink      | —                     | —
```

## Fase 1B — Primeiro acesso
**Entrega:** a tela do paciente novo, sem exames. **Aceite:** um botão cheio só; a pessoa sabe o que fazer em 5 s.

```text
FASE 1B: PRIMEIRO ACESSO (paciente sem nenhum resultado, no lugar do vazio atual). Dentro do casco (Contexto 3), item ativo "Início". Props: patientName, onSendFirst(), onDemo().

CELULAR 375×812 (a partir de y88)
 y88–232   Bloco quente (largura total, altura 144, degradê bg→brand-soft): saudação "Olá, {nome}" (title 28, ink) em x16 y112; abaixo "Vamos montar o seu histórico" (body 16, ink-2)
 y216      Cartão "3 passos" (343, padding 20, sobrepõe 16 do bloco quente): título "Como começar" (section 22, ink) → 16 → três passos, cada um com altura 72, ligados pelo FIO:
           fio vertical em x36 (2.5 px, brand) passando pelos centros; ponto 28 (círculo, fundo surface, borda 3 brand) com o número 14/700 brand; texto em x80:
           título 16/600 ink + caption ink-2. 1 "Envie um laudo" (PDF ou foto) · 2 "Confira o que foi lido" · 3 "Escolha se quer compartilhar com um médico"
 abaixo    16 → Botão cheio "Enviar o primeiro laudo" (48, largura 343) → 8 → Link "Ver como fica (demonstração)" (44, centralizado)

COMPUTADOR (conteúdo x280–1248, abaixo da barra superior de 72)
 Linha 1: bloco quente largura 968, altura 120, raio 24, degradê; saudação (title 28) em x32.
 Linha 2 (grade 12): esquerda span 7 (≈555): cartão dos 3 passos (padding 24, como no celular, passos de altura 80); abaixo dele (espaço 16), na mesma linha: botão cheio "Enviar o primeiro laudo" (largura automática, altura 48) e, à direita dele, o link "Ver como fica (demonstração)".
                     direita span 5 (≈389): cartão de ilustração 389×320, raio 24, fundo brand-soft, sem borda: um fio curvo (2.5 brand) atravessando 3 círculos de 56 (fundo surface, ícone 24 brand: file-text, check, shield).

MAPA DE CORES
 Elemento                | Fundo           | Texto        | Borda     | Ícone
 Bloco quente            | degradê bg→brand-soft | ink / ink-2 | —     | —
 Cartão dos passos       | surface         | ink          | 1 line    | —
 Fio                     | —               | —            | linha 2.5 brand | —
 Ponto do passo          | surface         | brand (nº)   | 3 brand   | —
 Texto do passo (título / apoio) | —       | ink / ink-2  | —         | —
 Botão "Enviar o primeiro laudo" | brand   | brand-on     | —         | brand-on
 Link demonstração       | —               | brand        | —         | —
 Cartão de ilustração    | brand-soft      | —            | —         | brand (círculos: fundo surface)
```

## Fase 2 — Início e Exames
**Entrega:** tela **Início** e tela **Exames** (lista e exame). **Aceite:** em 10 s se vê "o que merece atenção"; a régua aparece em toda lista e cartão; só 1 botão cheio por tela.

```text
FASE 2: INÍCIO E EXAMES. Dentro do casco do Contexto 3. Props: as do contrato (BiomarkerList, SeriesChart, PointDetail, RangeRuler, DataTable). Dados reais da Marta.

=== INÍCIO (aba "Início") ===
CELULAR (a partir de y88, itens em pilha, espaço 16)
 Bloco quente: y88–232 (altura 144, degradê bg→brand-soft). Saudação "Olá, {nome}" (title 28, ink) x16 y112; "Veja o que merece atenção hoje." (body 16, ink-2).
 Cartão de atenção: y200 (sobrepõe 32 do bloco quente), largura 343, raio 16, padding 16, fundo warn-bg, SEM borda e sem sombra. Linha 1: ícone bell 24 + título 17/700 "{n} sinais do relógio merecem atenção" (warn-fg).
   Linha 2: "Regras fixas, não IA. Converse com um médico." (body 16, warn-fg). Linha 3: link "Ver por quê" (altura 44, warn-fg, sublinhado).
 Linha de números (3 cartões iguais, largura 103, altura 96, espaço 16, padding 12): número Playfair 700 28 (ink) + legenda caption 14 (ink-2): "{n} resultados" · "{n} laboratórios" · "{n} alertas de atenção". Dados reais.
 Seção "Fora da faixa do laudo" (section 22, ink), margem superior 24.
 Lista de 3 cartões de exame (espaço 12), cada um: padding 14 16, altura ≈116. Linha 1: nome (label 16/600 ink, até 2 linhas) à esquerda; valor (num 20/700 ink) + unidade (caption ink-2) à direita.
   Linha 2 (espaço 10): régua da faixa. Linha 3: chip de estado curto à esquerda; à direita caption ink-2 "faixa 70 a 110".
 Botão cheio "Enviar um laudo" (48, 343), margem superior 16. Depois padding-bottom 88.

COMPUTADOR (conteúdo x280–1248; barra superior com o título "Início")
 Linha 1 (y104): bloco quente largura 968, altura 120, raio 24, degradê; saudação (title 28) em x32.
 Linha 2: três cartões de número (span 4 ≈307 cada, altura 112, padding 20): número hero 44 (Playfair 700, ink) + legenda caption.
 Linha 3 (grade 12): esquerda span 7 (≈555): cartão "Fora da faixa do laudo" (padding 20; título section 22) com 4 linhas de exame separadas por 1 line (sem cartão interno): nome + valor, régua, chip + faixa.
                     direita span 5 (≈389), pilha com espaço 24: (a) cartão de atenção (warn-bg, como no celular); (b) cartão "Último exame guardado" (surface): caption "Último exame guardado", "{n} resultados" (title 28), caption data e laboratório, e o botão cheio "Enviar um laudo" (48, largura total).

=== EXAMES (aba "Exames") ===
CELULAR, lista (a partir de y88)
 Título "Exames" (title 28, ink) y104. Controle segmentado [Exames | Linha do tempo] (48, largura 343) y152, "Exames" ativo.
 Categoria: rótulo caption 14/600 ink-2 em maiúsculas com espaçamento 0.08em, margem superior 24. Cartões de exame (espaço 12), cada um padding 14 16: linha 1: nome (label 16/600 ink) + chevron 20 (ink-2) à direita;
   linha 2: caption ink-2 "{categoria} · {data}"; linha 3: valor (num 20/700 ink) + unidade (caption ink-2); linha 4: régua; linha 5: chip curto.
CELULAR, exame (empilhada sobre a lista; botão voltar)
 y100–144 link "‹ Exames" (altura 44, brand 600). Título do exame (title 28, ink). Frase fixa "Todos os resultados na mesma unidade ({unidade}), mesmo vindos de laboratórios e unidades diferentes." (body 16, ink-2).
 Cartão de destaque (padding 16): valor hero 44 (Playfair 700, ink) + unidade (body 16, ink-2) ao lado; chip de estado COMPLETO (ex.: "acima da faixa do laudo"); régua (margem 12); caption ink-2 "Laboratório · data · faixa impressa no laudo: 70 a 110".
 Cartão do gráfico (padding 16): gráfico largura 311, altura 240; legenda ABAIXO (caption 14 ink-2: forma de cada laboratório, faixa do laudo, fora da faixa).
 "Todos os resultados" (section 22) → cartões por ponto (espaço 12): data (label 16/600 ink) + laboratório (caption ink-2); "No laudo: 5,5 mmol/L" e "= 99,1 mg/dL" (caption ink-2, o convertido em ink 600); chip curto. Tocar abre a FOLHA DE DETALHE.
 Folha de detalhe: título "Resultado de {data}" (section 22, ink); pares rótulo (caption ink-2, esquerda) / valor (label 16/600 ink, direita): Valor no laudo · Unidade no laudo · Valor convertido · Laboratório · Faixa impressa no laudo; régua; chip completo; link "Fechar" (44).
COMPUTADOR (conteúdo x280–1248; barra superior com o título "Exames")
 Grade `360px 1fr`, espaço 24. Esquerda: cartão-lista (surface, borda 1 line, raio 16, padding 12, altura = tela − 72 − 64, rola por dentro): rótulos de categoria (caption ink-2) e linhas de exame (altura ≈ 96, raio 12, padding 12):
   nome (label 16/600 ink) + valor (16/700 ink) à direita; régua; chip curto + data. Linha selecionada: fundo brand-soft.
 Direita (pilha, espaço 24): cabeçalho: título do exame (title 36, ink) à esquerda e chip COMPLETO à direita; frase fixa (body 16, ink-2); cartão do gráfico (padding 24, gráfico altura 320, legenda abaixo);
   depois, em duas colunas (40% | 60%, espaço 24): esquerda: cartão "Detalhe do ponto selecionado" (pares rótulo/valor + régua + chip); direita: cartão "Todos os resultados" em tabela
   (colunas: Data | Laboratório | No laudo | Convertido | Estado; cabeçalho caption ink-2 600; linhas de 52 com borda inferior 1 line; linha selecionada fundo brand-soft; Estado = chip curto).

MAPA DE CORES
 Elemento                         | Fundo                    | Texto            | Borda            | Ícone
 Bloco quente                     | degradê bg→brand-soft    | ink / ink-2      | —                | —
 Cartão de atenção                | warn-bg                  | warn-fg          | —                | warn-fg
 Cartões de número                | surface                  | ink / ink-2      | 1 line           | —
 Cartão de exame (lista)          | surface                  | ink / ink-2      | 1 line           | ink-2 (chevron)
 Linha selecionada (computador)   | brand-soft               | ink              | —                | —
 Régua: trilho / faixa / ponto    | line a 70% / brand-soft (+contorno brand 40%) / cor do estado | — | borda do ponto 3 surface | —
 Chip acima / abaixo / dentro / sem faixa | up-bg / down-bg / in-bg / none-bg | up-fg / down-fg / in-fg / none-fg | — | mesma cor do texto
 Gráfico: linha / faixa / grade   | — / brand-soft / —       | rótulos ink-2    | grade 1 line     | pontos: fundo brand, borda 2 surface; anel do estado
 Último ponto (rótulo)            | —                        | ink 700 15       | —                | —
 Controle segmentado              | surface-2 (ativo: surface) | ink 600 / ink-2 500 | 1 line        | —
 Botão "Enviar um laudo" (cheio)  | brand                    | brand-on         | —                | brand-on
 Tabela (computador): cabeçalho   | transparente             | ink-2 600 14     | 1 line (inferior)| —
```

## Fase 3 — Linha do tempo, relógio e alertas
**Entrega:** linha do tempo (dentro de Exames) e a aba Alertas. **Aceite:** o alerta de atenção parece **orientação, não erro**; cada alerta tem o gráfico de evidência e "Converse com um médico".

```text
FASE 3: LINHA DO TEMPO E RELÓGIO. Dentro do casco do Contexto 3. Props: Timeline, AlertsPanel, WearablesPanel conforme o contrato.

=== LINHA DO TEMPO (aba "Exames" > controle "Linha do tempo") ===
CELULAR (a partir de y88)
 Título "Exames" (title 28) y104; controle segmentado y152 com "Linha do tempo" ativo.
 Filtros: linha de chips de filtro (altura 40, espaço 8) que ROLA na horizontal, sem barra visível, y216: Exame · Consulta · Remédio · Vacina · Alerta (todos ativos no início).
 Ano: cabeçalho fixo ao rolar (top 88), altura 48, fundo bg, texto section 22 (ink).
 FIO: linha vertical em x28 (2.5 px, brand) do primeiro ao último evento. Ponto do evento: círculo 16 em x20–36, fundo surface, borda 3 brand (evento de alerta: borda 3 warn-fg).
 Cartão do evento: x52–359 (largura 307), padding 12 16, espaço entre cartões 12. Linha 1: ícone do tipo 20 + rótulo do tipo (caption 14/600 ink-2) à esquerda; data (caption ink-2) à direita.
   Linha 2: título (label 16/600 ink). Linha 3: detalhe (caption ink-2, até 2 linhas). Tocar abre o detalhe. Evento de alerta: cartão com fundo warn-bg, sem borda, texto e ícone warn-fg.
COMPUTADOR
 Coluna central de 720 (x280–1000) dentro do conteúdo. Controle segmentado e chips na mesma linha (esquerda controle de 320, direita os chips). Fio em x32 (dentro da coluna), pontos 16; cartões de x72 a 720 (largura 648), mesmas cores.

=== RELÓGIO E ALERTAS (aba "Alertas") ===
CELULAR (a partir de y88)
 Título "Relógio e alertas" (title 28, ink) y104. Nota (largura 343, padding 16, raio 16, fundo info-bg, SEM borda): ícone info 20 (info-fg) + texto fixo "Os alertas vêm de regras fixas sobre os dados do relógio (não de uma IA) e cada um mostra por que disparou. Eles orientam procurar um médico e não fazem diagnóstico." (caption 14/500, info-fg).
 Seção "Alertas" (section 22, ink). Cartões de alerta (espaço 12), cada um padding 16, cartão padrão: linha 1: chip de severidade (ícone + "Atenção"/"Informação"/"Urgente") à esquerda e data (caption ink-2) à direita;
   linha 2: título (17/700, ink); linha 3: mensagem (body 16, ink-2, até 2 linhas); linha 4: link "Ver por quê ›" (altura 44, brand).
 Seção "Sinais do relógio" (section 22): grade de 2 colunas (espaço 12, cada cartão largura 165.5, padding 12): nome da métrica (caption 14/600 ink-2); valor (Playfair 700 28, ink) + unidade (caption ink-2); sparkline (altura 40, largura total, linha 2 brand, ponto final 6 brand);
   caption "últimos 7 dias" (ink-2). Resuma os dados (média por dia).
 FOLHA DO ALERTA (altura 85% = ≈690): chip de severidade; título (section 22, ink); data (caption ink-2); rótulo "Por que disparou" (label 16/600 ink); linhas Regra / Valor observado / Janela (rótulo caption ink-2 em cima, valor 16/600 ink embaixo; espaço 12);
   cartão de gráfico (fundo surface-2, raio 12, padding 12): altura 200, linha da série 2.5 brand, linhas de referência TRACEJADAS 1.5 ink-2, linha de base PONTILHADA 1.5 info-fg, rótulos só na legenda abaixo (14 ink-2);
   chamada final (fundo info-bg, raio 12, padding 16): ícone 20 info-fg + "Converse com um médico" (16/700 info-fg) + caption "Este alerta orienta; não faz diagnóstico." (info-fg).
COMPUTADOR
 Grade 12: esquerda span 5 (≈389): lista de alertas (mesmos cartões, o selecionado com borda 2 brand). Direita span 7 (≈555): painel de evidência fixo (sticky top 96), cartão padding 24 com o MESMO conteúdo da folha.
 Abaixo, largura total: seção "Sinais do relógio" em grade de 3 colunas (cada ≈307).

MAPA DE CORES
 Elemento                      | Fundo                  | Texto                | Borda              | Ícone
 Nota do topo (alertas)        | info-bg                | info-fg              | —                  | info-fg
 Cartão de alerta              | surface                | ink / ink-2          | 1 line             | —
 Cartão de alerta selecionado (computador) | surface    | ink                  | 2 brand            | —
 Chip: info / atenção / urgente| info-bg / warn-bg / urg-bg | info-fg / warn-fg / urg-fg | —        | igual ao texto
 Link "Ver por quê"            | —                      | brand                | —                  | brand
 Cartão de métrica             | surface                | ink / ink-2          | 1 line             | —
 Sparkline                     | —                      | —                    | linha 2 brand      | ponto brand
 Folha do alerta               | surface                | ink / ink-2          | —                  | —
 Gráfico da evidência          | surface-2              | legenda ink-2        | —                  | série brand; referência ink-2 (tracejada); base info-fg (pontilhada)
 Chamada "Converse com um médico" | info-bg             | info-fg              | —                  | info-fg
 Linha do tempo: fio / ponto   | — / surface            | —                    | 2.5 brand / 3 brand (alerta: 3 warn-fg) | —
 Cartão de evento              | surface                | ink / ink-2          | 1 line             | brand (tipo)
 Cartão de evento de alerta    | warn-bg                | warn-fg              | —                  | warn-fg
 Chip de filtro inativo / ativo| surface / brand-soft   | ink-2 / brand 600    | 1 line / 1.5 brand | ink-2 / brand (check)
 Cabeçalho do ano (fixo)       | bg                     | ink                  | —                  | —
```

## Fase 4 — Enviar laudo e conferência
**Entrega:** fluxo em 3 passos mais sucesso e erros. **Aceite:** a pessoa entende o que foi lido, **onde** foi lido e que nada é guardado sem confirmar; só 1 botão cheio por tela.

```text
FASE 4: ENVIAR LAUDO. Dentro do casco do Contexto 3 (aba "Enviar"). Props: ReviewForm e UploadPanel conforme o contrato. Não altere a lógica de envio.

INDICADOR DE PASSOS (todas as etapas), logo abaixo do título "Enviar laudo" (title 28, ink): linha de altura 40: três passos com o FIO horizontal entre eles (flex 1, altura 14, linha 2 brand).
 Passo: círculo 26 + rótulo caption 14/600. Concluído: círculo fundo brand, ícone check brand-on. Atual: círculo brand com o número brand-on; rótulo ink. Futuro: círculo brand-soft com o número brand; rótulo ink-2.
 Rótulos: Enviar · Ler · Conferir.

=== PASSO 1: ENVIAR ===
CELULAR: botão cheio "Fotografar o laudo" (altura 56, largura 343, ícone camera 24, câmera traseira) → 12 → botão contorno "Escolher arquivo (PDF ou imagem)" (56) → caption centralizada "PDF, JPEG, PNG ou WebP, até 15 MB" (ink-2) → 16 →
 cartão de dica (fundo surface-2, borda 1 line, raio 16, padding 16): ícone lightbulb 20 (amber-ink) + "Dica de foto: boa luz, a página inteira, sem sombra." (body 16, ink). Erro de arquivo: faixa urg-bg (raio 12, padding 12 16) com texto 14/600 urg-fg e ícone.
COMPUTADOR: área de soltar, largura 720 (centralizada no conteúdo), altura 280, borda 2 TRACEJADA line, raio 16, fundo surface-2; ao arrastar: borda brand e fundo brand-soft.
 Dentro, centralizado (espaço 12): ícone upload 40 (brand), "Arraste o arquivo aqui ou clique para escolher" (18/600 ink), caption "PDF, JPEG, PNG ou WebP, até 15 MB" (ink-2), botão contorno "Escolher arquivo" (48). Abaixo, o cartão de dica.

=== PASSO 2: LENDO ===
Coluna centralizada (largura 343 / 440): spinner 48 (trilho 4 line, arco brand) → 16 → "Lendo o laudo… isso leva alguns segundos" (18/600, ink, centralizado) → 24 → três esqueletos de cartão (altura 96, raio 16, espaço 12) → link "Cancelar" (44).
Erro: cartão (fundo urg-bg, raio 16, padding 16): ícone alert-circle 24 (urg-fg) + texto (16/600 urg-fg) + botão contorno "Tentar de novo" (48).

=== PASSO 3: CONFERIR ===
CELULAR (a partir de y88; barra de ação fixa no fundo, altura 112)
 Título "Confira o que foi lido" (title 28, ink); "Nada vai para o seu histórico até você confirmar." (body 16, ink-2). Campos empilhados (espaço 16): "Laboratório" (campo 48) e "Data da coleta" (campo de data 48).
 Seção "Resultados lidos ({n})" (section 22, ink). Cartões de resultado (espaço 12; padding 14 16): linha 1: caixa 24 (marcada: fundo brand, check brand-on; desmarcada: borda 2 line) + nome (label 16/600 ink) + chip "conferir" (warn-bg/warn-fg) se baixa confiança;
   linha 2: valor (num 20/700 ink) + unidade (caption ink-2) e "faixa 70 a 110" (caption ink-2) à direita; linha 3: régua; linha 4: chip de estado curto à esquerda e links "Editar" e "Ver no laudo" (altura 44, brand, sublinhado) à direita.
   Desmarcado: fundo surface-2 e texto ink-2. Erro da linha: borda 2 urg-fg e mensagem caption urg-fg com ícone.
 Barra de ação fixa (altura 112, fundo surface, borda superior 1 line, padding 12 16): botão cheio "Guardar {n} resultados no meu histórico" (48) → 8 → link "Descartar" (36, centralizado).
 FOLHA "Ver no laudo": imagem da página (largura total da folha, raio 8, borda 1 line); caixa de destaque no ponto lido: borda 3 amber, fundo amber a 18%, raio 4 (posição = bbox 0..1); caption "O quadro marca onde “{nome}” foi lido." (ink-2).
 FOLHA "Editar": campos Nome, Valor (inputmode decimal), Unidade, Mínimo, Máximo (48, empilhados, espaço 16); botão cheio "Salvar" (48); link "Cancelar" (44).
COMPUTADOR (grade `1fr 420px`, espaço 24)
 Esquerda: campos Laboratório e Data lado a lado (cada metade); lista de linhas de resultado, cada uma um cartão interno (padding 14 16) com grade: caixa 24 | nome (campo, flex 2) | valor (campo 96) | unidade (campo 96) | mín (campo 80) | máx (campo 80);
   abaixo da grade: régua + chip de estado + chip "conferir" quando houver. Barra de ação ao final da coluna esquerda (fixa em baixo, altura 80, fundo surface, borda superior 1 line): botão cheio "Guardar {n} resultados no meu histórico" (largura automática) + link "Descartar".
 Direita (420, fixa em top 96): cartão da imagem (padding 12): imagem da página + caixa de destaque do campo em foco (borda 3 amber, fundo amber a 18%) + caption.

=== SUCESSO e REPETIDO ===
Cartão centralizado (440 / 343, padding 32): círculo 64 (fundo in-bg) com check 32 (in-fg) → "{n} resultados guardados" (section 22, ink) → caption ink-2 → botão cheio "Ver nos meus exames" (48) → link "Enviar outro" (44).
Laudo repetido: cartão padrão com chip info ("Já enviado") e o texto fixo "Este laudo já foi enviado e guardado antes. Nada foi duplicado." (body 16, ink); botão contorno "Ver nos meus exames".

MAPA DE CORES
 Elemento                         | Fundo                    | Texto          | Borda                  | Ícone
 Passo concluído / atual / futuro | brand / brand / brand-soft | brand-on / brand-on / brand | —         | brand-on (check)
 Fio entre passos                 | —                        | —              | linha 2 brand          | —
 Botão "Fotografar" / "Guardar" / "Ver nos meus exames" (cheios) | brand | brand-on | — | brand-on
 Botão contorno                   | transparente             | brand          | 1.5 brand              | brand
 Área de soltar                   | surface-2 (arrastando: brand-soft) | ink / ink-2 | 2 tracejada line (arrastando: brand) | brand
 Cartão de dica                   | surface-2                | ink            | 1 line                 | amber-ink
 Faixa de erro de arquivo         | urg-bg                   | urg-fg         | —                      | urg-fg
 Spinner                          | —                        | —              | trilho 4 line; arco brand | —
 Esqueleto                        | line a 60%               | —              | —                      | —
 Cartão de resultado              | surface                  | ink / ink-2    | 1 line (erro: 2 urg-fg)| —
 Resultado desmarcado             | surface-2                | ink-2          | 1 line                 | —
 Caixa "guardar" marcada / não    | brand / transparente     | —              | — / 2 line             | brand-on (check)
 Chip "conferir"                  | warn-bg                  | warn-fg        | —                      | warn-fg
 Links Editar / Ver no laudo      | —                        | brand          | —                      | —
 Barra de ação fixa               | surface                  | —              | 1 line (superior)      | —
 Caixa de destaque na imagem      | amber a 18%              | —              | 3 amber                | —
 Círculo do sucesso               | in-bg                    | —              | —                      | in-fg
```

## Fase 5A — Privacidade (paciente)
**Entrega:** a aba "Acessos". **Aceite:** em 5 s se vê quem tem acesso e como revogar; o botão de revogar nunca é cheio fora da confirmação.

```text
FASE 5A: PRIVACIDADE DO PACIENTE (aba "Acessos" no celular; "Privacidade e acessos" no computador). Dentro do casco do Contexto 3. Props: PrivacyView conforme o contrato.

CELULAR (a partir de y88)
 Título "Privacidade e acessos" (title 28, ink). Seção "Quem pode ver os seus dados agora" (section 22, ink).
 Cartão por médico (espaço 12, padding 16): linha 1: nome (17/700 ink) à esquerda; chip "Ativo" (in-bg/in-fg, ícone check) à direita. Linha 2: CRM (caption ink-2). Linha 3: chips neutros das categorias (brand-soft/brand, ícone), quebrando linha, espaço 8.
   Linha 4: ícone clock 16 + "até dd/mm/aaaa" (caption ink-2). Linha 5: botão PERIGOSO contorno "Revogar acesso" (48, largura total). Vazio: cartão surface-2, texto "Nenhum médico tem acesso agora." (body 16, ink-2).
 Botão cheio "Liberar para um médico" (48, 343), margem superior 8.
 Seção "Quem abriu os seus dados" (section 22). Cartões simples (padding 12 16): "{médico} abriu {categoria}" (label 16/600 ink) + caption "dd/mm/aaaa hh:mm · somente leitura" (ink-2). Linha recolhível "Acessos encerrados ({n})" (cartão altura 56, chevron ink-2).
 FOLHA "Revogar acesso?": título (section 22, ink); texto fixo "O médico perde o acesso imediatamente." (body 16, ink-2); botão PERIGOSO CHEIO "Revogar agora" (48); link "Cancelar" (44).
 ASSISTENTE "Liberar para um médico" (tela cheia sobre o casco; sem barra inferior): barra superior 56 com link "‹ Cancelar" (brand) à esquerda e "Passo {n} de 4" (caption ink-2) ao centro; abaixo (y56–88) o FIO de progresso: 4 pontos de 14 ligados por linha 2.5 brand
   (concluídos: fundo brand; atual: borda 3 brand e fundo surface; futuros: borda 2 line). Conteúdo (padding 16): pergunta (section 22, ink).
   Passo 1 escolher médico: cartões de opção (padding 16, raio 16): selecionado borda 2 brand + fundo brand-soft; não selecionado borda 1 line + fundo surface. Passo 2 o que ele pode ver: 3 cartões de caixa (Exames "resultados de laboratório" · Histórico "consultas, remédios e vacinas" · Relógio e alertas "sinais do relógio e alertas"); título 16/600 ink + caption ink-2; mesma regra de seleção.
   Passo 3 por quanto tempo: 4 cartões em grade 2×2 (7 dias, 30 dias, 90 dias, 1 ano), altura 72, mesma regra. Passo 4 revisar: cartão (surface-2) com a frase "{médico} poderá ver {categorias} até {data}." (body 16, ink) e caption "Você pode revogar quando quiser." (ink-2).
   Barra de ação fixa (altura 80, fundo surface, borda superior 1 line, padding 16): link "Voltar" (largura 96) + botão cheio "Continuar" (último passo: "Liberar acesso"), flex 1.
COMPUTADOR
 Grade 12: esquerda span 7 (≈555): seção dos médicos em cartões (1 coluna) e depois "Quem abriu os seus dados". Direita span 5 (≈389), fixo (top 96): cartão "Liberar para um médico" (padding 24) com o assistente EMBUTIDO (4 passos na vertical com o fio vertical x16; conteúdo igual ao celular; botão cheio no fim).
 Confirmação de revogar: DIÁLOGO central (largura 440) com o mesmo conteúdo da folha, fundo atrás = overlay.

MAPA DE CORES
 Elemento                          | Fundo                  | Texto          | Borda               | Ícone
 Cartão do médico                  | surface                | ink / ink-2    | 1 line              | ink-2
 Chip "Ativo"                      | in-bg                  | in-fg          | —                   | in-fg
 Chip de categoria                 | brand-soft             | brand          | —                   | brand
 Botão "Revogar acesso" (contorno perigoso) | transparente  | urg-fg         | 1.5 urg-fg          | urg-fg
 Botão "Revogar agora" (perigoso cheio)     | urg-fg        | #FFFFFF (claro) / #3F1717 (escuro) | — | igual ao texto
 Botão "Liberar para um médico" / "Continuar" (cheios) | brand | brand-on    | —                   | brand-on
 Cartão vazio                      | surface-2              | ink-2          | 1 line              | —
 Linha do log                      | surface                | ink / ink-2    | 1 line              | —
 Opção do assistente: normal / selecionada | surface / brand-soft | ink  | 1 line / 2 brand    | — / brand (check)
 Fio do assistente: concluído / atual / futuro | brand / surface / surface | — | — / 3 brand / 2 line | —
 Barra de ação fixa                | surface                | —              | 1 line (superior)   | —
 Folha / diálogo                   | surface                | ink / ink-2    | —                   | —
 Fundo atrás da folha              | overlay                | —              | —                   | —
```

## Fase 5B — Médico: lista e resumo clínico
**Entrega:** "Meus pacientes" e o **resumo clínico**, somente leitura. **Aceite:** em 10 s o médico vê o que está fora da faixa, as tendências, os sinais e os alertas; nenhum botão de edição em lugar nenhum.

```text
FASE 5B: MÉDICO (somente leitura). Dados só do contrato (SeriesPoint, Alert, WearableSample, TimelineEvent): não invente campos. Casco do médico: celular SEM barra inferior (só barra superior e faixa do selo); computador com barra lateral de 1 item "Meus pacientes".

=== MEUS PACIENTES ===
CELULAR (a partir de y88): título "Meus pacientes" (title 28, ink). Cartões (espaço 12, padding 16): nome (17/700 ink); chips neutros das categorias liberadas; caption "até dd/mm/aaaa" (ink-2); botão CONTORNO "Abrir" (48, largura total).
 Vazio: cartão surface-2, padding 24, centralizado: ícone lock 32 (ink-2) + texto fixo "Nenhum paciente liberou acesso a você no momento." (body 16, ink-2).
COMPUTADOR: os mesmos cartões em grade de 2 colunas (cada ≈ 472, espaço 24).

=== RESUMO CLÍNICO ===
Faixa fixa de somente leitura logo abaixo da barra superior (celular y56–112, computador largura 968 dentro do conteúdo, raio 12): fundo info-bg, ícone eye 20 (info-fg), texto 14/600 info-fg: "Somente leitura. Liberado pelo paciente: {categorias}."
CELULAR (a partir de y112, padding-top 16)
 Link "‹ Voltar aos pacientes" (44, brand 600). Cabeçalho do paciente: nome (title 28, ink) + caption "{idade} anos · {sexo}" (ink-2).
 Acordeões (espaço 12): cabeçalho do cartão altura 56, padding 0 16: título (section 22, ink) + chevron 20 (ink-2); aberto: conteúdo no mesmo cartão com padding 16.
  1 "Fora da faixa do laudo": por resultado: nome (label 16/600 ink) + valor (num 20/700 ink); régua; chip de estado curto + chip de variação (none-bg/none-fg, ícone de seta): "+24% desde 2016".
  2 "Tendências": até 3 exames com mais pontos: nome + último valor; mini-gráfico (largura 311, altura 120, linha 2.5 brand, faixa brand-soft, pontos com a forma do laboratório, último ponto rotulado).
  3 "Sinais do relógio" (SÓ se liberado): grade de 2 colunas de cartões de métrica (como em Alertas) + alertas compactos (chip de severidade + título 16/600 ink). Se NÃO liberado: cartão none-bg, raio 16, padding 16, ícone lock 24 (none-fg) + texto fixo
     "O paciente não liberou esta seção." (16/600 none-fg).
  4 "Linha do tempo": os 5 eventos mais recentes, com o fio e os cartões de evento da Fase 3.
 Link "Ver todos os exames" (44, brand, sublinhado) ao final; abre as telas completas, também somente leitura.
COMPUTADOR
 Faixa de somente leitura (altura 56) no topo do conteúdo, depois "‹ Voltar aos pacientes". Grade 12: esquerda span 8 (≈713): cartões abertos (sem acordeão) das seções 1 e 2. Direita span 4 (≈307), fixa (top 96): seções 3 e 4 em cartões.
 Cada seção é um cartão padrão (padding 20) com o título section 22.

MAPA DE CORES
 Elemento                         | Fundo         | Texto           | Borda   | Ícone
 Faixa de somente leitura         | info-bg       | info-fg 600     | —       | info-fg
 Cartão de paciente / de seção    | surface       | ink / ink-2     | 1 line  | ink-2 (chevron)
 Chip de categoria                | brand-soft    | brand           | —       | brand
 Botão "Abrir" (contorno)         | transparente  | brand           | 1.5 brand | brand
 Chip de variação                 | none-bg       | none-fg         | —       | none-fg
 Régua, chips de estado, gráficos | como na Fase 2 (mesmos tokens)
 Seção bloqueada                  | none-bg       | none-fg 600     | —       | none-fg
 Cartão vazio                     | surface-2     | ink-2           | 1 line  | ink-2
 Link "Voltar" / "Ver todos os exames" | —        | brand           | —       | —
```

## Fase 6 — Revisão para celular
**Entrega:** todas as telas das fases 1 a 5 conferidas no celular. **Aceite (medido):** 375 e 360 sem rolagem horizontal; **todo controle >= 44 px**; campos >= 16 px; ação principal na metade de baixo; gráfico visível sem rolar depois de escolher o exame.

```text
FASE 6: REVISÃO PARA CELULAR. Contexto: padrões de celular + Contexto 3. Revise TODAS as telas em 375x812, 360x800 e 390x844 e refaça o que tiver sido pensado só para desktop.
Confirme item a item: barra inferior de 5 itens com "Enviar" elevado; tabelas viradas em cartões; detalhes e confirmações em folha de baixo; gráfico de largura total sem rolar depois de escolher o exame;
em "Enviar laudo", "Fotografar o laudo" (câmera traseira) e "Escolher arquivo", e após a foto a prévia com "Usar esta foto" / "Tirar outra".
Crie a página /celular com cada tela em 375x812 ao lado da versão desktop (1280). No fim imprima: todo controle abaixo de 44 px, todo texto de corpo abaixo de 16 px, toda rolagem horizontal, e o MAPA DE CONFORMIDADE das cores.
```

**Atenção (verdade da engenharia):** o botão "Fotografar o laudo" precisa existir, mas **a leitura de foto depende do OCR local**, que hoje fica desligado (`OCR_ENABLED=false`) e foi testado só com laudos sintéticos. Na demo, **o caminho confiável é o PDF com texto**. A interface não deve prometer o que o backend ainda não garante (mostre um aviso se a leitura de foto não estiver disponível).

## Fase 7 — Polimento
**Entrega:** estados vazios, de erro e de carregamento em todas as telas. **Aceite:** teclado e leitor de tela nas fases 1 a 5; textos fixos idênticos aos do contexto.

```text
FASE 7: POLIMENTO. Padronize os estados em TODAS as telas, com estes mapas:
 Estado vazio: cartão (fundo surface-2, borda 1 line, raio 16, padding 32, centralizado): o fio curvo (120×40, linha 2.5 brand) → 12 → 1 frase (label 16/600 ink) → 4 → apoio (caption ink-2) → 16 → 1 ação (contorno, ou cheio se a tela não tiver outro cheio).
 Estado de erro: cartão (fundo urg-bg, raio 16, padding 16): ícone alert-circle 24 (urg-fg) + "o que houve" (16/600 urg-fg) + "o que fazer" (caption urg-fg) + botão contorno "Tentar de novo" (48).
 Carregando: esqueletos (fundo line a 60%, mesmo raio do componente, altura igual ao conteúdo final, sem animação em loop).
 Toast: conforme o Contexto 3.
Também: foco visível (contorno 3 brand, afastamento 2) e ordem de tabulação lógica; aria-label nos gráficos e nos botões de ícone; transições de 150 a 200 ms desligadas com prefers-reduced-motion; modo escuro conferido tela por tela;
textos fixos IDÊNTICOS aos enviados. Imprima o MAPA DE CONFORMIDADE e a lista do que ficou pendente.
```

## Fase 8 — Verificação e fechamento (comigo, não no Lovable)
O Lovable já grava no repositório, então não há "porte": há **verificação**.
1. Você avisa que o Lovable commitou; eu faço `git pull` do remoto `cuidar` (depois de commitarmos o que está pendente aqui) e resolvo conflitos, se houver.
2. Rodo `npm test`, `tsc` e `npm run build` em `apps/web`, e confiro que nenhum arquivo proibido (`src/data`, `src/lib`, hooks de auth, testes) foi alterado.
3. Rodo `npm run test:live`, `python scripts/preflight.py` e `python scripts/check_bundle.py`.
4. Abro cada tela a **1280 e a 375 px**, em claro e escuro, e comparo com o **mapa**: posições, medidas e cor de cada elemento (cores computadas contra os tokens).
5. Ensaio `docs/ROTEIRO_DEMO.md` com a interface nova e decido entre ela e a anterior (`git tag demo-fallback`, criada antes).

---

# Contexto já enviado ao Lovable (referência; não cole de novo)

> Estas seções são exatamente o que você já enviou. Ficam aqui para consulta e para reenviar só a parte que o Lovable esquecer.

## 1. Regras inegociáveis (cole em TODA fase)

```text
REGRAS DO PRODUTO (não quebre nenhuma):
1. Idioma: português do Brasil, tom calmo e claro, sem jargão. Pessoas leigas e idosas vão usar.
2. NUNCA diagnosticar. Proibido nomes de doenças e frases como "você tem...". Alertas só orientam: "converse com um médico".
3. "Fora da faixa" é SEMPRE em relação à faixa impressa no PRÓPRIO laudo, nunca a um valor genérico. Diga isso na interface.
4. Cor nunca é o único sinal: todo estado (abaixo/dentro/acima da faixa, severidade de alerta) também tem ÍCONE e TEXTO.
5. Dados de demonstração: sempre exibir o selo "Dados sintéticos de demonstração" visível.
6. Privacidade em primeiro plano: o paciente SEMPRE vê quem tem acesso, a que, até quando, e um botão "Revogar acesso" sem esconder.
7. A visão do médico é SOMENTE LEITURA: nenhum botão de editar, enviar ou apagar, e um aviso permanente de que é somente leitura.
8. Acessibilidade: contraste WCAG AA, foco visível, navegação por teclado, `prefers-color-scheme` (claro e escuro),
   `prefers-reduced-motion` respeitado, gráficos com alternativa em tabela ou lista.
9. Nada de dados inventados na tela: use exatamente os campos do contrato de dados. Sem números decorativos.
10. Nada é guardado sem a confirmação da pessoa (envio de laudo) e nada é compartilhado sem o consentimento dela.
```

## 1B. Padrões de celular (cole em TODA fase)

```text
PADRÕES DE CELULAR (valem para toda tela; desenhe o celular PRIMEIRO, depois tablet e desktop):
1. Telas de referência: 375x812 (principal), 360x800 e 390x844; depois 768x1024 (tablet) e 1280 (desktop). Sem rolagem horizontal da página.
2. Navegação: barra inferior fixa com no máximo 5 itens (Início, Exames, Enviar, Alertas, Acessos; a tela se chama "Privacidade e acessos", e "Acessos" cabe na barra sem passar de 14 px), com "Enviar" em destaque.
   A linha do tempo vira uma aba dentro de Exames. Sem menu hambúrguer para as ações principais.
3. Alvos de toque >= 44x44 px com 8 px entre eles. A ação principal de cada tela fica na parte de baixo (alcance do polegar).
4. Campos: texto >= 16 px (evita o zoom do iPhone), tipo certo (email, inputmode="decimal", date), rótulo sempre visível
   (nunca só placeholder), e o teclado não pode cobrir o botão principal.
5. Tabelas largas viram LISTAS DE CARTÕES (um cartão por resultado). Se uma tabela for inevitável, rola dentro do próprio quadro, com sombra
   indicando que há mais.
6. Detalhes e confirmações abrem em "folha de baixo" (bottom sheet). Ação destrutiva (revogar) pede confirmação na folha.
7. Gráficos: largura total, altura >= 220 px, ponto tocável com área >= 44 px, legenda ABAIXO do gráfico (nunca em cima dos dados), sem hover:
   o toque seleciona e mostra o detalhe.
8. Respeite as áreas seguras (notch e barra inferior): env(safe-area-inset-*) e altura com 100dvh.
9. Corpo do texto >= 16 px, legendas >= 14 px. Suporte à fonte maior do sistema sem quebrar o layout.
10. O essencial nunca depende de hover, clique direito ou arrastar. Rede lenta e offline têm mensagem clara.
```

## 1C. Direção de arte: extremamente bonito e objetivo (cole em TODA fase)

**Conceito: "clareza clínica com calor humano".** Editorial e calorosa, não hospitalar: papel quente, tinta verde-petróleo e um toque de âmbar.
Pense em uma revista de saúde bem diagramada com a clareza de um app de banco. A mesma paleta da apresentação do Cuidar, para a marca ser uma só.
**Bonito** vem de poucas decisões muito firmes (cor, tipografia, forma, 4 assinaturas visuais). **Objetivo** vem de regras de composição: uma pergunta
respondida por tela, uma ação principal, número antes da palavra.

**Prévia visual (abra e confira o resultado esperado, em claro, escuro, celular e computador):** https://claude.ai/artifact/2ndJ5nGJPgDesLD96RqZ9N
O link é privado; compartilhe pelo menu Share se outra pessoa precisar ver. Mostre esta prévia ao Lovable como a referência do visual.

```text
DIREÇÃO DE ARTE: "clareza clínica com calor humano". Editorial, limpa e calorosa. Uma revista de saúde bem diagramada com a clareza de um app de banco.

CORES (tokens; claro / escuro):
  fundo #F7F4EC / #0A1F1E · superfície #FFFFFF / #102B29 · superfície 2 #FBF8F1 / #153634 · linha #E6DFCF / #234542
  tinta #0E2B2A / #EAF3F1 · tinta 2 (texto de apoio) #4A6360 / #9FBAB6
  marca #0B4F4A / #4FD1B8 (texto sobre a marca: #FFFFFF / #052320) · marca suave #DDF0EA / #123F3A
  destaque âmbar #F59E0B / #F5B13D (SÓ decoração e realce; nunca como texto sobre fundo claro) · texto-âmbar #8A4B00
  ESTADOS DO EXAME (texto sobre fundo suave):
    acima #A33E08 em #FDEBDD · abaixo #1E40AF em #E4ECFD · dentro #0A6A5C em #DDF3EC · sem faixa #546461 em #EDF0EF
    escuro: acima #FFB584 em #3A2214 · abaixo #9DB8FF em #16264F · dentro #7BE0C8 em #0F3A34 · sem faixa #A9B9B6 em #1B2B29
  SEVERIDADE DO ALERTA: info #2F5D7C em #E3EEF5 · atenção #8A5300 em #FEF0CC · urgente #9B1C1C em #FDE4E4
    escuro: info #A9CDE8 em #14303F · atenção #F5C76B em #3A2D0B · urgente #FF9E9E em #3F1717
  Estes pares já foram conferidos: contraste AA (>= 4.5:1) em claro e escuro. Não troque os valores sem refazer a conta.
  Acima e dentro têm brilho parecido: por isso o estado NUNCA depende só da cor (sempre ícone ▲ ▼ ✓ – + texto + posição na régua).

TIPOGRAFIA: títulos e números grandes em "Playfair Display" 700; todo o resto em "Inter" (valores de tabela e gráfico com tabular-nums).
  Escala (celular / desktop): número hero 44/64 · título de tela 28/36 · título de seção 22/26 · corpo 16/17 · legenda 14.
  Nunca menos que 14 px (13 só em rótulo de eixo de gráfico). No máximo 2 famílias e 4 tamanhos por tela.

FORMA: grade de 4 px (4, 8, 12, 16, 24, 32, 48, 64). Cartões com raio 16, borda de 1 px (linha) e sombra suave
  (0 1px 2px rgba(14,43,42,.06), 0 8px 24px rgba(14,43,42,.06)). Folhas e modais com raio 24 no topo. Botões e campos com raio 12 e altura 48.
  Selos em pílula. Conteúdo com largura máxima de 1200 px; texto corrido até 68 caracteres por linha.

ÍCONES: uma só família de traço (Lucide), traço de 1,75 px, tamanhos 20 e 24. Nada de emoji.

ASSINATURAS VISUAIS (o que torna o app reconhecível):
  1. A RÉGUA DA FAIXA: todo resultado de exame mostra uma barra horizontal fina com a faixa do laudo sombreada (marca suave) e um ponto marcando
     onde o valor está. O ponto leva a cor do estado, com o ícone (▲ ▼ ✓ –) e o texto ("acima da faixa do laudo") ao lado. Aparece nas listas,
     nos cartões e no detalhe. É o elemento mais importante do app.
  2. O FIO: uma linha fina e curva, na cor da marca, que serve de espinha da linha do tempo, liga os passos do envio de laudo e aparece nos estados
     vazios. Discreto.
  3. NÚMEROS GRANDES em serifa nos cartões de resumo (valor grande, unidade pequena ao lado e uma frase curta embaixo).
  4. Um único fundo "quente": no topo do Início e no login, um degradê suave do fundo para a marca suave. O resto do app é plano.

GRÁFICOS: linha de 2,5 px na cor da marca; faixa do laudo = área sombreada em marca suave; pontos de 10 px com contorno branco de 2 px e uma FORMA por
  laboratório (círculo, quadrado, losango, triângulo); ponto fora da faixa ganha anel na cor do estado; o último ponto tem rótulo direto (valor + unidade);
  só linhas de grade horizontais, finas e muito claras; sem arco-íris (no máximo a marca + 1 cor de estado).

MOVIMENTO: 150 a 200 ms, ease-out. Cartões entram em cascata (até 60 ms entre eles). A folha de baixo desliza. O gráfico "desenha" a linha uma vez (600 ms).
  Nada em loop. Respeite prefers-reduced-motion.

OBJETIVIDADE (regras de composição):
  1. Regra dos 3 segundos: o terço de cima de cada tela responde UMA pergunta ("o que merece atenção?", "como estou neste exame?", "quem vê os meus dados?").
  2. Uma ação principal por tela (botão cheio na cor da marca). As secundárias em contorno ou link. Nunca dois botões cheios lado a lado.
  3. No máximo 3 níveis de hierarquia visual por tela (título, destaque, apoio).
  4. Número antes da palavra; palavra antes do parágrafo. Nenhum bloco de texto com mais de 2 linhas na interface principal.
  5. Detalhe sob demanda: o essencial aparece de cara; o resto abre ao tocar.
  6. Estado vazio = 1 frase + 1 ação. Erro = o que houve + o que fazer.
  7. Espaço em branco generoso: prefira menos itens com respiro a mais itens apertados.

NÃO FAÇA (estraga o visual): degradês roxos ou neon; vidro fosco (glassmorphism); sombras pesadas; fotos de banco de imagem; emoji como ícone; texto cinza claro e pequeno;
  bordas em tudo; gráficos de arco-íris; cartão dentro de cartão dentro de cartão; deixar os componentes com a cara padrão do shadcn (personalize raio, cor, sombra e tipografia).
```

**Como saber se ficou bonito e objetivo (confira cada tela antes de aprovar):**

| Teste | Passa quando |
|---|---|
| 3 segundos | Mostre a tela por 3 s a alguém e pergunte "o que você viu?": a resposta é a pergunta da tela |
| Olhos semicerrados | Borrando a tela, ainda se distinguem título, destaque e apoio, nessa ordem |
| Uma ação | Só há 1 botão cheio na tela |
| Contraste | Os pares da paleta acima, sem trocar valores (AA nos dois temas) |
| Régua | Todo resultado de exame tem a régua da faixa, com ícone e texto, nos 4 estados |
| Disciplina | No máximo 2 famílias de fonte e 4 tamanhos; nenhum texto abaixo de 14 px |
| Ar | Nenhum bloco denso: se a tela parece cheia, tire itens em vez de diminuir o tamanho |

## 2. Contratos de dados (cole em TODA fase; é o que o app real entrega)

Tipos TypeScript exatos (em `apps/web/src/types.ts`, `src/data/api.ts` e `src/data/documents.ts`). Os dados de mentira devem seguir **estes** formatos:

```ts
type Flag = "below" | "in_range" | "above" | "no_range";            // pela faixa do PRÓPRIO laudo
type Severity = "info" | "attention" | "urgent";
type EventKind = "exam" | "encounter" | "medication_start" | "medication_end" | "vaccine" | "alert";

interface SeriesPoint {          // um resultado de exame
  biomarker: string | null;      // nome padronizado, ex.: "Glicemia de jejum"
  category: string | null;       // ex.: "Metabolismo"
  unit_canonical: string | null; // unidade única da série, ex.: "mg/dL"
  collected_at: string;          // "2026-09-28"
  lab_name: string | null;       // 3 laboratórios diferentes na demo
  raw_name: string; raw_value: number; raw_unit: string | null;      // exatamente como o laudo veio
  raw_ref_low: number | null; raw_ref_high: number | null; ref_text: string | null;
  normalization: "canonical" | "converted" | "unit_unknown" | "unmapped";
  value: number | null;          // já na unidade canônica (null = não deu para converter)
  ref_low: number | null; ref_high: number | null;                  // faixa do laudo, na unidade canônica
  flag: Flag;
}
interface TimelineEvent { event_date: string; kind: EventKind; title: string; detail: Record<string, unknown>; }
interface WearableSample { t: string; metric: string; value: number; unit: string | null; }   // frequência cardíaca, sono, passos...
interface Alert {
  kind: string; severity: Severity; title: string; message: string; triggered_at: string;
  evidence: {                    // "por que disparou": o que a regra usou
    rule: string; observed: string; window: { from: string; to: string };
    series: { metric: string; unit: string; points: { t: string; v: number }[] }[];
    reference_lines?: { metric: string; value: number; label: string }[];
    baseline?: { metric: string; value: number; label: string }; note?: string;
  };
}
interface HealthData { synthetic: boolean; patient: { full_name: string; birth_date: string | null; sex: string | null };
  points: SeriesPoint[]; events: TimelineEvent[]; wearables: WearableSample[]; alerts: Alert[] }

// Papel de quem entrou
type Role = { kind: "patient"; patientId: string; name: string } | { kind: "doctor"; doctorId: string; name: string } | { kind: "none" };

// Privacidade
type Category = "exams" | "history" | "wearables";   // Exames | Histórico (consultas, remédios e vacinas) | Relógio e alertas
interface Doctor { id: string; full_name: string; crm: string | null }
interface Consent { id: string; doctor_id: string; categories: Category[]; granted_at: string; expires_at: string; revoked_at: string | null }
type ConsentStatus = "active" | "revoked" | "expired";
interface AccessEntry { id: number; doctor_id: string; category: string; accessed_at: string }  // quem abriu o quê
interface MyPatient { id: string; full_name: string; categories: Category[]; expires_at: string }  // o que o médico enxerga na lista

// Envio de laudo
interface ReviewObservation {
  raw_name: string; value: number; unit: string | null; ref_low: number | null; ref_high: number | null; ref_text: string | null;
  page: number; bbox: [number, number, number, number] | null;   // x0,y0,x1,y1 de 0 a 1 sobre a imagem da página
  confidence: number | null; notes: string[]; method: "text_layer" | "ocr" | "llm" | null;
}
interface Review { document_id: string; method: string; lab_name: string | null; collected_at: string | null;
  warnings: string[]; observations: ReviewObservation[]; pages: { page: number; url: string }[] }
interface ConfirmResult { confirmed: number; submitted: number; already: boolean }   // already = o laudo já estava guardado
```

Dados de mentira: **Marta Albuquerque Lima** (paciente, 58 anos), **Dr. Henrique** (médico). 75 resultados em 3 laboratórios (2016 a 2026),
489 amostras de relógio, 5 alertas (3 pedem atenção). A história da demo: o mesmo exame vem de laboratórios com nomes e unidades diferentes
(ex.: HbA1c em % e em mmol/mol) e vira uma série só. Modelo completo: `apps/web/src/demo/marta.json`.

**Volume real:** 489 amostras de relógio e até 75 pontos por série. Gráficos de relógio devem resumir (média por dia ou por hora), não desenhar 489 pontos.

## 2B. Contrato de componentes (é isto que torna o porte mecânico)

Cada tela do Lovable deve ser um componente **puramente visual**, sem `fetch` e sem estado de servidor, com **estas props** (nomes iguais ou mapeáveis 1 para 1):

| Componente | Props |
|---|---|
| `Login` | `onSubmit(email, password) => Promise<erro \| null>`, `onDemo()`, `initialError?` |
| `Dashboard` (Exames / Linha do tempo / Relógio) | `data: HealthData`, `initialView?`, `banner?: ReactNode` (aviso fixo no topo, usado pelo médico) |
| `BiomarkerList` | `series: Serie[]`, `selected: string`, `onSelect(biomarker)` |
| `SeriesChart` | `series: Serie`, `labIndex: Map<laboratório, número>`, `selectedKey: string`, `onSelect(key)` |
| `PointDetail` | `p: SeriesPoint` |
| `RangeRuler` (a régua da faixa) | `value: number`, `low: number \| null`, `high: number \| null`, `unit: string`, `flag: Flag` |
| `DataTable` | `series: Serie` |
| `Timeline` | `events: TimelineEvent[]`, `hidden: Set<EventKind>`, `onToggle(kind)` |
| `AlertsPanel` / `WearablesPanel` | `alerts: Alert[]` / `samples: WearableSample[]` |
| `PrivacyView` | `doctors`, `consents`, `log`, `onGrant({ doctorId, categories, days }) => Promise`, `onRevoke(id) => Promise`, `now?`, `error?` |
| `PatientList` (médico) | `patients: MyPatient[]`, `onOpen(patient)` |
| `ReviewForm` | `review: Review`, `draft`, `onChange(draft)`, `errors: string[]`, `rowErrors: Record<number,string>`, `busy`, `onConfirm()`, `onCancel()` |
| `UploadPanel` (estados) | `step: "idle" \| "working" \| "review" \| "done" \| "error"`, `onFile(File)`, mensagens |

`Serie` = `{ biomarker: string; unit: string; points: SeriesPoint[] }`. O Lovable pode dividir em componentes menores por dentro, mas **a fronteira acima não muda**.

## 2C. Textos fixos (não deixe o Lovable reescrever)

Estes textos têm função de segurança ou de confiança. Use exatamente:

| Onde | Texto |
|---|---|
| Selo | Dados sintéticos de demonstração |
| Estados da faixa | acima da faixa do laudo · abaixo da faixa do laudo · dentro da faixa do laudo · sem faixa no laudo |
| Alertas (topo) | Os alertas vêm de regras fixas sobre os dados do relógio (não de uma IA) e cada um mostra por que disparou. Eles orientam procurar um médico e não fazem diagnóstico. |
| Alertas (ação) | Converse com um médico |
| Rodapé geral | Este painel organiza resultados e sinais e não faz diagnóstico nem substitui a avaliação de um médico. “Fora da faixa” é sempre em relação à faixa impressa no próprio laudo. |
| Envio de laudo | Nada vai para o seu histórico até você confirmar. |
| Laudo repetido | Este laudo já foi enviado e guardado antes. Nada foi duplicado. |
| Revogar | O médico perde o acesso imediatamente. |
| Médico | Somente leitura. Liberado pelo paciente: {categorias}. |
| Médico, categoria não liberada | O paciente não liberou esta seção. |
| Login, erro | E-mail ou senha incorretos. (nunca dizer qual dos dois errou) |

---

# Apoio

## Gargalos reais e onde cada fase os resolve

| # | Gargalo do produto | Onde se resolve |
|---|---|---|
| G1 | **Confiar na leitura da IA**: um valor lido errado vira dado clínico errado | Fase 4 (conferência com a imagem do laudo, caixa onde foi lido, confiança) |
| G2 | **Entender o próprio histórico**: laboratórios, nomes e unidades diferentes | Fase 2 (série única, faixa do próprio laudo) |
| G3 | **Saber quando procurar um médico, sem susto e sem diagnóstico** | Fase 3 (alerta como orientação, com "por que disparou") |
| G4 | **Controlar quem vê o quê** | Fase 5A (consentimento visível, revogar na hora, auditoria) |
| G5 | **O médico decidir com o quadro completo em segundos** | Fase 5B (resumo clínico numa visualização só) |
| G6 | **Começar do zero**: paciente novo sem nenhum dado | Fase 1B (primeiro acesso) |
| G7 | **Usar no celular**, onde o laudo é fotografado e a pessoa vive | Fase 6 (e os padrões de celular em todas as fases) |
| G8 | **Demonstrar em 10 min sem tropeçar** (carregando, erro, vazio) | Fase 7 (estados) e `docs/ROTEIRO_DEMO.md` |

## Como o front atual se comporta no celular (medido a 375 px, antes do redesign)

- **Página:** não há rolagem horizontal. Mas a **tabela de dados** do exame tem 505 px de largura dentro de uma tela de 375.
- **Alvos de toque:** "Entrar" tem 42 px e "Ver demonstração" 30 px. Na tela de exames, 8 de 20 controles ficam abaixo de 44 px, e na de relógio, 8 de 8.
- **Campos de texto:** 15 px. No iPhone, abaixo de 16 px o navegador dá zoom ao tocar no campo.
- **Ordem na tela:** a lista de exames vem antes do gráfico.

Estas medições são o critério de aceite da Fase 6.

## O que cabe no prazo (a demo é hoje)

**Hoje a demo roda na interface atual**, que está testada ao vivo. Uma interface nova sem teste com as contas reais antes de subir ao palco é um risco maior que uma interface simples que funciona.
Para depois da demo, nesta ordem: Fase 1 (refazer) → 5A e 5B → 4 → 6 → 2 e 1B → 3 e 7.

## Perguntas que melhoram o resultado

- Existe **identidade da Rivio** (logo, cores, fonte)? O Lovable já usou o logotipo "rivio" com ícone de coração; confirme se é esse mesmo ou se o produto se chama **Cuidar**.
- Quem assiste: **jurados técnicos ou pessoas de saúde**?
- O que mais incomoda hoje: densidade, cores, tipografia, navegação?
- O produto será usado principalmente no **celular** (paciente) e no **computador** (médico)?
