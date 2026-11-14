import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronDown, ChevronLeft, Lock } from "lucide-react";
import { useState, type ReactNode } from "react";
import { CATEGORY_LABEL, type Category } from "../data/api";
import { fmtDate, fmtNum } from "../lib/format";
import { buildSeries, labIndexes, pointKey, summarize } from "../lib/series";
import { describeEvent, eventDateLabel, KIND_LABEL } from "../lib/timeline";
import { sortAlerts } from "../lib/wearables";
import type { HealthData } from "../types";
import { RangeRuler } from "./RangeRuler";
import { SeriesChart } from "./SeriesChart";
import { StateChip } from "./StateChip";
import { EmptyState, StateBadge } from "./ui";
import { WearablesPanel } from "./WearablesPanel";
import "./phase3.css";
import "./doctor.css";

const SEX: Record<string, string> = { F: "feminino", M: "masculino" };
function ageOf(birth: string, now: Date): number {
  const b = new Date(`${birth}T12:00:00Z`);
  let a = now.getUTCFullYear() - b.getUTCFullYear();
  if (now.getUTCMonth() < b.getUTCMonth() || (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())) a -= 1;
  return a;
}

function Locked() {
  return <p className="dr-locked"><Lock size={24} strokeWidth={1.75} aria-hidden="true" />O paciente não liberou esta seção.</p>;
}

/** Seção: acordeão no celular, cartão sempre aberto no computador. */
function Section({ id, title, children, defaultOpen = false }: { id: string; title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`dr-sec${open ? " is-open" : ""}`} aria-labelledby={`${id}-h`}>
      <h3 className="dr-sec-h" id={`${id}-h`}>
        <button type="button" aria-expanded={open} aria-controls={`${id}-b`} onClick={() => setOpen(!open)}>
          <span>{title}</span><ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </h3>
      <div className="dr-sec-b" id={`${id}-b`}>{children}</div>
    </section>
  );
}

export interface DoctorSummaryProps {
  data: HealthData;
  categories: Category[];
  onBack: () => void;
  onAll: () => void;
  now?: Date;
}

/** Resumo clínico do paciente para o médico. Somente leitura: nenhum botão de editar, enviar ou apagar. */
export function DoctorSummary({ data, categories, onBack, onAll, now = new Date() }: DoctorSummaryProps) {
  const can = (c: Category) => categories.includes(c);
  const series = buildSeries(data.points);
  const labs = labIndexes(data.points);
  const out = series.filter((s) => { const f = s.points[s.points.length - 1]!.flag; return f === "above" || f === "below"; });
  const trends = [...series].sort((a, b) => b.points.length - a.points.length).slice(0, 3);
  const events = [...data.events].sort((a, b) => b.event_date.localeCompare(a.event_date)).slice(0, 5);
  const p = data.patient;
  const meta = [p.birth_date ? `${ageOf(p.birth_date, now)} anos` : null, p.sex ? SEX[p.sex] ?? p.sex : null].filter(Boolean).join(" · ");

  const outBody = !can("exams") ? <Locked /> : out.length === 0 ? <EmptyState title="Nenhum resultado recente fora da faixa do laudo." /> : (
    <ul className="dr-out">
      {out.map((s) => {
        const sum = summarize(s);
        const l = sum.latest;
        const Arrow = sum.trend === "up" ? ArrowUpRight : sum.trend === "down" ? ArrowDownRight : ArrowRight;
        return (
          <li key={s.biomarker}>
            <div className="dr-out-row"><span className="dr-out-name">{s.biomarker}</span><span><strong className="dr-num">{fmtNum(l.value)}</strong> <span className="caption">{s.unit}</span></span></div>
            <RangeRuler value={l.value} low={l.ref_low} high={l.ref_high} unit={s.unit} flag={l.flag} showLabel={false} />
            <div className="dr-chips">
              <StateChip flag={l.flag} short />
              {sum.changePct !== null && s.points.length > 1 && (
                <span className="dr-var"><Arrow size={16} strokeWidth={2} aria-hidden="true" />{sum.changePct > 0 ? "+" : ""}{fmtNum(Math.round(sum.changePct))}% desde {sum.first.collected_at.slice(0, 4)}</span>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const trendBody = !can("exams") ? <Locked /> : (
    <ul className="dr-trends">
      {trends.map((s) => {
        const l = s.points[s.points.length - 1]!;
        return (
          <li key={s.biomarker}>
            <div className="dr-out-row"><span className="dr-out-name">{s.biomarker}</span><span><strong className="dr-num">{fmtNum(l.value)}</strong> <span className="caption">{s.unit}</span></span></div>
            <SeriesChart series={s} labIndex={labs} selectedKey={pointKey(l)} onSelect={() => {}} height={160} />
          </li>
        );
      })}
    </ul>
  );

  const watchBody = !can("wearables") ? <Locked /> : (
    <>
      <WearablesPanel samples={data.wearables} />
      {data.alerts.length > 0 && (
        <ul className="dr-alerts">
          {sortAlerts(data.alerts).map((a) => (
            <li key={`${a.kind}|${a.triggered_at}`}><StateBadge state={a.severity} /><span className="dr-alert-t">{a.title}</span><span className="caption">{fmtDate(a.triggered_at.slice(0, 10))}</span></li>
          ))}
        </ul>
      )}
    </>
  );

  const timeBody = !can("history") ? <Locked /> : events.length === 0 ? <EmptyState title="Nenhum evento registrado." /> : (
    <ol className="tl-list">
      {events.map((e, i) => (
        <li key={`${e.event_date}|${e.title}|${i}`} className={`tl-ev${e.kind === "alert" ? " is-alert" : ""}`}>
          <span className="tl-dot" aria-hidden="true" />
          <div className="tl-card">
            <span className="tl-row"><span className="tl-kind">{KIND_LABEL[e.kind]}</span><span className="tl-date">{eventDateLabel(e)}</span></span>
            <span className="tl-title">{e.title}</span>
            {describeEvent(e) && <span className="tl-detail">{describeEvent(e)}</span>}
          </div>
        </li>
      ))}
    </ol>
  );

  return (
    <main className="screen dr" aria-labelledby="dr-name">
      <button type="button" className="dr-back" onClick={onBack}><ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />Voltar aos pacientes</button>
      <header className="dr-head">
        <h2 id="dr-name" className="dr-name">{p.full_name}</h2>
        {meta && <p className="caption">{meta}</p>}
      </header>
      <div className="dr-grid">
        <div className="dr-left">
          <Section id="dr-out" title="Fora da faixa do laudo" defaultOpen>{outBody}</Section>
          <Section id="dr-trend" title="Tendências">{trendBody}</Section>
        </div>
        <div className="dr-right">
          <Section id="dr-watch" title="Sinais do relógio">{watchBody}</Section>
          <Section id="dr-time" title="Linha do tempo">{timeBody}</Section>
        </div>
      </div>
      {can("exams") && <button type="button" className="dr-all" onClick={onAll}>Ver todos os exames</button>}
      <p className="sr-only">Liberado: {categories.map((c) => CATEGORY_LABEL[c]).join(", ")}.</p>
    </main>
  );
}

/** Faixa permanente de somente leitura. */
export function ReadOnlyStrip({ text, icon }: { text: string; icon: ReactNode }) {
  return <div className="dr-strip" role="note">{icon}<span>{text}</span></div>;
}
