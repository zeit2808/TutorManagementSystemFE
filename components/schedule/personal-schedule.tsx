"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCcw } from "lucide-react";
import { academicsApi, type MySchedule, type MyScheduleEntry } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { addDays, formatDate, formatDayMonth, formatSlot, formatTimeRange, formatWeekday, isSameLocalDay, startOfWeek } from "@/lib/format";
import { centerHues } from "@/lib/labels";
import { Badge, Button, EmptyState, ErrorNotice, Panel, SkeletonRows } from "@/components/ui/primitives";

const RANGE_DAYS = 14;

export function useCenterColors(schedule: MySchedule | undefined) {
  return useMemo(() => {
    const map = new Map<string, string>();
    (schedule?.centers ?? []).forEach((center, index) => map.set(center.id, centerHues[index % centerHues.length]));
    return map;
  }, [schedule]);
}

/**
 * F1/F2: one person's sessions in every center, two weeks at a time on the Vietnam calendar. Each center has a
 * colour dot and its name; clashes, moves, cancellations and makeups are labelled in words, not colour alone.
 */
export function PersonalSchedule({ title, description, role, actions, linkFor, onLoaded, reloadToken = 0 }: {
  title: string;
  description?: ReactNode;
  /** Show only one role's entries (e.g. teaching inside a center); both by default. */
  role?: "Student" | "Teacher";
  actions?: (entry: MyScheduleEntry, now: number) => ReactNode;
  linkFor?: (entry: MyScheduleEntry) => string | null;
  onLoaded?: (schedule: MySchedule) => void;
  reloadToken?: number;
}) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const now = useNow();
  const schedule = useResource(async () => {
    const result = await academicsApi.mySchedule(weekStart.toISOString(), addDays(weekStart, RANGE_DAYS).toISOString());
    onLoaded?.(result);
    return result;
  }, [weekStart.getTime(), reloadToken]);
  const colors = useCenterColors(schedule.data);
  const entries = (schedule.data?.entries ?? []).filter((entry) => !role || entry.role === role);
  const mixedRoles = new Set(entries.map((entry) => entry.role)).size > 1;
  const days = Array.from({ length: RANGE_DAYS }, (_, index) => addDays(weekStart, index));
  const today = new Date(now);
  const clashes = entries.filter((entry) => entry.overlapsWith.length > 0).length;

  return (
    <Panel
      title={title}
      description={description}
      flush
      actions={
        <div className="week-nav">
          <Button size="sm" icon={<ChevronLeft aria-hidden="true" />} aria-label="Hai tuần trước" onClick={() => setWeekStart(addDays(weekStart, -RANGE_DAYS))} />
          <strong>{formatDate(weekStart)} – {formatDate(addDays(weekStart, RANGE_DAYS - 1))}</strong>
          <Button size="sm" icon={<ChevronRight aria-hidden="true" />} aria-label="Hai tuần sau" onClick={() => setWeekStart(addDays(weekStart, RANGE_DAYS))} />
          <Button size="sm" variant="ghost" onClick={() => setWeekStart(startOfWeek(new Date()))}>Tuần này</Button>
          <Button size="sm" variant="ghost" icon={<RefreshCcw aria-hidden="true" />} aria-label="Làm mới" onClick={() => void schedule.reload()} pending={schedule.loading && Boolean(schedule.data)} />
        </div>
      }
    >
      <ErrorNotice error={schedule.error} onReload={() => void schedule.reload()} />
      {schedule.data && schedule.data.centers.length > 1 && (
        <ul className="center-legend" aria-label="Trung tâm">
          {schedule.data.centers.map((center) => (
            <li key={center.id}><span className="center-dot" style={{ background: colors.get(center.id) }} aria-hidden="true" />{center.name}</li>
          ))}
          {clashes > 0 && <li><Badge tone="danger">{clashes} buổi trùng giờ</Badge></li>}
        </ul>
      )}
      {!schedule.data ? (
        <SkeletonRows rows={5} columns={3} />
      ) : entries.length === 0 ? (
        <EmptyState icon={<CalendarDays aria-hidden="true" />} title="Không có buổi nào trong hai tuần này">
          Lịch hiện các buổi của lớp bạn học (trong thời gian đang học) và buổi bạn được phân công dạy, ở mọi trung tâm.
        </EmptyState>
      ) : (
        <div className="agenda personal-agenda">
          {days.map((day) => {
            const items = entries.filter((entry) => isSameLocalDay(new Date(entry.startUtc), day));
            if (!items.length) return null;
            return (
              <section className={`agenda-day${isSameLocalDay(day, today) ? " is-today" : ""}`} key={day.toISOString()}>
                <h3><span>{isSameLocalDay(day, today) ? "Hôm nay" : formatWeekday(day)}</span><small>{formatDayMonth(day)}</small></h3>
                <ul>
                  {items.map((entry) => (
                    <EntryRow key={`${entry.sessionId}-${entry.role}`} entry={entry} color={colors.get(entry.centerId)} showRole={mixedRoles}
                      href={linkFor?.(entry) ?? null} actions={actions?.(entry, now)} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function EntryRow({ entry, color, showRole, href, actions }: { entry: MyScheduleEntry; color?: string; showRole: boolean; href: string | null; actions?: ReactNode }) {
  const inactive = entry.status !== "Scheduled";
  const name = entry.className ?? "Lớp";
  return (
    <li className={inactive ? "is-cancelled" : ""}>
      <time>{formatTimeRange(entry.startUtc, entry.endUtc)}</time>
      <div>
        <strong>{href ? <Link href={href}>{name}</Link> : name}</strong>
        <span>
          <span className="center-dot" style={{ background: color }} aria-hidden="true" />
          {[entry.centerName, entry.teacherName, entry.roomName].filter(Boolean).join(" · ")}
        </span>
        {entry.isRescheduled && entry.previousStartUtc && entry.previousEndUtc && (
          <span className="entry-note">Đã dời từ {formatSlot(entry.previousStartUtc, entry.previousEndUtc)}{entry.rescheduleReason ? ` · ${entry.rescheduleReason}` : ""}</span>
        )}
        {inactive && entry.statusReason && <span className="entry-note">Lý do: {entry.statusReason}</span>}
      </div>
      <div className="entry-tags">
        {showRole && <Badge tone="neutral">{entry.role === "Teacher" ? "Dạy" : "Học"}</Badge>}
        {entry.status === "Cancelled" && <Badge tone="danger">Đã hủy</Badge>}
        {entry.status === "NotHeld" && <Badge tone="warning">Không diễn ra</Badge>}
        {!inactive && entry.overlapsWith.length > 0 && <Badge tone="danger">Trùng giờ</Badge>}
        {!inactive && entry.isRescheduled && <Badge tone="info">Đã đổi</Badge>}
        {entry.isMakeup && <Badge tone="brand">Học bù</Badge>}
        {entry.absenceRequestStatus === "Approved" && <Badge tone="info">Vắng có phép</Badge>}
        {entry.absenceRequestStatus === "Pending" && <Badge tone="warning">Đã xin vắng</Badge>}
        {actions}
      </div>
    </li>
  );
}
