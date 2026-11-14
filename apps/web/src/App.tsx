import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertsPanel } from "./components/AlertsPanel";
import { BiomarkerList } from "./components/BiomarkerList";
import { BottomNav, type Section } from "./components/BottomNav";
import { ConnectionNotice, Loading } from "./components/ConnectionNotice";
import { DataTable } from "./components/DataTable";
import { PointDetail } from "./components/PointDetail";
import { SeriesChart } from "./components/SeriesChart";
import { Sheet } from "./components/Sheet";
import { Timeline } from "./components/Timeline";
import { WearablesPanel } from "./components/WearablesPanel";
import { demoSource, type DataSource } from "./data/source";
import { FLAG_LABEL, fmtDate, fmtNum } from "./lib/format";
import { buildSeries, labIndexes, labName, pointKey, sortForList, summarize } from "./lib/series";
import { attentionCount } from "./lib/wearables";
import type { EventKind, HealthData } from "./types";

/** Exame aberto por padrao na demonstracao (a historia: tres laboratorios, unidades diferentes). */
export const DEFAULT_BIOMARKER = "Glicemia de jejum";

export type View = Section;
type ExamTab = "resultados" | "linha";

export default function App({ source = demoSource }: { source?: DataSource }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    source
      .load()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError("Não foi possível carregar os dados. Confira a internet e tente de novo."));
    return () => {
      alive = false;
    };
  }, [source]);

  if (error)
    return (
      <main className="app">
        <ConnectionNotice />
        <p role="alert">{error}</p>
      </main>
    );
  if (!data)
    return (
      <main className="app">
        <ConnectionNotice />
        <Loading />
      </main>
    );
  return <Dashboard data={data} />;
}

export interface DashboardProps {
  data: HealthData;
  initialView?: View;
  initialExamTab?: ExamTab;
  /** Aviso fixo no topo (ex.: "visao somente leitura" do medico). */
  banner?: ReactNode;
  /** Visao do medico: sem Enviar e sem Acessos. */
  readOnly?: boolean;
  /** Tela de envio de laudo (paciente logado). Sem ela, explica como liberar. */
  upload?: ReactNode;
  /** Tela "Privacidade e acessos" (paciente logado). */
  privacy?: ReactNode;
}

