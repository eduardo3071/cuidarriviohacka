import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { TimelineEvent } from "../types";
import { describeEvent, eventDateLabel, groupByYear, KINDS } from "./timeline";

const events = demo.events as TimelineEvent[];

describe("groupByYear", () => {
  it("anos do mais recente ao mais antigo, e cada ano tambem do mais recente ao mais antigo", () => {
    const g = groupByYear(events);
    const years = g.map((x) => x.year);
    expect(years).toEqual([...years].sort().reverse());
    expect(years[0]).toBe("2026");
    expect(years.at(-1)).toBe("2016");
    for (const grp of g) {
      const dates = grp.events.map((e) => e.event_date);
      expect(dates).toEqual([...dates].sort().reverse());
      expect(grp.events.every((e) => e.event_date.startsWith(grp.year))).toBe(true);
    }
    expect(g.reduce((n, x) => n + x.events.length, 0)).toBe(33);
  });

  it("nao perde nem repete eventos do mesmo dia", () => {
    const same: TimelineEvent[] = [
      { event_date: "2020-01-01", kind: "vaccine", title: "A", detail: {} },
      { event_date: "2020-01-01", kind: "vaccine", title: "B", detail: {} },
    ];
    expect(groupByYear(same)[0]!.events.map((e) => e.title)).toEqual(["A", "B"]);
  });
});

describe("describeEvent", () => {
  const ev = (kind: TimelineEvent["kind"], detail: Record<string, unknown>): TimelineEvent => ({ event_date: "2020-01-01", kind, title: "t", detail });

  it("exame: quantos resultados e quantos fora da faixa DO LAUDO", () => {
    expect(describeEvent(ev("exam", { results: 11, out_of_range: 3 }))).toBe("11 resultados · 3 fora da faixa do laudo");
    expect(describeEvent(ev("exam", { results: 1, out_of_range: 0 }))).toBe("1 resultado · todos na faixa do laudo");
    expect(describeEvent(ev("exam", {}))).toBeNull();
  });

  it("consulta, remedio e vacina so mostram o que existe", () => {
    expect(describeEvent(ev("encounter", { provider: "Clinica A", notes: "Retorno" }))).toBe("Clinica A — Retorno");
    expect(describeEvent(ev("encounter", { provider: null, notes: null }))).toBeNull();
    expect(describeEvent(ev("medication_start", { dose: "50 mg 1x/dia" }))).toBe("50 mg 1x/dia");
    expect(describeEvent(ev("vaccine", { dose_number: 2 }))).toBe("Dose 2");
    expect(describeEvent(ev("vaccine", { dose_number: null }))).toBeNull();
  });

  it("todo evento da demonstracao tem um tipo conhecido", () => {
    expect(events.every((e) => KINDS.includes(e.kind))).toBe(true);
  });

  it("data curta dd/mm", () => {
    expect(eventDateLabel({ event_date: "2016-05-12", kind: "encounter", title: "x", detail: {} })).toBe("12/05");
  });
});
