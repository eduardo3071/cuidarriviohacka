import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertsPanel } from "./components/AlertsPanel";
import { BiomarkerList } from "./components/BiomarkerList";
import { DataTable } from "./components/DataTable";
import { PointDetail } from "./components/PointDetail";
import { SeriesChart } from "./components/SeriesChart";
import { Timeline } from "./components/Timeline";
import { WearablesPanel } from "./components/WearablesPanel";
import { demoSource, type DataSource } from "./data/source";
import { buildSeries, labIndexes, pointKey, sortForList } from "./lib/series";
import { attentionCount } from "./lib/wearables";
import type { EventKind, HealthData } from "./types";

/** Exame aberto por padrao na demonstracao (a historia: tres laboratorios, unidades diferentes). */
export const DEFAULT_BIOMARKER = "Glicemia de jejum";

type View = "exames" | "relogio";

export default function App({ source = demoSource }: { source?: DataSource }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    source
      .load()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError("Não foi possível carregar os dados."));
    return () => {
      alive = false;
    };
  }, [source]);

  if (error)
    return (
      <main className="app">
        <p role="alert">{error}</p>
      </main>
    );
  if (!data)
    return (
      <main className="app">
        <p>Carregando…</p>
      </main>
    );
  return <Dashboard data={data} />;
}

export function Dashboard({
  data,
  initialView = "exames",
  banner,
}: {
  data: HealthData;
  initialView?: View;
  /** Aviso fixo no topo (ex.: "visao somente leitura" do medico). */
  banner?: ReactNode;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
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
  const notShown = data.points.length - series.reduce((n, s) => n + s.points.length, 0);
  const showWatch = view === "relogio" || !current;

  const toggleKind = (k: EventKind) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Hub de Saúde</h1>
          <p className="muted">{data.patient.full_name}</p>
        </div>
        {data.synthetic && <span className="badge-synth">Dados sintéticos de demonstração</span>}
      </header>
      {banner}

      <nav className="tabs" aria-label="Seções">
        <button type="button" aria-pressed={!showWatch} onClick={() => setView("exames")} disabled={!current}>
          Exames
        </button>
        <button type="button" aria-pressed={showWatch} onClick={() => setView("relogio")}>
          Relógio e alertas
          {nAttention > 0 && (
            <span className="count" aria-label={`${nAttention} ${nAttention === 1 ? "alerta" : "alertas"} para atenção`}>
              {nAttention}
            </span>
          )}
        </button>
      </nav>

      {nAttention > 0 && !showWatch && (
        <button type="button" className="alert-banner" onClick={() => setView("relogio")}>
          <span aria-hidden="true">▲</span>{" "}
          {nAttention === 1 ? "1 sinal do relógio merece atenção" : `${nAttention} sinais do relógio merecem atenção`} — ver por que
          disparou
        </button>
      )}

      <div className={`layout${showWatch ? " no-side" : ""}`}>
        {!showWatch && (
          <aside className="panel side" aria-label="Exames do histórico">
            <h2>Exames</h2>
            <BiomarkerList
              series={list}
              selected={current!.biomarker}
              onSelect={(b) => {
                setSelectedName(b);
                setSelectedKey(null);
              }}
            />
          </aside>
        )}

        {showWatch ? (
          <main className="panel main">
            <h2>Relógio e alertas</h2>
            <p className="muted">
              Os alertas vêm de regras fixas sobre os dados do relógio (não de uma IA) e cada um mostra por que disparou.
              Eles orientam procurar um médico e não fazem diagnóstico.
            </p>
            <AlertsPanel alerts={data.alerts} />
            <h2 className="sub">Sinais do relógio</h2>
            <WearablesPanel samples={data.wearables} />
          </main>
        ) : (
          <main className="panel main">
            <h2>{current!.biomarker}</h2>
            <p className="muted">
              Todos os resultados na mesma unidade ({current!.unit}), mesmo quando vieram de laboratórios e unidades diferentes.
            </p>
            <SeriesChart series={current!} labIndex={labs} selectedKey={pointKey(selectedPoint!)} onSelect={setSelectedKey} />
            <PointDetail p={selectedPoint!} />
            <DataTable series={current!} />
            {notShown > 0 && (
              <p className="muted" role="note">
                {notShown === 1
                  ? "1 leitura não pôde ser normalizada e não aparece nos gráficos."
                  : `${notShown} leituras não puderam ser normalizadas e não aparecem nos gráficos.`}
              </p>
            )}
          </main>
        )}

        <section className="panel time">
          <h2>Linha do tempo</h2>
          <Timeline events={data.events} hidden={hidden} onToggle={toggleKind} />
        </section>
      </div>

      <footer className="muted foot">
        Este painel organiza resultados e sinais e não faz diagnóstico nem substitui a avaliação de um médico. “Fora da faixa” é
        sempre em relação à faixa impressa no próprio laudo.
      </footer>
    </div>
  );
}
