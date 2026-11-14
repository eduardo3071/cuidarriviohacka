import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  CircleAlert,
  Info,
  Minus,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import type { Flag, Severity } from "../types";
import { RANGE_LABEL, SAFETY_COPY } from "../lib/safetyCopy";
import { Sheet } from "./Sheet";

const cx = (...names: Array<string | false | undefined>) => names.filter(Boolean).join(" ");

export function Button({
  variant = "primary",
  icon: Icon,
  className,
  type = "button",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "danger-solid" | "link"; icon?: LucideIcon }) {
  return (
    <button type={type} className={cx("ds-button", `ds-button-${variant}`, className)} {...props}>
      {Icon && <Icon size={20} strokeWidth={1.75} aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
}

type FieldProps = { label: string; error?: string; hint?: string };

export function Input({ label, error, hint, id, className, ...props }: InputHTMLAttributes<HTMLInputElement> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descriptionId = `${fieldId}-description`;
  return (
    <div className={cx("ds-field", error && "ds-field-error", className)}>
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} aria-invalid={!!error} aria-describedby={error || hint ? descriptionId : undefined} {...props} />
      {(error || hint) && (
        <p id={descriptionId} className="ds-field-message" role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Select({ label, error, hint, id, className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const descriptionId = `${fieldId}-description`;
  return (
    <div className={cx("ds-field", error && "ds-field-error", className)}>
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} aria-invalid={!!error} aria-describedby={error || hint ? descriptionId : undefined} {...props}>
        {children}
      </select>
      {(error || hint) && (
        <p id={descriptionId} className="ds-field-message" role={error ? "alert" : undefined}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ label, error, id, className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & FieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errorId = `${fieldId}-error`;
  return (
    <div className={cx("ds-checkbox-field", error && "ds-field-error", className)}>
      <label htmlFor={fieldId}>
        <input id={fieldId} type="checkbox" aria-invalid={!!error} aria-describedby={error ? errorId : undefined} {...props} />
        <span>{label}</span>
      </label>
      {error && <p id={errorId} className="ds-field-message" role="alert">{error}</p>}
    </div>
  );
}

export function Card({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("ds-card", className)} {...props}>{children}</div>;
}

const STATE_ICONS: Record<Flag, LucideIcon> = { above: ArrowUp, below: ArrowDown, in_range: Check, no_range: Minus };
const SEVERITY_ICONS: Record<Severity, LucideIcon> = { info: Info, attention: TriangleAlert, urgent: CircleAlert };
const SEVERITY_LABEL: Record<Severity, string> = { info: "Informação", attention: "Atenção", urgent: "Urgente" };

export function StateBadge({ state, label }: { state: Flag | Severity; label?: string }) {
  const isSeverity = state === "info" || state === "attention" || state === "urgent";
  const Icon = isSeverity ? SEVERITY_ICONS[state as Severity] : STATE_ICONS[state as Flag];
  const text = label ?? (isSeverity ? SEVERITY_LABEL[state as Severity] : RANGE_LABEL[state as Flag]);
  return (
    <span className={cx("state-badge", `state-badge-${state}`)}>
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      <span>{text}</span>
    </span>
  );
}

export function Tabs({
  items,
  value,
  onChange,
  ariaLabel,
}: {
  items: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  ariaLabel: string;
}) {
  return (
    <div className="ds-tabs" role="tablist" aria-label={ariaLabel}>
      {items.map((item) => (
        <button
          type="button"
          role="tab"
          key={item.id}
          aria-selected={value === item.id}
          className="ds-tab"
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return <Sheet open={open} title={title} onClose={onClose} variant="dialog">{children}</Sheet>;
}

export function BottomSheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  return <Sheet open={open} title={title} onClose={onClose} variant="bottom">{children}</Sheet>;
}

export function Toast({
  title,
  message,
  tone = "info",
  onClose,
}: {
  title: string;
  message: string;
  tone?: "info" | "success" | "error";
  onClose?: () => void;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "error" ? CircleAlert : Info;
  return (
    <div className={cx("ds-toast", `ds-toast-${tone}`)} role={tone === "error" ? "alert" : "status"}>
      <Icon size={24} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onClose && (
        <button type="button" className="ds-toast-close" onClick={onClose} aria-label="Fechar aviso">
          <X size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Carregando: blocos com a altura do conteúdo final, sem animação em loop. */
export function Skeleton({ lines = 3, className, heights, label = "Carregando conteúdo" }: { lines?: number; className?: string; heights?: number[]; label?: string }) {
  const hs = heights ?? Array.from({ length: lines }, (_, i) => (i === 0 ? 28 : 16));
  return (
    <div className={cx("ds-skeleton", className)} aria-label={label} role="status">
      {hs.map((h, index) => <span key={index} style={{ height: h, width: !heights && index === hs.length - 1 && hs.length > 1 ? "64%" : "100%" }} />)}
    </div>
  );
}

/** O fio curvo da marca (120×40). */
export function Thread() {
  return (
    <svg className="ds-thread" width="120" height="40" viewBox="0 0 120 40" aria-hidden="true" focusable="false">
      <path d="M4 30 C 28 30, 30 10, 60 10 S 92 30, 116 18" fill="none" stroke="var(--color-brand)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="116" cy="18" r="4" fill="var(--color-brand)" />
    </svg>
  );
}

/** Estado vazio padrão: fio, uma frase, apoio e (opcional) uma ação. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="ds-empty" role="status">
      <Thread />
      <p className="ds-empty-title">{title}</p>
      {description && <p className="ds-empty-text">{description}</p>}
      {action && <div className="ds-empty-action">{action}</div>}
    </div>
  );
}

/** Estado de erro padrão: o que houve, o que fazer e "Tentar de novo". */
export function ErrorState({ title, description, onRetry }: { title: string; description?: string; onRetry?: () => void }) {
  return (
    <div className="ds-error" role="alert">
      <CircleAlert size={24} strokeWidth={1.75} aria-hidden="true" />
      <div>
        <p className="ds-error-title">{title}</p>
        {description && <p className="ds-error-text">{description}</p>}
        {onRetry && <Button variant="secondary" className="ds-error-retry" onClick={onRetry}>Tentar de novo</Button>}
      </div>
    </div>
  );
}

export const demoNotice = SAFETY_COPY.synthetic;
