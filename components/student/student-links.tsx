"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CheckCircle2, GraduationCap, LoaderCircle, LogOut, UserRoundX } from "lucide-react";
import { academicsApi, authApi, ApiError, type ScheduleCheck, type WeeklySlot } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useAction, useResource } from "@/lib/hooks/use-resource";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";
import { validateName, validateVietnamMobile } from "@/lib/validation";
import { Badge, Button, ButtonLink, ErrorNotice, Field, KeyValue, Notice } from "@/components/ui/primitives";
import { ConflictList, scheduleCheckFrom } from "@/components/ui/conflict-dialog";

const WEEKDAY_LABELS: Record<string, string> = {
  Monday: "Thứ 2", Tuesday: "Thứ 3", Wednesday: "Thứ 4", Thursday: "Thứ 5", Friday: "Thứ 6", Saturday: "Thứ 7", Sunday: "Chủ nhật",
};

function weeklyText(slots: WeeklySlot[]) {
  if (slots.length === 0) return "Chưa có lịch cố định";
  return slots.map((slot) => `${WEEKDAY_LABELS[slot.weekday] ?? slot.weekday} ${slot.startTime.slice(0, 5)} (${formatDuration(slot.durationMinutes)})`).join(" · ");
}

/** Both link pages need a signed-in student login; staff logins are told to switch account. */
function useStudentGate() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSessionUser();
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);
  return { ready: status === "ready" && Boolean(user), isStudent: Boolean(user?.isStudent) };
}

function Waiting({ text }: { text: string }) {
  return <p className="col-muted inline-status"><LoaderCircle className="spin" aria-hidden="true" />{text}</p>;
}

