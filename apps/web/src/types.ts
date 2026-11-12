/** Mesmas colunas da view SQL `observation_series` (e do JSON de demonstracao). */
export type Flag = "below" | "in_range" | "above" | "no_range";
export type Normalization = "canonical" | "converted" | "unit_unknown" | "unmapped";

export interface SeriesPoint {
  biomarker: string | null;
  category: string | null;
  unit_canonical: string | null;
  collected_at: string; // ISO yyyy-mm-dd
  lab_name: string | null;
  raw_name: string; // como o laudo chama o exame
  raw_value: number; // o que o laudo disse
  raw_unit: string | null;
  raw_ref_low: number | null; // faixa DO LAUDO, como veio
  raw_ref_high: number | null;
  ref_text: string | null;
  normalization: Normalization;
  value: number | null; // na unidade canonica (null se nao deu para normalizar)
  ref_low: number | null; // faixa do laudo levada a unidade canonica
  ref_high: number | null;
  flag: Flag; // pela faixa do PROPRIO laudo, nos valores originais
}

/** Mesmas colunas da view SQL `timeline_events`. */
export type EventKind = "exam" | "encounter" | "medication_start" | "medication_end" | "vaccine" | "alert";

export interface TimelineEvent {
  event_date: string;
  kind: EventKind;
  title: string;
  detail: Record<string, unknown>;
}

export interface PatientInfo {
  full_name: string;
  birth_date: string | null;
  sex: string | null;
}

/** Mesmas colunas da tabela `wearable_samples`. */
export interface WearableSample {
  t: string; // ISO com fuso
  metric: string;
  value: number;
  unit: string | null;
}

export type Severity = "info" | "attention" | "urgent";

export interface EvidencePoint {
  t: string;
  v: number;
}
export interface EvidenceSeries {
  metric: string;
  unit: string;
  points: EvidencePoint[];
}
export interface ReferenceLine {
  metric: string;
  value: number;
  label: string;
}
/** "Por que disparou": exatamente o que o motor de regras usou (alerts.evidence). */
export interface Evidence {
  rule: string;
  observed: string;
  window: { from: string; to: string };
  series: EvidenceSeries[];
  reference_lines?: ReferenceLine[];
  baseline?: { metric: string; value: number; label: string };
  note?: string;
}

/** Mesmas colunas da tabela `alerts`. */
export interface Alert {
  kind: string;
  severity: Severity;
  title: string;
  message: string;
  triggered_at: string;
  evidence: Evidence;
}

export interface HealthData {
  synthetic: boolean;
  patient: PatientInfo;
  points: SeriesPoint[];
  events: TimelineEvent[];
  wearables: WearableSample[];
  alerts: Alert[];
}
