import { fmtDate } from "../lib/format";
import { labName } from "../lib/series";
import { attentionCount } from "../lib/wearables";
import type { HealthData } from "../types";

/** Telas que o tour sabe mostrar (as mesmas chaves da vitrine /celular, com dados sintéticos). */
export type TourScreen = "inicio" | "exames" | "linha" | "alertas" | "enviar" | "acessos" | "medico" | "resumo";

export interface TourStep {
  id: string;
  /** Em que ponto do caminho da paciente estamos (aparece no painel). */
  etapa: string;
  title: string;
  /** O que dizer em voz alta: curto, em português simples, sem diagnóstico. */
  fala: string;
  /** Gargalo do desafio que este passo resolve. */
  gargalo?: string;
  screen: TourScreen;
  /** Seletor CSS do que destacar; sem ele (ou se não achar), nada é destacado. */
  target?: string;
  /** Tempo sugerido para falar, em segundos. */
  segundos: number;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Os passos do pitch, no caminho da paciente. Os números vêm dos dados, nunca são digitados à mão. */
export function buildSteps(data: HealthData): TourStep[] {
  const results = data.points.length;
  const labs = new Set(data.points.map((p) => labName(p))).size;
  const samples = data.wearables.length;
  const attention = attentionCount(data.alerts);
  const last = data.points.reduce((m, p) => (p.collected_at > m ? p.collected_at : m), "");
  const first = data.patient.full_name.split(" ")[0];

  return [
    {
      id: "paciente", screen: "inicio", target: ".home .stats", segundos: 30,
      etapa: `Conheça a ${first}`, title: "Uma paciente, vários laboratórios",
      fala: `${first} tem ${plural(results, "resultado", "resultados")} de exame em ${plural(labs, "laboratório", "laboratórios")} e ${plural(samples, "amostra", "amostras")} do relógio. Hoje ninguém vê isso junto. Aqui, num olhar, ela vê o que merece atenção.`,
      gargalo: "Histórico espalhado entre laboratórios, hospitais, planos e papel",
    },
    {
      id: "faixa", screen: "inicio", target: ".home .out-card", segundos: 40,
      etapa: "Vê tudo junto", title: "Cada valor contra a faixa do próprio laudo",
      fala: "Cada resultado é comparado com a faixa impressa no próprio laudo. A régua mostra onde o valor está, sempre com ícone e texto: a cor nunca fala sozinha.",
      gargalo: "Decisões com informação incompleta",
    },
    {
      id: "enviar", screen: "enviar", target: ".up-pick, .up-mobile", segundos: 45,
      etapa: "Envia o laudo", title: "O papel vira dado, com a confirmação dela",
      fala: "Ela envia o PDF ou a foto do laudo. O sistema lê os resultados e ela confere cada valor com a imagem, vendo onde foi lido. Nada vai para o histórico até ela confirmar.",
      gargalo: "O histórico fica no papel; e a leitura automática precisa de conferência",
    },
    {
      id: "exame", screen: "exames", target: ".chart-box", segundos: 45,
      etapa: "Vê tudo junto", title: "O mesmo exame, vários laboratórios, uma série só",
      fala: "A glicemia veio de laboratórios com nomes e unidades diferentes e vira uma série só, na mesma unidade. A faixa muda de um laboratório para outro, e o ponto que sai da faixa do laudo ganha um anel.",
      gargalo: "Unidades e nomes diferentes impedem comparar",
    },
    {
      id: "linha", screen: "linha", target: '[data-testid="event"]', segundos: 25,
      etapa: "Vê tudo junto", title: "Tudo na mesma linha do tempo",
      fala: `Exames, consultas, remédios, vacinas e alertas na mesma linha${last ? `, até ${fmtDate(last)}` : ""}, com filtros por tipo.`,
    },
    {
      id: "alertas", screen: "alertas", target: ".al-card", segundos: 40,
      etapa: "Acompanha o relógio", title: "Alertas que orientam, sem diagnosticar",
      fala: `Regras fixas, não IA, sobre os dados do relógio: ${plural(attention, "sinal merece", "sinais merecem")} atenção. Cada alerta mostra por que disparou e sempre diz: converse com um médico.`,
      gargalo: "Os dados do relógio não chegam ao médico",
    },
    {
      id: "privacidade", screen: "acessos", target: ".pv-main", segundos: 40,
      etapa: "Libera o médico", title: "Ela decide quem vê, o quê e por quanto tempo",
      fala: "Ela escolhe o médico, as categorias e o prazo. Revoga na hora e vê quem abriu os seus dados. Nada é compartilhado sem o consentimento dela, como no open finance.",
      gargalo: "Compartilhar dados de saúde com controle e consentimento",
    },
    {
      id: "pacientes", screen: "medico", target: ".drp-list", segundos: 25,
      etapa: "O médico vê", title: "O médico vê só quem liberou",
      fala: "O médico só enxerga os pacientes que liberaram acesso, e só o que foi liberado.",
    },
    {
      id: "resumo", screen: "resumo", target: ".dr-out", segundos: 40,
      etapa: "O médico vê", title: "Um resumo clínico, somente leitura",
      fala: "O médico vê tudo organizado numa visualização só, em somente leitura. Cada abertura fica registrada para a paciente.",
      gargalo: "O médico vê só o que o paciente lembra de levar",
    },
    {
      id: "fechamento", screen: "inicio", segundos: 30,
      etapa: "Fechamento", title: "O que está pronto e o que vem a seguir",
      fala: "Pronto e testado: leitura de PDF com texto, consentimento com revogação e auditoria, e alertas por regras. Em evolução: leitura de foto e IA hospedada (ainda sem teste real), revisão clínica das regras de alerta e o relógio chegando em tempo real.",
    },
  ];
}

// ---------------------------------------------------------------- estado do tour (função pura, testável)
export interface TourState {
  index: number;
  collapsed: boolean;
}
export type TourAction = { type: "next" } | { type: "prev" } | { type: "first" } | { type: "last" } | { type: "toggle" };

export const initialTour = (start = 0): TourState => ({ index: Math.max(0, start), collapsed: false });

export function tourReducer(total: number, state: TourState, action: TourAction): TourState {
  const clamp = (i: number) => Math.min(Math.max(i, 0), Math.max(total - 1, 0));
  switch (action.type) {
    case "next": return { ...state, index: clamp(state.index + 1) };
    case "prev": return { ...state, index: clamp(state.index - 1) };
    case "first": return { ...state, index: 0 };
    case "last": return { ...state, index: clamp(total - 1) };
    case "toggle": return { ...state, collapsed: !state.collapsed };
  }
}

/** Teclas do apresentador: setas e espaço avançam/voltam, Home/End pulam, Esc sai. Ignora campos de texto. */
export function keyToAction(key: string, target?: { tagName?: string; isContentEditable?: boolean } | null): TourAction | "exit" | null {
  const tag = target?.tagName?.toUpperCase();
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return null;
  // espaço em botão/link/resumo já "clica" no elemento: não avançar o passo por cima disso
  if (key === " " && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return null;
  switch (key) {
    case "ArrowRight": case "PageDown": case " ": return { type: "next" };
    case "ArrowLeft": case "PageUp": return { type: "prev" };
    case "Home": return { type: "first" };
    case "End": return { type: "last" };
    case "Escape": return "exit";
    default: return null;
  }
}

/** Tempo total sugerido, em segundos. */
export const totalSeconds = (steps: readonly TourStep[]) => steps.reduce((n, s) => n + s.segundos, 0);
