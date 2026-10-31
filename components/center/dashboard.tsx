"use client";

import { ArrowRight, CalendarClock, ClipboardCheck, Inbox, MessageSquareReply, Presentation, RefreshCcw } from "lucide-react";
import { academicsApi, organizationsApi } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { useNow } from "@/lib/hooks/use-now";
import { loadCenterLookups } from "@/lib/hooks/use-lookups";
import { addDays, formatTimeRange, formatWeekday, formatDayMonth, isSameLocalDay, startOfDay } from "@/lib/format";
import { Badge, Button, ButtonLink, EmptyState, ErrorNotice, PageHeader, Panel, SkeletonRows } from "@/components/ui/primitives";
import { useCenter } from "./center-frame";

export function CenterDashboard() {
  const { centerId, canManage, isOwner, context } = useCenter();
  const now = useNow();

  const resource = useResource(async () => {
    const from = startOfDay(new Date());
    const to = addDays(from, 7);
    const [profile, lookups, sessions, students, pending, changes, requests] = await Promise.all([
      organizationsApi.getCenterProfile(centerId),
      loadCenterLookups(centerId),
      academicsApi.listSessions(centerId, from.toISOString(), to.toISOString()),
      academicsApi.listStudents(centerId, { page: 1, pageSize: 1 }),
      canManage ? academicsApi.listClassApplications(centerId, { status: "Pending", page: 1, pageSize: 1 }) : Promise.resolve(null),
      isOwner ? organizationsApi.listCenterChanges(centerId) : Promise.resolve(null),
      canManage ? academicsApi.listStudentRequests(centerId, { status: "Pending", page: 1, pageSize: 1 }) : Promise.resolve(null),
    ]);
    return { profile, lookups, sessions, students: students.totalCount, pending: pending?.totalCount ?? null, changes, requests: requests?.totalCount ?? null };
  }, [centerId, canManage, isOwner]);

  const data = resource.data;
  const today = new Date(now);
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfDay(today), index));

  const activeClasses = data?.lookups.classes.filter((item) => item.isActive) ?? [];
  const openClasses = activeClasses.filter((item) => item.registrationOpen);
  const nearlyFull = activeClasses.filter((item) => item.maxStudents > 0 && item.enrolledCount / item.maxStudents >= 0.85);
  const pendingChange = data?.changes?.find((item) => item.status === "Pending");

  return (
    <>
      <PageHeader
        title="Tổng quan vận hành"
        description={data ? `${data.profile.displayName} · ${data.profile.address}` : context.displayName}
        actions={
          <>
            <Button icon={<RefreshCcw aria-hidden="true" />} onClick={() => void resource.reload()} pending={resource.loading && Boolean(data)}>Làm mới</Button>
            {canManage && <ButtonLink variant="primary" href={`/centers/${centerId}/attendance`} icon={<ClipboardCheck aria-hidden="true" />}>Mở điểm danh</ButtonLink>}
          </>
        }
      />
      <ErrorNotice error={resource.error} onReload={() => void resource.reload()} />

      <div className="dashboard-grid">
        <Panel title="Lịch 7 ngày tới" description="Buổi học theo ngày, gồm cả buổi đã hủy" flush actions={<ButtonLink size="sm" variant="soft" href={`/centers/${centerId}/schedule`} trailing={<ArrowRight aria-hidden="true" />}>Mở lịch dạy</ButtonLink>}>
          {!data ? (
            <SkeletonRows rows={6} columns={3} />
          ) : data.sessions.length === 0 ? (
            <EmptyState icon={<CalendarClock aria-hidden="true" />} title="Chưa có buổi học trong 7 ngày tới">
              {canManage ? "Tạo buổi lẻ hoặc lịch lặp theo tuần cho lớp đang hoạt động." : "Lịch sẽ hiện ở đây khi trung tâm xếp buổi học."}
            </EmptyState>
          ) : (
            <div className="agenda">
              {days.map((day) => {
                const items = data.sessions
                  .filter((session) => isSameLocalDay(new Date(session.startUtc), day))
                  .sort((a, b) => a.startUtc.localeCompare(b.startUtc));
                if (!items.length) return null;
                return (
                  <section className="agenda-day" key={day.toISOString()}>
                    <h3>
                      <span>{isSameLocalDay(day, today) ? "Hôm nay" : formatWeekday(day)}</span>
                      <small>{formatDayMonth(day)}</small>
                    </h3>
                    <ul>
                      {items.map((session) => {
                        const teachingClass = data.lookups.classById.get(session.classId);
                        const started = new Date(session.startUtc).getTime() <= now;
                        return (
                          <li key={session.id} className={session.isActive ? "" : "is-cancelled"}>
                            <time>{formatTimeRange(session.startUtc, session.endUtc)}</time>
                            <div>
                              <strong>{teachingClass ? teachingClass.name : "Lớp không xác định"}</strong>
                              <span>
                                {data.lookups.teacherById.get(session.teacherId)?.fullName ?? "—"} · {data.lookups.roomById.get(session.roomId)?.name ?? "—"}
                              </span>
                            </div>
                            {!session.isActive ? (
                              <Badge tone={session.status === "NotHeld" ? "warning" : "danger"}>{session.status === "NotHeld" ? "Không diễn ra" : "Đã hủy"}</Badge>
                            ) : started && canManage ? (
                              <ButtonLink size="sm" href={`/centers/${centerId}/attendance?session=${session.id}`}>Điểm danh</ButtonLink>
                            ) : (
                              <Badge tone={session.isRescheduled ? "info" : "neutral"}>{session.isRescheduled ? "Đã dời lịch" : started ? "Đang/đã học" : "Sắp tới"}</Badge>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </Panel>

        <div className="dashboard-side">
          <Panel title="Cần xử lý">
            <ul className="task-list">
              {canManage && (
                <li>
                  <Inbox aria-hidden="true" />
                  <div>
                    <strong>{data?.pending ?? "…"} đơn đăng ký chờ duyệt</strong>
                    <span>Duyệt từng lớp; lớp đầy thì đơn vẫn giữ ở trạng thái chờ.</span>
                  </div>
                  <ButtonLink size="sm" variant="soft" href={`/centers/${centerId}/applications`} trailing={<ArrowRight aria-hidden="true" />}>Duyệt đơn</ButtonLink>
                </li>
              )}
              {canManage && (
                <li>
                  <MessageSquareReply aria-hidden="true" />
                  <div>
                    <strong>{data?.requests ?? "…"} yêu cầu học sinh chờ duyệt</strong>
                    <span>Xin vắng, xin học bù, chuyển lớp, rút lớp — kể cả phản hồi sau khi đổi lịch.</span>
                  </div>
                  <ButtonLink size="sm" variant="soft" href={`/centers/${centerId}/requests`} trailing={<ArrowRight aria-hidden="true" />}>Xem yêu cầu</ButtonLink>
                </li>
              )}
              <li>
                <Presentation aria-hidden="true" />
                <div>
                  <strong>{openClasses.length} lớp đang mở đăng ký</strong>
                  <span>{nearlyFull.length ? `${nearlyFull.length} lớp đã kín từ 85% sĩ số.` : "Chưa có lớp nào sắp kín chỗ."}</span>
                </div>
                <ButtonLink size="sm" variant="ghost" href={`/centers/${centerId}/classes`} trailing={<ArrowRight aria-hidden="true" />}>Lớp học</ButtonLink>
              </li>
              {isOwner && (
                <li>
                  <ClipboardCheck aria-hidden="true" />
                  <div>
                    <strong>{pendingChange ? "Yêu cầu đổi hồ sơ đang chờ duyệt" : "Không có yêu cầu đổi hồ sơ đang chờ"}</strong>
                    <span>{pendingChange ? "Hồ sơ hiện tại giữ nguyên cho tới khi nền tảng duyệt." : "Đổi thông tin pháp lý phải qua quản trị nền tảng."}</span>
                  </div>
                  <ButtonLink size="sm" variant="ghost" href={`/centers/${centerId}/profile`} trailing={<ArrowRight aria-hidden="true" />}>Hồ sơ</ButtonLink>
                </li>
              )}
            </ul>
          </Panel>

          <Panel title="Quy mô hiện tại">
            <dl className="stat-list">
              <div><dt>Học sinh đang hoạt động</dt><dd>{data?.students ?? "…"}</dd></div>
              <div><dt>Lớp đang hoạt động</dt><dd>{data ? activeClasses.length : "…"}</dd></div>
              <div><dt>Giáo viên đang hoạt động</dt><dd>{data ? data.lookups.teachers.filter((item) => item.isActive).length : "…"}</dd></div>
              <div><dt>Phòng học đang dùng</dt><dd>{data ? data.lookups.rooms.filter((item) => item.isActive).length : "…"}</dd></div>
              <div><dt>Buổi học 7 ngày tới</dt><dd>{data ? data.sessions.filter((item) => item.isActive).length : "…"}</dd></div>
            </dl>
          </Panel>
        </div>
      </div>
    </>
  );
}
