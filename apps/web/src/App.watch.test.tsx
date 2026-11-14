import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Dashboard } from "./App";
import demo from "./demo/marta.json";
import type { HealthData } from "./types";

const data = demo as unknown as HealthData;
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Dashboard: relogio e alertas (Fase 5)", () => {
  const exams = renderToStaticMarkup(<Dashboard data={data} />);
  const watch = renderToStaticMarkup(<Dashboard data={data} initialView="alertas" />);

  it("no inicio avisa que 3 sinais do relogio merecem atencao e leva para a aba", () => {
    expect(exams).toContain("3 sinais do relógio merecem atenção");
    expect(exams).toContain('class="alert-banner"');
    expect(exams).toContain('aria-label="3 alertas para atenção"');
  });

  it("a aba do relogio mostra os 5 alertas com 'Por que disparou?' e os 6 graficos de sinais", () => {
    expect(count(watch, 'data-testid="alert"')).toBe(5);
    expect(count(watch, "Ver por quê")).toBe(10);
    expect(count(watch, 'data-testid="wear-card"')).toBe(6);
    expect(watch).not.toContain('aria-label="Exames do histórico"');
  });

  it("explica que os alertas vem de regras fixas e nao de IA, e que nao sao diagnostico", () => {
    expect(watch).toContain("regras fixas");
    expect(watch).toContain("não de uma IA");
    expect(watch).toContain("não fazem diagnóstico");
  });

  it("nunca nomeia uma doenca como diagnostico em nenhum alerta", () => {
    for (const w of ["fibrilação", "apneia", "hipertensão", "infarto", "você tem"]) expect(watch.toLowerCase()).not.toContain(w);
  });

  it("os cartoes de sinais mostram o ultimo valor com a unidade certa", () => {
    expect(watch).toMatch(/<strong>\d+<\/strong> <span class="caption">avisos?<\/span>/);
    expect(watch).toMatch(/<strong>\d+\/\d+<\/strong> <span class="caption">mmHg/); // pressao sistolica/diastolica
    expect(watch).toMatch(/<strong>\d(,\d)?<\/strong> <span class="caption">h</); // sono em horas, nao em minutos
    expect(watch).toContain("últimos 7 dias");
  });

  it("sem alertas nao mostra o aviso", () => {
    expect(renderToStaticMarkup(<Dashboard data={{ ...data, alerts: [] }} />)).not.toContain("alert-banner");
  });
});
