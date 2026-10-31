"use client";

import { useState, type ReactNode } from "react";
import { useAction } from "@/lib/hooks/use-resource";
import { Button, Dialog, ErrorNotice, Field } from "./primitives";

interface ReasonDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  label?: string;
  placeholder?: string;
  confirmLabel: string;
  variant?: "primary" | "danger";
  minLength?: number;
  maxLength?: number;
  optional?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
  children?: ReactNode;
}

/** Every reasoned transition (reject, suspend, cancel, correct…) uses the same confirm surface. */
export function ReasonDialog({ open, title, description, label = "Lý do", placeholder, confirmLabel, variant = "primary", minLength = 1, maxLength = 1000, optional, onClose, onConfirm, children }: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const action = useAction();
  const trimmed = reason.trim();
  const invalid = !optional && (trimmed.length < minLength || trimmed.length > maxLength);
  const fieldError = touched && invalid
    ? minLength > 1 ? `Cần ${minLength}–${maxLength} ký tự (hiện ${trimmed.length}).` : "Vui lòng nhập lý do."
    : null;

  function close() {
    setReason("");
    setTouched(false);
    action.clearError();
    onClose();
  }

  async function confirm() {
    setTouched(true);
    if (invalid) return;
    const ok = await action.run(async () => {
      await onConfirm(trimmed);
      return true;
    });
    if (ok) close();
  }

  return (
    <Dialog
      open={open}
      title={title}
      description={description}
      onClose={close}
      onSubmit={confirm}
      size="sm"
      footer={
        <>
          <Button onClick={close} disabled={action.pending}>Đóng</Button>
          <Button type="submit" variant={variant} pending={action.pending} status={action.status}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
      <Field label={label} required={!optional} error={fieldError} hint={minLength > 1 ? `Tối thiểu ${minLength} ký tự.` : undefined}>
        {(id, describedBy) => (
          <textarea
            id={id}
            aria-describedby={describedBy}
            rows={3}
            value={reason}
            maxLength={maxLength}
            placeholder={placeholder}
            onChange={(event) => setReason(event.target.value)}
            onBlur={() => setTouched(true)}
          />
        )}
      </Field>
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}

/** Plain confirmation for reversible but consequential actions. */
export function ConfirmDialog({ open, title, children, confirmLabel, variant = "primary", onClose, onConfirm }: { open: boolean; title: string; children?: ReactNode; confirmLabel: string; variant?: "primary" | "danger"; onClose: () => void; onConfirm: () => Promise<unknown> }) {
  const action = useAction();
  function close() {
    action.clearError();
    onClose();
  }
  async function confirm() {
    const ok = await action.run(async () => {
      await onConfirm();
      return true;
    });
    if (ok) close();
  }
  return (
    <Dialog
      open={open}
      title={title}
      onClose={close}
      onSubmit={confirm}
      size="sm"
      footer={
        <>
          <Button onClick={close} disabled={action.pending}>Đóng</Button>
          <Button type="submit" variant={variant} pending={action.pending} status={action.status}>{confirmLabel}</Button>
        </>
      }
    >
      {children}
      <ErrorNotice error={action.error} />
    </Dialog>
  );
}
