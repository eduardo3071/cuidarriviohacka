import { HeartPulse, LogOut, UserRound, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SAFETY_COPY } from "../lib/safetyCopy";
import { BottomNav, NAV_ITEMS, type Section } from "./BottomNav";
import { Toast } from "./ui";

const SIDE_LABEL: Partial<Record<Section, string>> = { enviar: "Enviar laudo", acessos: "Privacidade e acessos" };

export function Brand() {
  return (
    <span className="brand" aria-label="Rivio">
      <span className="brand-mark"><HeartPulse size={18} strokeWidth={1.75} aria-hidden="true" /></span>
      <span className="brand-name">rivio</span>
    </span>
  );
}

export function AppShell({
  children,
  current,
  onGo,
  items = ["inicio", "exames", "enviar", "alertas", "acessos"],
  alertCount = 0,
  accountName,
  synthetic = true,
  onSignOut,
  doctor = false,
  banner,
  title = "Início",
}: {
  children: ReactNode;
  current: Section | "pacientes";
  onGo: (section: Section | "pacientes") => void;
  items?: readonly Section[];
  alertCount?: number;
  accountName: string;
  synthetic?: boolean;
  onSignOut?: () => void;
  doctor?: boolean;
  banner?: ReactNode;
  title?: string;
}) {
  const [notice, setNotice] = useState(false);
  const signOut = () => onSignOut ? onSignOut() : setNotice(true);
  const patientCurrent = current === "pacientes" ? "inicio" : current;

  return (
    <div className="product-shell">
      <aside className="desktop-sidebar" aria-label="Navegação de desktop">
        <Brand />
        <nav aria-label="Navegação lateral">
          {doctor ? (
            <button type="button" className="side-item" aria-current="page" onClick={() => onGo("pacientes")}>
              <Users size={20} strokeWidth={1.75} aria-hidden="true" /><span>Meus pacientes</span>
            </button>
          ) : NAV_ITEMS.filter((item) => items.includes(item.id)).map((item) => {
            const Icon = item.icon;
            return (
              <button type="button" className="side-item" key={item.id} aria-current={current === item.id ? "page" : undefined} onClick={() => onGo(item.id)}>
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{SIDE_LABEL[item.id] ?? item.label}</span>
                {item.id === "alertas" && alertCount > 0 && <span className="side-count" aria-label={`${alertCount} alertas para atenção`}>{alertCount}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="product-frame">
        <header className="app-topbar">
          <Brand />
          <h1 className="app-topbar-title">{doctor ? "Meus pacientes" : title}</h1>
          {synthetic && <span className="badge-synth" aria-hidden="true">{SAFETY_COPY.synthetic}</span>}
          <details className="account-menu">
            <summary aria-label={`Menu da conta de ${accountName}`}>
              <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
            </summary>
            <div className="account-popover">
              <span className="account-label">Conta de demonstração</span>
              <strong>{accountName}</strong>
              <button type="button" onClick={signOut}><LogOut size={20} strokeWidth={1.75} aria-hidden="true" />Sair</button>
            </div>
          </details>
        </header>
        {synthetic && <div className="seal-strip">{SAFETY_COPY.synthetic}</div>}
        {banner}
        <div className="app has-nav app-shell-content">{children}</div>
      </div>

      {doctor ? (
        <nav className="bottomnav doctor-nav" aria-label="Navegação principal">
          <ul><li><button type="button" className="bn-item" aria-current="page" onClick={() => onGo("pacientes")}>
            <span className="bn-icon"><Users size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className="bn-label">Meus pacientes</span>
          </button></li></ul>
        </nav>
      ) : <BottomNav current={patientCurrent} onGo={onGo} items={items} alertCount={alertCount} />}

      {notice && <div className="toast-region"><Toast title="Somente demonstração" message="Não há uma conta conectada para sair." onClose={() => setNotice(false)} /></div>}
    </div>
  );
}
