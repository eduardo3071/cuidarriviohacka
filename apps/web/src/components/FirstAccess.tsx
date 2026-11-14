import { Check, FileText, Upload, ShieldCheck } from "lucide-react";
import { Button } from "./ui";
import "./first-access.css";

const STEPS = [
  { title: "Envie um laudo", help: "PDF ou foto" },
  { title: "Confira o que foi lido", help: "Você confirma antes de guardar" },
  { title: "Escolha se quer compartilhar com um médico", help: "Só com o seu consentimento" },
];

/** Primeiro acesso: paciente sem nenhum resultado. Puramente visual. */
export function FirstAccess({ patientName, onSendFirst, onDemo }: { patientName: string; onSendFirst: () => void; onDemo?: () => void }) {
  const first = patientName.trim().split(/\s+/)[0] ?? patientName;
  return (
    <section className="first-access" aria-labelledby="fa-hello">
      <div className="fa-warm">
        <h2 id="fa-hello">Olá, {first}</h2>
        <p>Vamos montar o seu histórico</p>
        <p className="sr-only">Nenhum resultado disponível ainda.</p>
      </div>
      <div className="fa-grid">
        <div className="fa-main">
          <div className="ds-card fa-steps">
            <h3>Como começar</h3>
            <ol>
              {STEPS.map((s, i) => (
                <li key={s.title}>
                  <span className="fa-dot" aria-hidden="true">{i + 1}</span>
                  <span><strong>{s.title}</strong><small>{s.help}</small></span>
                </li>
              ))}
            </ol>
          </div>
          <div className="fa-actions">
            <Button icon={Upload} onClick={onSendFirst}>Enviar o primeiro laudo</Button>
            {onDemo && <Button variant="link" onClick={onDemo}>Ver como fica (demonstração)</Button>}
          </div>
        </div>
        <div className="fa-art" aria-hidden="true">
          <svg viewBox="0 0 389 320" preserveAspectRatio="none"><path d="M40 250 C 120 260, 110 90, 194 150 S 300 60, 350 70" /></svg>
          <span style={{ left: 68, top: 222 }}><FileText size={24} strokeWidth={1.75} /></span>
          <span style={{ left: 166, top: 122 }}><Check size={24} strokeWidth={1.75} /></span>
          <span style={{ left: 280, top: 52 }}><ShieldCheck size={24} strokeWidth={1.75} /></span>
        </div>
      </div>
    </section>
  );
}
