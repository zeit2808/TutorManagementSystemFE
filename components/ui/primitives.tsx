"use client";

import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Check, CheckCircle2, Info, LoaderCircle, RefreshCcw, TriangleAlert, X } from "lucide-react";
import { ApiError, getApiErrorMessage } from "@/lib/api";
import type { ActionStatus } from "@/lib/hooks/use-resource";
import type { Tone } from "@/lib/labels";

/* ───────── Button ───────── */

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  icon?: ReactNode;
  pending?: boolean;
  /** Outcome of the request this button triggered (`useAction().status`): confirms success or flags failure in place. */
  status?: ActionStatus;
  size?: "md" | "sm";
}

export function Button({ variant = "secondary", icon, pending, status, size = "md", children, className, disabled, type = "button", ...rest }: ButtonProps) {
  const busy = pending || status === "pending";
  const face = busy ? "pending" : status === "success" || status === "error" ? status : undefined;
  return (
    <button
      type={type}
      className={["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className ?? ""].join(" ").trim()}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      data-status={face}
      {...rest}
    >
      {face === "pending" ? <LoaderCircle className="spin" aria-hidden="true" />
        : face === "success" ? <Check className="btn-check" aria-hidden="true" />
        : face === "error" ? <AlertCircle className="btn-alert" aria-hidden="true" />
        : icon}
      {children}
      {face === "pending" && <span className="btn-progress" aria-hidden="true" />}
    </button>
  );
}

export function ButtonLink({ href, variant = "secondary", icon, children, size = "md", trailing, className, ...rest }: { href: string; variant?: Variant; icon?: ReactNode; children?: ReactNode; size?: "md" | "sm"; trailing?: ReactNode; className?: string; title?: string; "aria-label"?: string }) {
  return (
    <Link href={href} className={["btn", `btn-${variant}`, size === "sm" ? "btn-sm" : "", className ?? ""].join(" ").trim()} {...rest}>
      {icon}
      {children}
      {trailing}
    </Link>
  );
}

/**
 * Leaves the current page for its parent. Drawn as a real control — arrow tile plus
 * "Quay lại" over the destination — so it is never mistaken for body text.
 */
export function BackButton({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={["back-button", className ?? ""].join(" ").trim()}>
      <span className="back-button-icon" aria-hidden="true"><ArrowLeft /></span>
      <span className="back-button-text">
        <small>Quay lại</small>
        <strong>{children}</strong>
      </span>
    </Link>
  );
}

/* ───────── Badge ───────── */

export function Badge({ tone = "neutral", children, icon }: { tone?: Tone; children: ReactNode; icon?: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{icon}{children}</span>;
}

/* ───────── Notice ───────── */

const noticeIcons: Record<Tone, ReactNode> = {
  success: <CheckCircle2 aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  danger: <AlertCircle aria-hidden="true" />,
  info: <Info aria-hidden="true" />,
  neutral: <Info aria-hidden="true" />,
  brand: <Info aria-hidden="true" />,
};

export function Notice({ tone = "info", title, children, action, onDismiss }: { tone?: Tone; title?: string; children?: ReactNode; action?: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={`notice notice-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {noticeIcons[tone]}
      <div className="notice-body">
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {action && <div className="notice-action">{action}</div>}
      {onDismiss && (
        <button type="button" className="icon-button" onClick={onDismiss} aria-label="Đóng thông báo">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

/** Explains an API failure in place: message, recovery for stale data, and the trace ID for support. */
export function ErrorNotice({ error, fallback, onReload, onDismiss }: { error: unknown; fallback?: string; onReload?: () => void; onDismiss?: () => void }) {
  if (!error) return null;
  const message = getApiErrorMessage(error, fallback);
  const apiError = error instanceof ApiError ? error : null;
  const stale = apiError?.isConcurrency;
  return (
    <Notice
      tone={stale ? "warning" : "danger"}
      title={stale ? "Dữ liệu đã thay đổi" : undefined}
      onDismiss={onDismiss}
      action={onReload ? <Button size="sm" icon={<RefreshCcw aria-hidden="true" />} onClick={onReload}>Tải lại</Button> : undefined}
    >
      <p>{stale ? `${message} Tải lại để xem bản mới nhất rồi thực hiện lại thao tác.` : message}</p>
      {apiError?.traceId && <p className="trace">Mã tra cứu: <code>{apiError.traceId}</code></p>}
    </Notice>
  );
}

/* ───────── Field ───────── */

export function Field({ label, hint, error, children, required, className }: { label: string; hint?: ReactNode; error?: string | null; children: (id: string, describedBy?: string) => ReactNode; required?: boolean; className?: string }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={["field", error ? "field-invalid" : "", className ?? ""].join(" ").trim()}>
      <label htmlFor={id}>
        {label}
        {required && <span className="field-required" aria-hidden="true">*</span>}
      </label>
      {children(id, describedBy)}
      {hint && <p className="field-hint" id={hintId}>{hint}</p>}
      {error && <p className="field-error" id={errorId}>{error}</p>}
    </div>
  );
}

/* ───────── TimeInput24 ───────── */

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));

/**
 * "HH:mm" on a 24-hour clock. The native time input follows the browser's locale and shows AM/PM, which made
 * 12:30 AM (just after midnight) easy to pick for "12:30 trưa"; two selects cannot be misread.
 */
export function TimeInput24({ id, value, onChange, describedBy, minuteStep = 5 }: { id: string; value: string; onChange: (value: string) => void; describedBy?: string; minuteStep?: number }) {
  const [hour = "", minute = ""] = value.split(":");
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, index) => String(index * minuteStep).padStart(2, "0"));
  // Keep an existing off-step minute (e.g. 12:07 from an older session) selectable instead of silently changing it.
  if (minute && !minutes.includes(minute)) minutes.push(minute);
  minutes.sort();
  return (
    <div className="time-24" role="group" aria-describedby={describedBy}>
      <select id={id} aria-label="Giờ" value={hour} onChange={(event) => onChange(`${event.target.value}:${minute || "00"}`)}>
        {!hour && <option value="">--</option>}
        {HOURS.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label="Phút" value={minute} onChange={(event) => onChange(`${hour || "00"}:${event.target.value}`)}>
        {!minute && <option value="">--</option>}
        {minutes.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
    </div>
  );
}

/* ───────── Dialog ───────── */

export function Dialog({ open, title, description, onClose, children, footer, size = "md", onSubmit }: { open: boolean; title: string; description?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg"; onSubmit?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Callers often unmount an open dialog (`{editor && <Dialog open …/>}`); close it first so the page never stays inert.
  useEffect(() => {
    const dialog = ref.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog-${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {open && (
        <form
          method="dialog"
          className="dialog-frame"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit?.();
          }}
          noValidate
        >
          <header className="dialog-header">
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p>{description}</p>}
            </div>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Đóng">
              <X aria-hidden="true" />
            </button>
          </header>
          <div className="dialog-body">{children}</div>
          {footer && <footer className="dialog-footer">{footer}</footer>}
        </form>
      )}
    </dialog>
  );
}

/* ───────── Layout helpers ───────── */

export function PageHeader({ title, description, actions, meta }: { title: string; description?: ReactNode; actions?: ReactNode; meta?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {meta && <div className="page-header-meta">{meta}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, actions, children, className, flush }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; flush?: boolean }) {
  return (
    <section className={["panel", flush ? "panel-flush" : "", className ?? ""].join(" ").trim()}>
      {(title || actions) && (
        <header className="panel-header">
          <div>
            {title && <h2>{title}</h2>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      {icon}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function SkeletonRows({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="skeleton-table" aria-busy="true" aria-label="Đang tải">
      {Array.from({ length: rows }, (_, row) => (
        <div className="skeleton-row" key={row} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, column) => <span key={column} />)}
        </div>
      ))}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return <div className="pagination"><span>{total} bản ghi</span></div>;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav className="pagination" aria-label="Phân trang">
      <span>{from}–{to} trên {total}</span>
      <div>
        <Button size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>Trước</Button>
        <span className="pagination-current">Trang {page}/{pages}</span>
        <Button size="sm" onClick={() => onChange(page + 1)} disabled={page >= pages}>Sau</Button>
      </div>
    </nav>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: Array<{ value: T; label: string; count?: number }>; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          className={value === option.value ? "active" : ""}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && <span className="segmented-count">{option.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (checked: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} />
      <span className="toggle-track" aria-hidden="true" />
      <span>{label}</span>
    </label>
  );
}

/**
 * Signature move: every lifecycle is drawn as a short rail of states with the
 * current one lit, so the next valid transition is visible before acting.
 */
export function StateRail({ steps, current, label }: { steps: Array<{ id: string; label: string; tone?: Tone }>; current: string; label: string }) {
  const currentIndex = steps.findIndex((step) => step.id === current);
  return (
    <ol className="state-rail" aria-label={label}>
      {steps.map((step, index) => {
        const state = index === currentIndex ? "current" : index < currentIndex ? "past" : "future";
        return (
          <li key={step.id} className={`state-${state} tone-${step.tone ?? "brand"}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="state-chip">
              <span className="state-dot" aria-hidden="true" />
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function KeyValue({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="key-value">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const tone = ratio >= 1 ? "danger" : ratio >= 0.85 ? "warning" : "brand";
  return (
    <span className={`meter meter-${tone}`} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-label={label}>
      <span className="meter-track"><span style={{ width: `${ratio * 100}%` }} /></span>
      <span className="meter-label">{value}/{max}</span>
    </span>
  );
}

/**
 * Account chip for the top bar: rounded pill whose border carries a slow
 * travelling light, so the signed-in identity and active role stay noticeable.
 */
export function UserChip({ name, role, href = "/account/security" }: { name: string; role: string; href?: string }) {
  const letters = name.replace(/[^\p{L}\p{N}\s]/gu, " ").trim().split(/\s+/).filter(Boolean);
  const avatar = (letters.length > 1 ? letters.slice(-2).map((part) => part[0]).join("") : (letters[0] ?? "?").slice(0, 2)).toUpperCase();
  return (
    <Link className="user-chip" href={href} title="Tài khoản & bảo mật">
      <span className="user-chip-inner">
        <span className="user-chip-avatar" aria-hidden="true">{avatar}</span>
        <span className="user-chip-name">{name}</span>
        <span className="user-chip-role">{role}</span>
      </span>
    </Link>
  );
}
