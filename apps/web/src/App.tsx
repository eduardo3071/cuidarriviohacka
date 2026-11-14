import { Button, EmptyState, ErrorState } from "./components/ui";
import { ScreenSkeleton } from "./components/ScreenSkeleton";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertsNote, AlertsPanel } from "./components/AlertsPanel";
import { BiomarkerList } from "./components/BiomarkerList";
import { type Section } from "./components/BottomNav";
import { RangeRuler } from "./components/RangeRuler";
import { rangeText, StateChip } from "./components/StateChip";
import { Bell, ChevronLeft, Upload } from "lucide-react";
import "./dashboard.css";
import { ConnectionNotice } from "./components/ConnectionNotice";
import { DataTable } from "./components/DataTable";
import { PointDetail } from "./components/PointDetail";
import { SeriesChart } from "./components/SeriesChart";
import { Sheet } from "./components/Sheet";
import { Timeline } from "./components/Timeline";
import { AppShell } from "./components/AppShell";
import { FirstAccess } from "./components/FirstAccess";
import { WearablesPanel } from "./components/WearablesPanel";
import { demoSource, type DataSource } from "./data/source";
import { fmtDate, fmtNum } from "./lib/format";
import { buildSeries, labIndexes, labName, pointKey, sortForList, summarize } from "./lib/series";
import { attentionCount } from "./lib/wearables";
import type { EventKind, HealthData } from "./types";
import type { Category } from "./data/api";
import { SAFETY_COPY } from "./lib/safetyCopy";
import { PitchTour } from "./pitch/PitchTour";

/** Exame aberto por padrao na demonstracao (a historia: tres laboratorios, unidades diferentes). */
export const DEFAULT_BIOMARKER = "Glicemia de jejum";

export type View = Section;
type ExamTab = "resultados" | "linha";

export default function App({ source = demoSource }: { source?: DataSource }) {
  const [data, setData] = useState<HealthData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);

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
        <div className="screen-loading"><ErrorState title="Não foi possível carregar os dados." description="Confira a internet e tente de novo." onRetry={() => window.location.reload()} /></div>
      </main>
    );
  if (!data)
    return (
      <main className="app">
        <ConnectionNotice />
        <ScreenSkeleton />
      </main>
    );
  if (presenting) return <PitchTour onExit={() => setPresenting(false)} />;
  return <Dashboard data={data} onPresent={() => setPresenting(true)} />;
}

export interface DashboardProps {
  data: HealthData;
  initialView?: View;
  initialExamTab?: ExamTab;
  /** Aviso fixo no topo (ex.: "visao somente leitura" do medico). */
  banner?: ReactNode;
  /** Visao do medico: sem Enviar e sem Acessos. */
  readOnly?: boolean;
  /** Somente apresentação: as permissões são aplicadas antes do carregamento dos dados. */
  availableCategories?: Category[];
  /** Tela de envio de laudo (paciente logado). Sem ela, explica como liberar. */
  /** Tela de envio; como função, recebe o atalho para abrir Exames. */
  upload?: ReactNode | ((nav: { goExams: () => void }) => ReactNode);
  /** Tela "Privacidade e acessos" (paciente logado). */
  privacy?: ReactNode;
  /** Primeiro acesso: abre a demonstração. */
  onDemo?: () => void;
  /** Primeiro acesso: sair da conta. */
  onSignOut?: () => void;
  /** Modo demonstração: mostra o botão "Apresentar" (pitch guiado). */
  onPresent?: () => void;
}

