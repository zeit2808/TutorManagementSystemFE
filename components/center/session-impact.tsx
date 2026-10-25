"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { academicsApi, type SessionImpact } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { formatSlot } from "@/lib/format";
import { ErrorNotice, Notice } from "@/components/ui/primitives";

/** True when moving here clashes with someone's other lessons (students of this center or elsewhere, or the teacher elsewhere). */
export function hasImpactClash(data: SessionImpact | null | undefined) {
  return Boolean(data && (data.sameCenterConflicts.length > 0 || data.otherCenterConflictStudentCount > 0 || (data.teacherSessionsElsewhere ?? 0) > 0));
}

/**
 * B5/B6: before saving, who is affected — students of the class, those with another class of this center at the
 * new time (by name), how many clash elsewhere (count only), whether the teacher already teaches at another center
 * then (count only), and whether students get an urgent notice.
 */
export function ImpactSummary({ centerId, classId, startUtc, endUtc, sessionId, teacherId, cancelling, onData }: {
  centerId: string;
  classId: string;
  startUtc: string;
  endUtc: string;
  sessionId?: string;
  teacherId?: string;
  cancelling?: boolean;
  onData?: (data: SessionImpact | null) => void;
}) {
  const [key, setKey] = useState("");
  const wanted = `${classId}|${startUtc}|${endUtc}|${sessionId ?? ""}|${teacherId ?? ""}`;
  useEffect(() => {
    const timer = window.setTimeout(() => setKey(wanted), 400);
    return () => window.clearTimeout(timer);
  }, [wanted]);
  const impact = useResource<SessionImpact | null>(
    () => key
      ? academicsApi.sessionImpact(centerId, { classId, startUtc, endUtc, sessionId: sessionId ?? null, teacherId: teacherId ?? null })
      : Promise.resolve(null),
    [centerId, key],
  );
  const data = key === wanted && !impact.loading ? impact.data ?? null : null;
  useEffect(() => { onData?.(data ?? null); }, [data, onData]);

  if (!data) return impact.error ? <ErrorNotice error={impact.error} /> : null;
  const teacherElsewhere = !cancelling ? data.teacherSessionsElsewhere ?? 0 : 0;
  if (data.affectedStudentCount === 0) {
    return (
      <>
        <p className="cell-note"><Users aria-hidden="true" /> Lớp chưa có học sinh; không ai cần được báo.</p>
        {teacherElsewhere > 0 && <Notice tone="warning" title="Giáo viên bận ở trung tâm khác">Giáo viên đang có {teacherElsewhere} buổi dạy ở trung tâm khác trùng giờ này.</Notice>}
      </>
    );
  }
  const clashes = !cancelling && hasImpactClash(data);
  return (
    <Notice tone={clashes || data.isUrgent ? "warning" : "info"} title={`${data.affectedStudentCount} học sinh sẽ được báo${data.isUrgent ? " · báo gấp (trong 24 giờ)" : ""}`}>
      {data.studentsWithoutAccount > 0 && <p>{data.studentsWithoutAccount} học sinh chưa có tài khoản, không nhận được thông báo — hãy báo qua phụ huynh.</p>}
      {!cancelling && data.sameCenterConflicts.length > 0 && (
        <>
          <p>{new Set(data.sameCenterConflicts.map((item) => item.studentId)).size} học sinh đang có buổi khác của trung tâm vào giờ này:</p>
          <ul className="conflict-list">
            {data.sameCenterConflicts.slice(0, 6).map((item) => (
              <li key={`${item.studentId}-${item.otherStartUtc}`}><span><strong>{item.fullName}</strong> · {item.otherClassName} ({item.otherClassCode}) {formatSlot(item.otherStartUtc, item.otherEndUtc)}</span></li>
            ))}
            {data.sameCenterConflicts.length > 6 && <li className="col-muted">và {data.sameCenterConflicts.length - 6} trường hợp khác.</li>}
          </ul>
        </>
      )}
      {!cancelling && data.otherCenterConflictStudentCount > 0 && <p>{data.otherCenterConflictStudentCount} học sinh có lịch ở nơi khác trùng giờ này.</p>}
      {teacherElsewhere > 0 && <p>Giáo viên đang có {teacherElsewhere} buổi dạy ở trung tâm khác trùng giờ này.</p>}
      {!clashes && !cancelling && <p>Không học sinh nào bị trùng giờ.</p>}
    </Notice>
  );
}
