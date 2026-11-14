import type { HealthData, SeriesPoint } from "../types";
import type { DemoConfirmed } from "./demoApi";

/** Junta um laudo recem-lido a paciente de demonstracao (so em memoria): as leituras entram na serie, o exame entra na
 *  linha do tempo (ordem cronologica, como a view `timeline_events`). Nao muda o objeto de entrada. */
export function addExam(data: HealthData, c: DemoConfirmed): HealthData {
  const points: SeriesPoint[] = [...data.points, ...c.points];
  const outOfRange = c.points.filter((p) => p.flag === "above" || p.flag === "below").length;
  const events = [
    ...data.events,
    {
      event_date: c.collectedAt,
      kind: "exam" as const,
      title: c.labName ?? "Laudo enviado",
      detail: { document_id: c.documentId, results: c.points.length, out_of_range: outOfRange },
    },
  ].sort((a, b) => a.event_date.localeCompare(b.event_date));
  return { ...data, points, events };
}
