/** Textos de segurança aprovados: manter literalmente, sem paráfrases. */
export const SAFETY_COPY = {
  synthetic: "Dados sintéticos de demonstração",
  alertsIntro: "Os alertas vêm de regras fixas sobre os dados do relógio (não de uma IA) e cada um mostra por que disparou. Eles orientam procurar um médico e não fazem diagnóstico.",
  alertsAction: "Converse com um médico",
  footer: "Este painel organiza resultados e sinais e não faz diagnóstico nem substitui a avaliação de um médico. “Fora da faixa” é sempre em relação à faixa impressa no próprio laudo.",
  upload: "Nada vai para o seu histórico até você confirmar.",
  duplicate: "Este laudo já foi enviado e guardado antes. Nada foi duplicado.",
  revoke: "O médico perde o acesso imediatamente.",
  unavailable: "O paciente não liberou esta seção.",
  loginError: "E-mail ou senha incorretos.",
} as const;

export const RANGE_LABEL = {
  above: "acima da faixa do laudo",
  below: "abaixo da faixa do laudo",
  in_range: "dentro da faixa do laudo",
  no_range: "sem faixa no laudo",
} as const;

export const doctorReadOnlyCopy = (categories: string) => `Somente leitura. Liberado pelo paciente: ${categories}.`;