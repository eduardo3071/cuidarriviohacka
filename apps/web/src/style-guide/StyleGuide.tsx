import { Check, Moon, Plus, Sun } from "lucide-react";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import demo from "../demo/marta.json";
import { AppShell } from "../components/AppShell";
import { RangeRuler } from "../components/RangeRuler";
import { SeriesChart } from "../components/SeriesChart";
import {
  BottomSheet,
  Button,
  Card,
  Checkbox,
  Dialog,
  EmptyState,
  ErrorState,
  Input,
  Select,
  Skeleton,
  StateBadge,
  Tabs,
  Toast,
} from "../components/ui";
import type { Section } from "../components/BottomNav";
import { fmtDate, fmtNum, fmtRange } from "../lib/format";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { buildSeries, labIndexes, pointKey } from "../lib/series";
import type { EventKind, Flag, HealthData, SeriesPoint } from "../types";

const data = demo as HealthData;
const series = buildSeries(data.points);
const glicemia = series.find((item) => item.biomarker === "Glicemia de jejum")!;
const latest = glicemia.points[glicemia.points.length - 1]!;
const labs = labIndexes(data.points);
const below = data.points.find((point) => point.flag === "below")!;
const inRange = data.points.find((point) => point.flag === "in_range")!;

const PALETTE = [
  { name: "Fundo", token: "--color-background", hex: "#F7F4EC" },
  { name: "Superfície", token: "--color-surface", hex: "#FFFFFF" },
  { name: "Superfície 2", token: "--color-surface-2", hex: "#FBF8F1" },
  { name: "Linha", token: "--color-line", hex: "#E6DFCF" },
  { name: "Tinta", token: "--color-ink", hex: "#0E2B2A" },
  { name: "Tinta 2", token: "--color-ink-2", hex: "#4A6360" },
  { name: "Marca", token: "--color-brand", hex: "#0B4F4A" },
  { name: "Marca suave", token: "--color-brand-soft", hex: "#DDF0EA" },
  { name: "Destaque âmbar", token: "--color-amber", hex: "#F59E0B" },
];

const EXAM_COLORS: { state: Flag; name: string; token: string; background: string; hex: string }[] = [
  { state: "above", name: "Acima", token: "--color-above", background: "--color-above-bg", hex: "#A33E08 / #FDEBDD" },
  { state: "below", name: "Abaixo", token: "--color-below", background: "--color-below-bg", hex: "#1E40AF / #E4ECFD" },
  { state: "in_range", name: "Dentro", token: "--color-in-range", background: "--color-in-range-bg", hex: "#0A6A5C / #DDF3EC" },
  { state: "no_range", name: "Sem faixa", token: "--color-no-range", background: "--color-no-range-bg", hex: "#546461 / #EDF0EF" },
];

const KIND_LABEL: Record<EventKind, string> = {
  exam: "Exame",
  encounter: "Consulta",
  medication_start: "Início de remédio",
  medication_end: "Fim de remédio",
  vaccine: "Vacina",
  alert: "Alerta",
};