export function Dashboard({ data, initialView = "inicio", initialExamTab = "resultados", banner, readOnly = false, upload, privacy }: DashboardProps) {
  const [view, setView] = useState<View>(initialView);
  const [examTab, setExamTab] = useState<ExamTab>(initialExamTab);
  const [detailOpen, setDetailOpen] = useState(initialView === "exames");
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<EventKind>>(new Set());

  const series = useMemo(() => buildSeries(data.points), [data]);
  const list = useMemo(() => sortForList(series), [series]);
  const labs = useMemo(() => labIndexes(data.points), [data]);
  const nAttention = attentionCount(data.alerts);

  if (series.length === 0 && data.wearables.length === 0)
    return (
      <main className="app">
        {banner}
        <p>Nenhum resultado disponível ainda.</p>
      </main>
    );

  const current = series.find((s) => s.biomarker === (selectedName ?? DEFAULT_BIOMARKER)) ?? list[0];
  const selectedPoint = current ? (current.points.find((p) => pointKey(p) === selectedKey) ?? current.points[current.points.length - 1]!) : null;
  const sheetPoint = current && sheetKey ? current.points.find((p) => pointKey(p) === sheetKey) : undefined;
  const notShown = data.points.length - series.reduce((n, s) => n + s.points.length, 0);
  // sem exames, "Exames" e "Inicio" levam direto aos alertas
  const shown: View = !current && (view === "exames" || view === "inicio") ? "alertas" : view;
  const items: Section[] = readOnly ? ["inicio", "exames", "alertas"] : ["inicio", "exames", "enviar", "alertas", "acessos"];

  const go = (s: Section) => {
    setView(s);
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0 });
  };
  const openExam = (b: string) => {
    setSelectedName(b);
    setSelectedKey(null);
    setExamTab("resultados");
    setDetailOpen(true);
    go("exames");
  };
  const toggleKind = (k: EventKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const attentionExams = list.filter((s) => {
    const f = summarize(s).latest.flag;
    return f === "above" || f === "below";
  });

  return (
    <div className="app has-nav">
      <ConnectionNotice />
      <header className="top">
        <div className="top-id">
          <h1>Hub de Saúde</h1>
          <p className="muted">{data.patient.full_name}</p>
        </div>
        {data.synthetic && <span className="badge-synth">Dados sintéticos de demonstração</span>}
      </header>
      {banner}

      {shown === "inicio" && current && (
        <main className="screen" aria-labelledby="h-inicio">
          <h2 id="h-inicio">Início</h2>
          {nAttention > 0 && (
            <button type="button" className="alert-banner" onClick={() => go("alertas")}>
              <span aria-hidden="true">▲</span>{" "}
              {nAttention === 1 ? "1 sinal do relógio merece atenção" : `${nAttention} sinais do relógio merecem atenção`} — ver por que disparou
            </button>
          )}
          <section className="panel">
            <h3 className="list-title">Exames com resultado fora da faixa do laudo</h3>
            <p className="muted">“Fora da faixa” compara cada resultado com a faixa impressa no próprio laudo. Converse com um médico sobre eles.</p>
            {attentionExams.length === 0 ? (
              <p>Nenhum exame recente está fora da faixa do próprio laudo.</p>
            ) : (
              <BiomarkerList series={attentionExams} selected="" onSelect={openExam} />
            )}
          </section>
          <button type="button" className="secondary wide" onClick={() => openExam(current.biomarker)}>
            Ver todos os exames
          </button>
        </main>
      )}

      {shown === "exames" && current && (
        <main className="screen" aria-labelledby="h-exames">
          <h2 id="h-exames" className="sr-only">
            Exames
          </h2>
          <div className="segmented" role="tablist" aria-label="Exames">
            <button type="button" role="tab" aria-selected={examTab === "resultados"} onClick={() => setExamTab("resultados")}>
              Resultados
            </button>
            <button type="button" role="tab" aria-selected={examTab === "linha"} onClick={() => setExamTab("linha")}>
              Linha do tempo
            </button>
          </div>

          {examTab === "linha" ? (
            <section className="panel">
              <h2>Linha do tempo</h2>
              <Timeline events={data.events} hidden={hidden} onToggle={toggleKind} />
            </section>
          ) : (
            <div className={`exams${detailOpen ? " detail-open" : ""}`}>
              <aside className="panel side" aria-label="Exames do histórico">
                <h2>Exames</h2>
                <BiomarkerList series={list} selected={current.biomarker} onSelect={openExam} />
              </aside>
              <section className="panel main" aria-label={`Evolução de ${current.biomarker}`}>
                <button type="button" className="back" onClick={() => setDetailOpen(false)}>
                  ← Todos os exames
                </button>
                <h2>{current.biomarker}</h2>
                <p className="muted">
                  Todos os resultados na mesma unidade ({current.unit}), mesmo quando vieram de laboratórios e unidades diferentes.
                </p>
                <SeriesChart series={current} labIndex={labs} selectedKey={pointKey(selectedPoint!)} onSelect={setSelectedKey} onOpen={setSheetKey} />
                {selectedPoint && (
                  <button type="button" className="selected-line" onClick={() => setSheetKey(pointKey(selectedPoint))}>
                    <span className={`chip flag-${selectedPoint.flag}`}>{FLAG_LABEL[selectedPoint.flag]}</span>
                    <span>
                      {fmtDate(selectedPoint.collected_at)} · {labName(selectedPoint)} · {fmtNum(selectedPoint.value)} {current.unit}
                    </span>
                    <span className="link-like">Ver detalhes</span>
                  </button>
                )}
                <DataTable series={current} onOpen={setSheetKey} />
                {notShown > 0 && (
                  <p className="muted" role="note">
                    {notShown === 1
                      ? "1 leitura não pôde ser normalizada e não aparece nos gráficos."
                      : `${notShown} leituras não puderam ser normalizadas e não aparecem nos gráficos.`}
                  </p>
                )}
              </section>
            </div>
          )}
        </main>
      )}

      {shown === "alertas" && (
        <main className="screen panel" aria-labelledby="h-alertas">
          <h2 id="h-alertas">Relógio e alertas</h2>
          <p className="muted">
            Os alertas vêm de regras fixas sobre os dados do relógio (não de uma IA) e cada um mostra por que disparou. Eles orientam procurar um médico e
            não fazem diagnóstico.
          </p>
          <AlertsPanel alerts={data.alerts} />
          <h2 className="sub">Sinais do relógio</h2>
          <WearablesPanel samples={data.wearables} />
        </main>
      )}

      {shown === "enviar" && !readOnly &&
        (upload ?? (
          <main className="screen panel">
            <h2>Enviar laudo</h2>
            <p>Na demonstração não é possível enviar laudos. Entre com a sua conta para enviar um PDF ou uma foto do laudo.</p>
          </main>
        ))}

      {shown === "acessos" && !readOnly &&
        (privacy ?? (
          <main className="screen panel">
            <h2>Privacidade e acessos</h2>
            <p>Na demonstração ninguém tem acesso aos dados. Entre com a sua conta para escolher quem pode ver, o quê e até quando, e para revogar acessos.</p>
          </main>
        ))}

      <footer className="muted foot">
        Este painel organiza resultados e sinais e não faz diagnóstico nem substitui a avaliação de um médico. “Fora da faixa” é sempre em relação à faixa
        impressa no próprio laudo.
      </footer>

      <Sheet open={!!sheetPoint} title="Detalhe do resultado" onClose={() => setSheetKey(null)}>
        {sheetPoint && <PointDetail p={sheetPoint} />}
      </Sheet>

      <BottomNav current={shown} onGo={go} items={items} alertCount={nAttention} />
    </div>
  );
}
