export type Section = "inicio" | "exames" | "enviar" | "alertas" | "acessos";

const ITEMS: { id: Section; label: string; icon: string }[] = [
  { id: "inicio", label: "Início", icon: "⌂" },
  { id: "exames", label: "Exames", icon: "▤" },
  { id: "enviar", label: "Enviar", icon: "＋" },
  { id: "alertas", label: "Alertas", icon: "▲" },
  { id: "acessos", label: "Acessos", icon: "◉" },
];

/** Barra inferior fixa (no maximo 5 itens), com "Enviar" em destaque. */
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
        {ITEMS.filter((i) => items.includes(i.id)).map((i) => (
          <li key={i.id}>
            <button
              type="button"
              className={`bn-item${i.id === "enviar" ? " bn-primary" : ""}`}
              aria-current={current === i.id ? "page" : undefined}
              onClick={() => onGo(i.id)}
            >
              <span className="bn-icon" aria-hidden="true">
                {i.icon}
              </span>
              <span className="bn-label">{i.label}</span>
              {i.id === "alertas" && alertCount > 0 && (
                <span className="bn-count" aria-label={`${alertCount} ${alertCount === 1 ? "alerta" : "alertas"} para atenção`}>
                  {alertCount}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