function GuideSection({ id, eyebrow, title, children, className = "" }: { id: string; eyebrow: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={`guide-section ${className}`} aria-labelledby={`${id}-title`}>
      <div className="guide-section-heading">
        <span className="guide-eyebrow">{eyebrow}</span>
        <h2 id={`${id}-title`}>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Swatch({ name, token, hex }: { name: string; token: string; hex: string }) {
  return (
    <div className="swatch-card">
      <span className="color-sample" style={{ "--sample": `var(${token})` } as CSSProperties} aria-hidden="true" />
      <strong>{name}</strong>
      <code>{hex}</code>
      <code>{token}</code>
    </div>
  );
}

export function StyleGuide() {
  const [section, setSection] = useState<Section | "pacientes">("inicio");
  const [dark, setDark] = useState(false);
  const [tab, setTab] = useState("componentes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState(pointKey(latest));

  useEffect(() => {
    document.title = "Guia de estilo — Rivio";
    if (dark) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
    return () => { delete document.documentElement.dataset.theme; };
  }, [dark]);

  const go = (next: Section | "pacientes") => {
    setSection(next);
    setNotice("As telas serão conectadas depois da aprovação desta fundação visual.");
  };

  const rulers: { title: string; point: SeriesPoint; flag: Flag; low: number | null; high: number | null }[] = [
    { title: "Acima da faixa", point: latest, flag: "above", low: latest.ref_low, high: latest.ref_high },
    { title: "Abaixo da faixa", point: below, flag: "below", low: below.ref_low, high: below.ref_high },
    { title: "Dentro da faixa", point: inRange, flag: "in_range", low: inRange.ref_low, high: inRange.ref_high },
    { title: "Sem faixa no laudo", point: latest, flag: "no_range", low: null, high: null },
  ];

  return (
    <AppShell current={section} onGo={go} alertCount={3} accountName={data.patient.full_name}>
      <main className="style-guide">
        <header className="guide-hero">
          <div>
            <span className="guide-eyebrow">Fase 0 · Fundação visual</span>
            <h1>Clareza clínica,<br /><em>calor humano.</em></h1>
            <p>Uma linguagem visual calma para entender resultados de exames e saber quando conversar com um médico.</p>
          </div>
          <Button variant="secondary" icon={dark ? Sun : Moon} onClick={() => setDark((value) => !value)}>
            {dark ? "Ver tema claro" : "Ver tema escuro"}
          </Button>
        </header>

        <nav className="guide-index" aria-label="Neste guia">
          <a href="#paleta">Paleta</a><a href="#tipografia">Tipografia</a><a href="#componentes">Componentes</a>
          <a href="#regua">Régua da faixa</a><a href="#grafico">Gráfico</a><a href="#assinaturas">Assinaturas</a>
        </nav>

        <GuideSection id="paleta" eyebrow="01 · Cor com significado" title="Paleta essencial">
          <p className="guide-intro">Os pares de texto e fundo foram conferidos para contraste AA. O tema escuro usa os valores correspondentes da direção de arte.</p>
          <div className="palette-grid">{PALETTE.map((color) => <Swatch key={color.token} {...color} />)}</div>
          <div className="guide-subsection">
            <h3>Estados do exame</h3>
            <div className="state-color-grid">
              {EXAM_COLORS.map((color) => (
                <div className="state-color" key={color.state} style={{ "--state-ink": `var(${color.token})`, "--state-bg": `var(${color.background})` } as CSSProperties}>
                  <StateBadge state={color.state} /><code>{color.hex}</code>
                </div>
              ))}
            </div>
          </div>
          <div className="guide-subsection">
            <h3>Severidade do alerta</h3>
            <div className="badge-row"><StateBadge state="info" /><StateBadge state="attention" /><StateBadge state="urgent" /></div>
          </div>
        </GuideSection>

        <GuideSection id="tipografia" eyebrow="02 · Ritmo editorial" title="Tipografia e escala">
          <div className="type-grid">
            <Card className="type-specimen type-display"><span>Playfair Display · 700</span><p>Saúde em boa companhia.</p><small>Títulos e números grandes</small></Card>
            <Card className="type-specimen"><span>Inter · 400—700</span><p>Informação clara para ler sem pressa, em qualquer idade.</p><small>Textos, campos, botões e legendas</small></Card>
          </div>
          <div className="scale-list">
            <div><span className="scale-number">44/64</span><p><strong>Número grande</strong><br />Playfair Display · celular / desktop</p></div>
            <div><span className="scale-title">28/36</span><p><strong>Título de tela</strong><br />Playfair Display · celular / desktop</p></div>
            <div><span className="scale-section">22/26</span><p><strong>Título de seção</strong><br />Playfair Display · celular / desktop</p></div>
            <div><span className="scale-body">16/17</span><p><strong>Corpo</strong><br />Inter · celular / desktop</p></div>
            <div><span className="scale-caption">14</span><p><strong>Legenda</strong><br />Inter · tamanho mínimo da interface</p></div>
          </div>
          <div className="token-strip"><span>Grade de 4 px</span><span>Raio 16 · cartões</span><span>Raio 12 · controles</span><span>Raio 24 · folhas</span></div>
        </GuideSection>

        <GuideSection id="componentes" eyebrow="03 · Base reutilizável" title="Componentes">
          <div className="component-block"><h3>Botões · altura de 48 px</h3><div className="button-showcase">
            <div><span>Primário</span><Button icon={Plus} onClick={() => setNotice("Exemplo de ação principal.")}>Ação principal</Button></div>
            <div><span>Secundário</span><Button variant="secondary" onClick={() => setDialogOpen(true)}>Abrir janela</Button></div>
            <div><span>Perigoso</span><Button variant="danger" onClick={() => setSheetOpen(true)}>Revogar acesso</Button></div>
            <div><span>Link</span><Button variant="link" onClick={() => setNotice("Exemplo de aviso temporário.")}>Mostrar aviso</Button></div>
          </div></div>

          <div className="component-block"><h3>Campos · texto de 16 px</h3><div className="fields-grid">
            <Input label="Nome da paciente" defaultValue={data.patient.full_name} hint="O rótulo fica sempre visível." />
            <Select label="Laboratório" defaultValue={latest.lab_name ?? ""}>{[...new Set(glicemia.points.map((point) => point.lab_name))].map((lab) => <option key={lab}>{lab}</option>)}</Select>
            <Input label="Valor do exame" inputMode="decimal" placeholder="Digite o valor" error="Confira este campo antes de continuar." />
            <Checkbox label="Confirmo que revisei as informações." defaultChecked />
          </div></div>

          <div className="component-block"><h3>Cartão, selos e abas</h3><Card className="demo-card">
            <div className="demo-card-head"><div><span className="guide-eyebrow">Cartão de conteúdo</span><h4>{latest.biomarker}</h4></div><StateBadge state={latest.flag} label="Acima" /></div>
            <p>A faixa usada na comparação é sempre a impressa no próprio laudo.</p>
            <Tabs ariaLabel="Exemplo de abas" value={tab} onChange={setTab} items={[{ id: "componentes", label: "Componentes" }, { id: "detalhes", label: "Detalhes" }]} />
            <div role="tabpanel" className="tab-panel">{tab === "componentes" ? "As abas mantêm a escolha visível e funcionam pelo teclado." : "Os detalhes aparecem somente quando a pessoa pede."}</div>
          </Card></div>

          <div className="feedback-grid">
            <div className="component-block"><h3>Carregamento</h3><Card><Skeleton lines={3} /></Card></div>
            <div className="component-block"><h3>Vazio</h3><Card><EmptyState title="Nenhum resultado por aqui" description="Envie um laudo para começar o seu histórico." action={<Button variant="link">Entendi</Button>} /></Card></div>
            <div className="component-block"><h3>Erro</h3><Card><ErrorState title="Não foi possível carregar" description="Confira a internet e tente de novo." onRetry={() => setNotice("Exemplo de nova tentativa.")} /></Card></div>
          </div>
          <div className="component-block"><h3>Aviso temporário</h3><Toast tone="success" title="Tudo certo" message="Este é um exemplo de confirmação. Nada foi guardado." /></div>
        </GuideSection>

        <GuideSection id="regua" eyebrow="04 · Assinatura principal" title="A régua da faixa">
          <p className="guide-intro">A área verde representa a faixa do próprio laudo. O ponto, o ícone e o texto informam o estado sem depender da cor.</p>
          <div className="ruler-grid">{rulers.map(({ title, point, flag, low, high }) => (
            <Card className="ruler-example" key={flag}>
              <div className="ruler-example-head"><h3>{title}</h3><StateBadge state={flag} label={title.replace(" da faixa", "")} /></div>
              <RangeRuler value={point.value ?? 0} low={low} high={high} unit={point.unit_canonical ?? ""} flag={flag} />
              <p>{low != null || high != null ? `Faixa do laudo: ${fmtRange(low, high, point.unit_canonical)}` : "Faixa não informada no laudo."}</p>
            </Card>
          ))}</div>
        </GuideSection>

        <GuideSection id="grafico" eyebrow="05 · Uma história, três laboratórios" title="Gráfico de evolução">
          <Card className="chart-card">
            <div className="chart-heading"><div><span className="guide-eyebrow">Dados da demonstração</span><h3>{glicemia.biomarker}</h3></div><StateBadge state={latest.flag} label="Acima" /></div>
            <SeriesChart series={glicemia} labIndex={labs} selectedKey={selectedKey} onSelect={setSelectedKey} onOpen={setSelectedKey} />
            <details className="chart-alternative"><summary>Ver os dados do gráfico em lista</summary><ul>{glicemia.points.map((point) => <li key={pointKey(point)}><span>{fmtDate(point.collected_at)} · {point.lab_name}</span><strong>{fmtNum(point.value)} {glicemia.unit}</strong></li>)}</ul></details>
          </Card>
        </GuideSection>

        <GuideSection id="assinaturas" eyebrow="06 · Detalhes reconhecíveis" title="O fio e o número grande" className="guide-last">
          <div className="signature-grid">
            <Card className="thread-card"><h3>Uma linha do tempo contínua</h3><ol className="thread-timeline">
              {data.events.slice(-3).map((event, index) => <li key={`${event.event_date}-${event.title}`}>
                <span className="thread-dot" aria-hidden="true">{index + 1}</span>
                <div><time>{fmtDate(event.event_date)}</time><span>{KIND_LABEL[event.kind]}</span><h4>{event.title}</h4></div>
              </li>)}
            </ol></Card>
            <Card className="number-card"><span className="guide-eyebrow">Último resultado</span><h3>{latest.biomarker}</h3><p className="big-number">{fmtNum(latest.value)} <small>{glicemia.unit}</small></p><StateBadge state={latest.flag} /><RangeRuler value={latest.value} low={latest.ref_low} high={latest.ref_high} unit={glicemia.unit} flag={latest.flag} /><p className="number-note">Coletado em {fmtDate(latest.collected_at)} · {latest.lab_name}</p></Card>
          </div>
        </GuideSection>

        <footer className="guide-footer"><Check size={24} strokeWidth={1.75} aria-hidden="true" /><div><strong>Fundação pronta para a sua revisão.</strong><p>{SAFETY_COPY.footer}</p></div></footer>
      </main>

      <Dialog open={dialogOpen} title="Exemplo de janela" onClose={() => setDialogOpen(false)}><p>Use janelas para decisões curtas que merecem foco.</p><div className="sheet-actions"><Button onClick={() => setDialogOpen(false)}>Entendi</Button></div></Dialog>
      <BottomSheet open={sheetOpen} title="Confirmar revogação" onClose={() => setSheetOpen(false)}><p>{SAFETY_COPY.revoke}</p><div className="sheet-actions"><Button variant="secondary" onClick={() => setSheetOpen(false)}>Cancelar</Button><Button variant="danger" onClick={() => { setSheetOpen(false); setNotice("Exemplo visual: nenhum acesso foi alterado."); }}>Revogar acesso</Button></div></BottomSheet>
      {notice && <div className="toast-region"><Toast title="Guia de estilo" message={notice} onClose={() => setNotice(null)} /></div>}
    </AppShell>
  );
}
