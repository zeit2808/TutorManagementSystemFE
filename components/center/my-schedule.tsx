"use client";

import { ClipboardCheck } from "lucide-react";
import { ButtonLink, PageHeader } from "@/components/ui/primitives";
import { PersonalSchedule } from "@/components/schedule/personal-schedule";
import { useCenter } from "./center-frame";

/**
 * F2: a teacher's own sessions in every center they teach at. Opening a session goes to the attendance sheet of
 * that session's center (the person must be a member there; centers never see each other's schedules).
 */
export function MyScheduleWorkspace() {
  const { centerId } = useCenter();
  return (
    <>
      <PageHeader
        title="Lịch của tôi"
        description="Các buổi bạn được phân công dạy ở mọi trung tâm (và buổi học, nếu bạn cũng là học sinh). “Trùng giờ” nghĩa là hai buổi chồng nhau — hãy báo trung tâm để đổi lịch."
        actions={<ButtonLink href={`/centers/${centerId}/attendance`} icon={<ClipboardCheck aria-hidden="true" />}>Điểm danh</ButtonLink>}
      />
      <PersonalSchedule
        title="Hai tuần tới"
        linkFor={(entry) => entry.role === "Teacher" ? `/centers/${entry.centerId}/attendance?session=${entry.sessionId}` : null}
        actions={(entry, now) =>
          entry.role === "Teacher" && entry.status === "Scheduled" && new Date(entry.startUtc).getTime() <= now
            ? <ButtonLink size="sm" href={`/centers/${entry.centerId}/attendance?session=${entry.sessionId}`}>Điểm danh</ButtonLink>
            : null}
      />
    </>
  );
}