function StaffAccountNotice() {
  const router = useRouter();
  return (
    <div className="stack">
      <Notice tone="warning" title="Trang này dành cho tài khoản học sinh">
        Bạn đang đăng nhập bằng tài khoản nhân sự trung tâm. Đăng xuất rồi đăng nhập bằng tài khoản Google của học sinh để tiếp tục.
      </Notice>
      <Button icon={<LogOut aria-hidden="true" />} onClick={() => void authApi.logout().then(() => router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}`))}>
        Đăng xuất và đổi tài khoản
      </Button>
    </div>
  );
}

// ---------------- /activate/[token] ----------------

export function ActivationPage({ token }: { token: string }) {
  const gate = useStudentGate();
  const preview = useResource(() => (gate.ready && gate.isStudent ? academicsApi.previewActivation(token) : Promise.resolve(null)), [token, gate.ready, gate.isStudent]);
  const action = useAction({ redirectOnUnauthorized: false });
  const [result, setResult] = useState<"linked" | "declined" | null>(null);

  if (!gate.ready) return <Waiting text="Đang kiểm tra đăng nhập…" />;
  if (!gate.isStudent) return <StaffAccountNotice />;

  async function accept() {
    if (await action.run(() => academicsApi.acceptActivation(token))) setResult("linked");
  }
  async function decline() {
    if (await action.run(() => academicsApi.declineActivation(token))) setResult("declined");
  }

  if (result === "linked" || preview.data?.alreadyLinkedToYou) {
    return (
      <div className="stack">
        <Notice tone="success" title="Đã kích hoạt">
          Hồ sơ <strong>{preview.data?.fullName}</strong> ({preview.data?.studentCode}) ở <strong>{preview.data?.centerName}</strong> đã gắn với tài khoản của bạn.
          Từ nay chỉ cần bấm “Đăng nhập bằng Google” là thấy lịch học.
        </Notice>
        <ButtonLink href="/student" variant="primary" icon={<CalendarDays aria-hidden="true" />}>Xem lịch học</ButtonLink>
      </div>
    );
  }
  if (result === "declined") {
    return (
      <Notice tone="info" title="Đã báo trung tâm">
        Link này đã ngừng hoạt động. Trung tâm sẽ kiểm tra lại và gửi link cho đúng người.
      </Notice>
    );
  }

  const hasProfile = action.error instanceof ApiError && action.error.hasCode("activation_account_has_profile");
  return (
    <div className="stack">
      <ErrorNotice error={preview.error} />
      {!preview.data && !preview.error && <Waiting text="Đang mở link kích hoạt…" />}
      {preview.data && (
        <>
          <p className="lead">Trung tâm <strong>{preview.data.centerName}</strong> mời bạn kích hoạt tài khoản cho hồ sơ:</p>
          <div className="identity-card">
            <GraduationCap aria-hidden="true" />
            <div>
              <strong>{preview.data.fullName}</strong>
              <span>Mã {preview.data.studentCode}{preview.data.classNames.length > 0 ? ` · đang học ${preview.data.classNames.join(", ")}` : ""}</span>
            </div>
          </div>
          <p>Đây có phải là bạn không?</p>
          {hasProfile ? (
            <Notice tone="warning" title="Tài khoản của bạn đã có hồ sơ khác ở trung tâm này">
              Trung tâm đã được báo để hợp nhất hai hồ sơ. Bạn không cần làm gì thêm; sau khi trung tâm xử lý, lịch của bạn sẽ đầy đủ.
            </Notice>
          ) : (
            <div className="inline-action">
              <Button variant="primary" icon={<CheckCircle2 aria-hidden="true" />} pending={action.pending} onClick={() => void accept()}>Đúng là tôi</Button>
              <Button icon={<UserRoundX aria-hidden="true" />} disabled={action.pending} onClick={() => void decline()}>Không phải tôi</Button>
            </div>
          )}
          {!hasProfile && <ErrorNotice error={action.error} onDismiss={action.clearError} />}
        </>
      )}
    </div>
  );
}

// ---------------- /join/[token] ----------------

export function JoinClassPage({ token }: { token: string }) {
  const gate = useStudentGate();
  const router = useRouter();
  const preview = useResource(() => (gate.ready && gate.isStudent ? academicsApi.previewClassInvite(token) : Promise.resolve(null)), [token, gate.ready, gate.isStudent]);
  const action = useAction({ redirectOnUnauthorized: false });
  const [code, setCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [before, setBefore] = useState<"" | "yes" | "no">("");
  const [touched, setTouched] = useState(false);
  const [clash, setClash] = useState<ScheduleCheck | null>(null);

  if (!gate.ready) return <Waiting text="Đang kiểm tra đăng nhập…" />;
  if (!gate.isStudent) return <StaffAccountNotice />;

  const data = preview.data;
  const needsProfile = Boolean(data && !data.hasProfileHere);
  const errors = {
    code: code.trim().length === 6 ? null : "Nhập đủ 6 ký tự mã lớp.",
    before: needsProfile && !before ? "Hãy trả lời câu hỏi này." : null,
    fullName: needsProfile ? validateName(fullName, "Họ và tên") : null,
    parentName: needsProfile ? validateName(parentName, "Tên phụ huynh") : null,
    parentPhone: needsProfile ? validateVietnamMobile(parentPhone, true) : null,
  };
  const invalid = Object.values(errors).some(Boolean);

  async function join(acknowledgeConflicts = false) {
    setTouched(true);
    if (invalid || before === "yes") return;
    let blocked: ScheduleCheck | null = null;
    const result = await action.run(async () => {
      try {
        return await academicsApi.joinClassInvite(token, {
          code: code.trim(),
          fullName: needsProfile ? fullName : null,
          parentName: needsProfile ? parentName : null,
          parentPhone: needsProfile ? parentPhone.replace(/[\s.()-]/g, "") : null,
          studiedHereBefore: false,
          acknowledgeConflicts,
        });
      } catch (error) {
        blocked = scheduleCheckFrom(error);
        if (blocked) return undefined;
        throw error;
      }
    });
    if (blocked) setClash(blocked);
    else if (result) router.replace(`/student?joined=${encodeURIComponent(data?.className ?? "")}`);
  }

  return (
    <div className="stack">
      <ErrorNotice error={preview.error} />
      {!data && !preview.error && <Waiting text="Đang mở thông tin lớp…" />}
      {data && (
        <>
          <div className="identity-card">
            <GraduationCap aria-hidden="true" />
            <div>
              <strong>{data.className}</strong>
              <span>{data.subjectName} · {data.centerName}</span>
            </div>
          </div>
          <KeyValue
            items={[
              { label: "Giáo viên", value: data.teacherNames.length ? data.teacherNames.join(", ") : "Chưa phân công" },
              { label: "Lịch học", value: weeklyText(data.weeklySchedule) },
              { label: "Thời gian", value: data.startDate ? `${formatDate(data.startDate)}${data.endDate ? ` – ${formatDate(data.endDate)}` : ""}` : "Chưa có buổi" },
              { label: "Còn chỗ", value: data.seatsLeft > 0 ? `${data.seatsLeft} chỗ` : <Badge tone="danger">Đã đủ</Badge> },
              { label: "Link hết hạn", value: formatDateTime(data.expiresAtUtc) },
            ]}
          />

          {data.alreadyInClass ? (
            <div className="stack">
              <Notice tone="success">Bạn đã ở trong lớp này.</Notice>
              <ButtonLink href="/student" variant="primary" icon={<CalendarDays aria-hidden="true" />}>Xem lịch học</ButtonLink>
            </div>
          ) : (
            <form className="stack" noValidate onSubmit={(event) => { event.preventDefault(); void join(); }}>
              {data.hasProfileHere ? (
                <Notice tone="info">Bạn đã có hồ sơ <strong>{data.profileName}</strong> ở trung tâm này; lớp mới sẽ được thêm vào đúng hồ sơ đó.</Notice>
              ) : (
                <fieldset className="stack">
                  <legend className="field-label">Bạn đã từng học ở {data.centerName} chưa?</legend>
                  <label className="choice-inline"><input type="radio" name="before" checked={before === "no"} onChange={() => setBefore("no")} /> Chưa, tôi là học sinh mới</label>
                  <label className="choice-inline"><input type="radio" name="before" checked={before === "yes"} onChange={() => setBefore("yes")} /> Rồi, tôi đã học ở đây</label>
                  {touched && errors.before && <p className="field-error">{errors.before}</p>}
                </fieldset>
              )}

              {before === "yes" && !data.hasProfileHere ? (
                <Notice tone="warning" title="Hãy dùng link kích hoạt riêng">
                  Trung tâm đã có hồ sơ của bạn. Đăng ký ở đây sẽ tạo hồ sơ thứ hai. Hãy mở link kích hoạt trung tâm gửi riêng cho bạn (hoặc nhờ trung tâm gửi lại);
                  sau khi kích hoạt, trung tâm có thể thêm bạn vào lớp này.
                </Notice>
              ) : (
                <>
                  <Field label="Mã lớp" required error={touched ? errors.code : null} hint="6 ký tự trung tâm gửi kèm link.">
                    {(id, describedBy) => <input id={id} aria-describedby={describedBy} value={code} maxLength={8} autoComplete="off" className="code-input" onChange={(event) => setCode(event.target.value.toUpperCase())} />}
                  </Field>
                  {needsProfile && before === "no" && (
                    <>
                      <Field label="Họ và tên học sinh" required error={touched ? errors.fullName : null}>
                        {(id) => <input id={id} value={fullName} maxLength={100} onChange={(event) => setFullName(event.target.value)} />}
                      </Field>
                      <div className="settings-pair">
                        <Field label="Tên phụ huynh" required error={touched ? errors.parentName : null}>
                          {(id) => <input id={id} value={parentName} maxLength={100} onChange={(event) => setParentName(event.target.value)} />}
                        </Field>
                        <Field label="Số điện thoại phụ huynh" required error={touched ? errors.parentPhone : null}>
                          {(id) => <input id={id} value={parentPhone} inputMode="tel" maxLength={20} onChange={(event) => setParentPhone(event.target.value)} />}
                        </Field>
                      </div>
                    </>
                  )}
                  <ErrorNotice error={action.error} onDismiss={action.clearError} />
                  <Button type="submit" variant="primary" pending={action.pending} disabled={data.seatsLeft <= 0}>Vào lớp</Button>
                </>
              )}
            </form>
          )}

          {clash && (
            <div className="stack">
              <Notice tone="warning" title="Lớp này trùng giờ với lớp khác bạn đang học ở trung tâm">
                <ConflictList items={clash.sameCenterConflicts} />
              </Notice>
              <div className="inline-action">
                <Button variant="primary" pending={action.pending} onClick={() => { setClash(null); void join(true); }}>Vẫn vào lớp</Button>
                <Button onClick={() => setClash(null)}>Không vào nữa</Button>
              </div>
            </div>
          )}
        </>
      )}
      <p className="cell-note">Cần giúp? <Link className="text-link" href="/student">Về cổng học sinh</Link></p>
    </div>
  );
}
