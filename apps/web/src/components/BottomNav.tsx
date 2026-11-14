import { Bell, FilePlus2, FlaskConical, House, ShieldCheck, type LucideIcon } from "lucide-react";

export type Section = "inicio" | "exames" | "enviar" | "alertas" | "acessos";

export const NAV_ITEMS: readonly { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "inicio", label: "Início", icon: House },
  { id: "exames", label: "Exames", icon: FlaskConical },
  { id: "enviar", label: "Enviar", icon: FilePlus2 },
  { id: "alertas", label: "Alertas", icon: Bell },
  { id: "acessos", label: "Acessos", icon: ShieldCheck },
];

/** Barra inferior fixa (no máximo 5 itens), com "Enviar" em destaque. */
export function BottomNav({
  current,
  onGo,
  items,
  alertCount,
}: {
  current: Section;
  onGo: (s: Section) => void;
  items: readonly Section[];
  alertCount: number;
}) {
  return (
    <nav className="bottomnav" aria-label="Navegação principal">
      <ul>
        {NAV_ITEMS.filter((i) => items.includes(i.id)).map((i) => {
          const Icon = i.icon;
          return (
            <li key={i.id}>
              <button
                type="button"
                className={`bn-item${i.id === "enviar" ? " bn-primary" : ""}`}
                aria-current={current === i.id ? "page" : undefined}
                onClick={() => onGo(i.id)}
              >
                <span className="bn-icon" aria-hidden="true"><Icon size={24} strokeWidth={1.75} /></span>
                <span className="bn-label">{i.label}</span>
                {i.id === "alertas" && alertCount > 0 && (
                  <span className="bn-count" aria-label={`${alertCount} ${alertCount === 1 ? "alerta" : "alertas"} para atenção`}>
                    {alertCount}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