export function Dashboard({ data, initialView = "inicio", initialExamTab = "resultados", banner, readOnly = false, availableCategories, upload, privacy, onDemo, onSignOut, onPresent }: DashboardProps) {
  const [view, setView] = useState<View>(initialView);
  const [examTab, setExamTab] = useState<ExamTab>(initialExamTab);
  const [detailOpen, setDetailOpen] = useState(initialView === "exames");
  const uploadNode = typeof upload === "function" ? upload({ goExams: () => { setExamTab("resultados"); setView("exames"); } }) : upload;
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetKey, setSheetKey] = useState<string | null>(null);
  const [hidden, setHidden] = useState<ReadonlySet<EventKind>>(new Set());

  const series = useMemo(() => buildSeries(data.points), [data]);
  const list = useMemo(() => sortForList(series), [series]);
  const labs = useMemo(() => labIndexes(data.points), [data]);
  const nAttention = attentionCount(data.alerts);

  if (series.length === 0 && data.wearables.length === 0 && !readOnly)
    return (
      <AppShell current={view} onGo={(s) => s !== "pacientes" && setView(s)} accountName={data.patient.full_name} synthetic={data.synthetic} onSignOut={onSignOut} banner={banner} onPresent={onPresent}
        title={view === "enviar" ? "Enviar laudo" : view === "acessos" ? "Privacidade e acessos" : view === "alertas" ? "Alertas" : view === "exames" ? "Exames" : "Início"}>
        {view === "enviar" ? (uploadNode ?? <main className="screen panel"><h2>Enviar laudo</h2><p>Na demonstração não é possível enviar laudos.</p></main>)
          : view === "acessos" && privacy ? privacy
          : <FirstAccess patientName={data.patient.full_name} onSendFirst={() => setView("enviar")} onDemo={onDemo} />}
      </AppShell>
    );

  const current = series.find((s) => s.biomarker === (selectedName ?? DEFAULT_BIOMARKER)) ?? list[0];
  const selectedPoint = current ? (current.points.find((p) => pointKey(p) === selectedKey) ?? current.points[current.points.length - 1]!) : null;
  const sheetPoint = current && sheetKey ? current.points.find((p) => pointKey(p) === sheetKey) : undefined;
  const notShown = data.points.length - series.reduce((n, s) => n + s.points.length, 0);
  // sem exames, "Exames" e "Inicio" levam direto aos alertas
  const shown: View = !current && !readOnly && (view === "exames" || view === "inicio") ? "alertas" : view;
  const sectionAvailable = !readOnly || !availableCategories || availableCategories.includes(shown === "alertas" ? "wearables" : shown === "exames" && examTab === "linha" ? "history" : "exams");
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

  const labCount = new Set(data.points.map((p) => labName(p))).size;
  const lastDate = data.points.reduce((m, p) => (p.collected_at > m ? p.collected_at : m), "");
  const lastPts = data.points.filter((p) => p.collected_at === lastDate);
  const lastLab = lastPts[0] ? labName(lastPts[0]) : "";
  const latest = current ? summarize(current).latest : null;
  const titles: Record<Section, string> = { inicio: "Início", exames: "Exames", enviar: "Enviar laudo", alertas: "Alertas", acessos: "Privacidade e acessos" };
  const firstName = data.patient.full_name.split(" ")[0];
  const attentionCard = nAttention > 0 && (
    <div className="alert-banner"><div className="att-card">
      <p className="att-title"><Bell size={24} strokeWidth={1.75} aria-hidden="true" />{nAttention === 1 ? "1 sinal do relógio merece atenção" : `${nAttention} sinais do relógio merecem atenção`}</p>
      <p>Regras fixas, não IA. Converse com um médico.</p>
      <button type="button" className="att-link" onClick={() => go("alertas")}>Ver por quê</button>
    </div></div>
  );
  const sendButton = !readOnly && (
    <button type="button" className="ds-button ds-button-primary wide" onClick={() => go("enviar")}><Upload size={20} strokeWidth={1.75} aria-hidden="true" />Enviar um laudo</button>
  );

  return (
    <AppShell current={shown} onGo={(s) => s !== "pacientes" && go(s)} items={items} alertCount={nAttention} accountName={data.patient.full_name} synthetic={data.synthetic} onSignOut={onSignOut} banner={banner} onPresent={onPresent} title={titles[shown]}>
      <ConnectionNotice />

      {shown === "inicio" && current && sectionAvailable && (
        <main className="screen home" aria-labelledby="h-inicio">
          <div className="warm">
            <h2 id="h-inicio">Olá, {firstName}</h2>
            <p>Veja o que merece atenção hoje.</p>
          </div>
          <div className="home-att-m">{attentionCard}</div>
          <div className="stats">
            <div className="stat"><strong>{data.points.length}</strong><span>resultados</span></div>
            <div className="stat"><strong>{labCount}</strong><span>{labCount === 1 ? "laboratório" : "laboratórios"}</span></div>
            <div className="stat"><strong>{nAttention}</strong><span>alertas de atenção</span></div>
          </div>
          <div className="home-grid">
            <section className="out-card" aria-labelledby="h-fora">
              <h3 id="h-fora">Fora da faixa do laudo</h3>
              <p className="caption">Comparado com a faixa impressa no próprio laudo. Converse com um médico sobre eles.</p>
              {attentionExams.length === 0 ? (
                <EmptyState title="Nenhum exame recente está fora da faixa do próprio laudo." description="Os resultados continuam guardados em Exames." action={<Button variant="secondary" onClick={() => go("exames")}>Ver meus exames</Button>} />
              ) : (
                <ul className="out-list">
                  {attentionExams.slice(0, 4).map((s) => {
                    const l = summarize(s).latest;
                    const r = rangeText(l.ref_low, l.ref_high);
                    return (
                      <li key={s.biomarker}>
                        <button type="button" className="out-item" onClick={() => openExam(s.biomarker)}>
                          <span className="out-top"><span className="out-name">{s.biomarker}</span><span className="out-val">{fmtNum(l.value)} <small>{s.unit}</small></span></span>
                          <RangeRuler value={l.value} low={l.ref_low} high={l.ref_high} unit={s.unit} flag={l.flag} showLabel={false} />
                          <span className="out-foot"><StateChip flag={l.flag} short />{r && <span className="caption">faixa {r}</span>}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <div className="home-side">
              <div className="home-att-d">{attentionCard}</div>
              {lastDate && (
                <div className="ds-card last-card">
                  <p className="caption">Último exame guardado</p>
                  <p className="last-n">{lastPts.length} {lastPts.length === 1 ? "resultado" : "resultados"}</p>
                  <p className="caption">{fmtDate(lastDate)} · {lastLab}</p>
                  {sendButton}
                </div>
              )}
            </div>
          </div>
          <div className="home-send-m">{sendButton}</div>
        </main>
      )}

      {shown === "exames" && (
        <main className={`screen exams-screen${detailOpen && examTab === "resultados" ? " detail-open" : ""}`} aria-labelledby="h-exames">
          <div className="exams-head">
            <h2 id="h-exames" className="page-title">Exames</h2>
            <div className="segmented" role="tablist" aria-label="Exames">
              <button type="button" role="tab" aria-selected={examTab === "resultados"} onClick={() => setExamTab("resultados")}>Exames</button>
              <button type="button" role="tab" aria-selected={examTab === "linha"} onClick={() => setExamTab("linha")}>Linha do tempo</button>
            </div>
          </div>

          {!sectionAvailable ? <p>{SAFETY_COPY.unavailable}</p> : examTab === "linha" ? (
            <div className="tl-wrap">
              <h2 className="sr-only">Linha do tempo</h2>
              <Timeline events={data.events} hidden={hidden} onToggle={toggleKind} />
            </div>
          ) : current && latest ? (
            <div className={`exams${detailOpen ? " detail-open" : ""}`}>
              <aside className="side list-card" aria-label="Exames do histórico">
                <BiomarkerList series={list} selected={current.biomarker} onSelect={openExam} grouped />
              </aside>
              <section className="main" aria-label={`Evolução de ${current.biomarker}`}>
                <button type="button" className="back" onClick={() => setDetailOpen(false)}><ChevronLeft size={20} strokeWidth={1.75} aria-hidden="true" />Exames</button>
                <div className="exam-head">
                  <h2>{current.biomarker}</h2>
                  <span className="exam-head-chip"><StateChip flag={latest.flag} /></span>
                </div>
                <p className="exam-note">Todos os resultados na mesma unidade ({current.unit}), mesmo vindos de laboratórios e unidades diferentes.</p>
                <div className="ds-card highlight">
                  <p className="hl-value"><strong>{fmtNum(latest.value)}</strong> <span>{current.unit}</span></p>
                  <StateChip flag={latest.flag} />
                  <RangeRuler value={latest.value} low={latest.ref_low} high={latest.ref_high} unit={current.unit} flag={latest.flag} showLabel={false} />
                  <p className="caption">{labName(latest)} · {fmtDate(latest.collected_at)} · faixa impressa no laudo: {rangeText(latest.raw_ref_low, latest.raw_ref_high) ?? "não informada"}</p>
                </div>
                <div className="ds-card chart-box">
                  <SeriesChart series={current} labIndex={labs} selectedKey={pointKey(selectedPoint!)} onSelect={setSelectedKey} onOpen={(k) => { if (typeof window === "undefined" || window.innerWidth < 1024) setSheetKey(k); }} />
                </div>
                <div className="exam-cols">
                  {selectedPoint && (
                    <div className="ds-card point-card">
                      <h3>Detalhe do ponto selecionado</h3>
                      <PointDetail p={selectedPoint} />
                    </div>
                  )}
                  <div className="ds-card table-card">
                    <DataTable series={current} selectedKey={pointKey(selectedPoint!)} onOpen={(k) => { setSelectedKey(k); if (typeof window === "undefined" || window.innerWidth < 1024) setSheetKey(k); }} />
                  </div>
                </div>
                {notShown > 0 && (
                  <p className="muted" role="note">
                    {notShown === 1
                      ? "1 leitura não pôde ser normalizada e não aparece nos gráficos."
                      : `${notShown} leituras não puderam ser normalizadas e não aparecem nos gráficos.`}
                  </p>
                )}
              </section>
            </div>
          ) : <EmptyState title="Nenhum resultado disponível ainda." description={readOnly ? undefined : "Envie um laudo para ver seus resultados aqui."} action={readOnly ? undefined : <Button onClick={() => go("enviar")}>Enviar um laudo</Button>} />}
        </main>
      )}

      {readOnly && shown === "inicio" && (!sectionAvailable || !current) && (
        <main className="screen"><h2>Início</h2>{!sectionAvailable ? <p>{SAFETY_COPY.unavailable}</p> : <EmptyState title="Nenhum resultado disponível ainda." />}</main>
      )}

      {shown === "alertas" && (
        <main className="screen alerts-screen" aria-labelledby="h-alertas">
          <h2 id="h-alertas" className="page-title">Relógio e alertas</h2>
          {sectionAvailable ? <>
          <AlertsNote />
          <AlertsPanel alerts={data.alerts} />
          <h3 className="sec-title">Sinais do relógio</h3>
          <WearablesPanel samples={data.wearables} />
          </> : <p>{SAFETY_COPY.unavailable}</p>}
        </main>
      )}

      {shown === "enviar" && !readOnly &&
        (uploadNode ?? (
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

      <footer className="muted foot">{SAFETY_COPY.footer}</footer>

      <Sheet open={!!sheetPoint} title={sheetPoint ? `Resultado de ${fmtDate(sheetPoint.collected_at)}` : "Detalhe do resultado"} onClose={() => setSheetKey(null)}>
        {sheetPoint && <PointDetail p={sheetPoint} />}
      </Sheet>
    </AppShell>
  );
}
