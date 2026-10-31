"use client";

import type { ReactNode } from "react";
import { CalendarX2 } from "lucide-react";
import { ApiError, type ConflictItem, type ScheduleCheck } from "@/lib/api";
import { formatSlot, formatTimeRange } from "@/lib/format";
import { ConfirmDialog } from "./reason-dialog";

/** B5: the clashing sessions sent with a 409 student_schedule_conflict, or null for any other error. */
export function scheduleCheckFrom(error: unknown): ScheduleCheck | null {
  if (!(error instanceof ApiError) || !error.hasCode("student_schedule_conflict")) return null;
  const data = error.data as ScheduleCheck | undefined;
  return data && Array.isArray(data.sameCenterConflicts) ? data : null;
}

export function ConflictList({ items, limit = 8 }: { items: ConflictItem[]; limit?: number }) {
  if (!items.length) return null;
  return (
    <ul className="conflict-list">
      {items.slice(0, limit).map((item, index) => (
        <li key={`${item.startUtc}-${item.otherStartUtc}-${index}`}>
          <CalendarX2 aria-hidden="true" />
          <span>
            <strong>{formatSlot(item.startUtc, item.endUtc)}</strong>
            {" trùng "}
            {item.betweenSelected ? "lớp cũng đang chọn " : ""}
            {item.otherClassName ?? "một lớp khác"}
            {item.otherCenterName && !item.sameCenter ? ` · ${item.otherCenterName}` : ""}
            {" "}<span className="col-muted">{formatTimeRange(item.otherStartUtc, item.otherEndUtc)}</span>
          </span>
        </li>
      ))}
      {items.length > limit && <li className="col-muted">và {items.length - limit} buổi khác.</li>}
    </ul>
  );
}

/** Asks the manager to confirm an enrollment or approval that clashes with the student's other classes here. */
export function ConflictConfirmDialog({ check, title, lead, confirmLabel, onClose, onConfirm }: {
  check: ScheduleCheck | null;
  title: string;
  lead: ReactNode;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
}) {
  return (
    <ConfirmDialog open={Boolean(check)} title={title} confirmLabel={confirmLabel} onClose={onClose} onConfirm={onConfirm}>
      {check && (
        <>
          <p>{lead}</p>
          <ConflictList items={check.sameCenterConflicts} />
          {check.otherCenterConflictCount > 0 && (
            <p className="cell-note">Học sinh còn có lịch ở nơi khác trùng {check.otherCenterConflictCount} buổi (không hiển thị tên nơi đó).</p>
          )}
          <p className="cell-note">Trung tâm vẫn có thể tiếp tục; học sinh sẽ thấy nhãn “Trùng giờ” trong lịch của mình.</p>
        </>
      )}
    </ConfirmDialog>
  );
}
