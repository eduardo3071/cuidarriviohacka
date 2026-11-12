import { describe, expect, it } from "vitest";
import demo from "../demo/marta.json";
import type { Alert, HealthData } from "../types";
import { attentionCount, evidenceChartOptions, groupSamples, METRIC_META, sortAlerts } from "./wearables";

const data = demo as unknown as HealthData;

describe("wearables", () => {
  it("toda metrica dos dados tem rotulo e unidade", () => {
    for (const m of new Set(data.wearables.map((w) => w.metric))) expect(METRIC_META[m], m).toBeDefined();
  });

  it("agrupa por metrica, em ordem de tempo", () => {
    const by = groupSamples(data.wearables);
    expect(by.get("resting_hr")).toHaveLength(87);
    expect(by.get("irregular_rhythm_event")).toHaveLength(7);
    for (const list of by.values()) expect(list.map((s) => s.t)).toEqual([...list.map((s) => s.t)].sort());
  });

  it("ordena alertas: urgente, atencao, informativo; empate por titulo", () => {
    expect(sortAlerts(data.alerts).map((a) => a.severity)).toEqual(["attention", "attention", "attention", "info", "info"]);
    const mk = (severity: Alert["severity"], title: string): Alert => ({ ...(data.alerts[0] as Alert), severity, title });
    expect(sortAlerts([mk("info", "B"), mk("urgent", "Z"), mk("attention", "A")]).map((a) => a.severity)).toEqual([
      "urgent",
      "attention",
      "info",
    ]);
  });

  it("conta so o que merece atencao (urgente + atencao)", () => {
    expect(attentionCount(data.alerts)).toBe(3);
    expect(attentionCount([])).toBe(0);
  });

  it("escolhe como desenhar a evidencia pela primeira serie", () => {
    const by = (kind: string) => data.alerts.find((a) => a.kind === kind)!.evidence;
    expect(evidenceChartOptions(by("irregular_rhythm")).mode).toBe("events");
    expect(evidenceChartOptions(by("sleep_reduction"))).toMatchObject({ mode: "line", divisor: 60, unitLabel: "h" });
    expect(evidenceChartOptions(by("high_blood_pressure"))).toMatchObject({ mode: "line", divisor: 1, unitLabel: "mmHg" });
  });
});
