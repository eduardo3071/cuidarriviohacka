import { demoNotice } from "../components/ui";
import "./celular.css";

export const SCREENS: { id: string; title: string }[] = [
  { id: "login", title: "Entrar" },
  { id: "inicio", title: "Início" },
  { id: "exames", title: "Exames: exame escolhido" },
  { id: "linha", title: "Exames: linha do tempo" },
  { id: "alertas", title: "Alertas" },
  { id: "enviar", title: "Enviar laudo" },
  { id: "foto", title: "Enviar laudo: prévia da foto" },
  { id: "acessos", title: "Privacidade e acessos" },
  { id: "medico", title: "Médico: meus pacientes" },
  { id: "resumo", title: "Médico: resumo clínico" },
  { id: "estados", title: "Estados: vazio, erro e carregando" },
];

/** /celular: cada tela em 375x812 ao lado da versão de computador (1280). */
export function Celular() {
  return (
    <main className="cel">
      <header className="cel-head">
        <h1>Revisão para celular</h1>
        <p>Cada tela em 375 × 812 (celular) ao lado da versão de computador (1280 × 800, reduzida).</p>
        <p className="cel-seal" role="note">{demoNotice}</p>
      </header>
      {SCREENS.map((s) => (
        <section key={s.id} className="cel-row" aria-labelledby={`cel-${s.id}`}>
          <h2 id={`cel-${s.id}`}>{s.title}</h2>
          <div className="cel-pair">
            <figure className="cel-phone">
              <iframe title={`${s.title}, celular`} src={`/celular/tela?t=${s.id}`} width={375} height={812} loading="lazy" />
              <figcaption>Celular · 375 × 812</figcaption>
            </figure>
            <figure className="cel-desk">
              <div className="cel-desk-box">
                <iframe title={`${s.title}, computador`} src={`/celular/tela?t=${s.id}`} width={1280} height={800} loading="lazy" />
              </div>
              <figcaption>Computador · 1280 × 800</figcaption>
            </figure>
          </div>
        </section>
      ))}
    </main>
  );
}
