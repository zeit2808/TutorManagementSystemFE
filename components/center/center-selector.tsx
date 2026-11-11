"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, LoaderCircle, Building2, ShieldAlert, ShieldCheck } from "lucide-react";
import { identityApi } from "@/lib/api";
import { useSessionUser } from "@/lib/auth/session";
import { useResource } from "@/lib/hooks/use-resource";
import { centerStatus, roleLabel } from "@/lib/labels";
import { initials } from "@/lib/format";
import { Badge, EmptyState, ErrorNotice, PageHeader, SkeletonRows } from "@/components/ui/primitives";
import { AccountMenu } from "@/components/ui/account-menu";

export function CenterSelector() {
  const router = useRouter();
  const { user, status } = useSessionUser();
  const centers = useResource(() => identityApi.myCenters(), []);
  // Signed out (or the session expired): go to sign-in like every other screen, instead of a page of skeletons.
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent("/select-center")}`);
  }, [router, status]);

  // A member of exactly one center with no platform role has nothing to choose.
  const only = centers.data?.length === 1 ? centers.data[0] : null;
  const skip = Boolean(only?.canAccess && user && !user.isPlatformAdmin && !user.isStudent);
  // Student accounts never join centers; their home is the student portal.
  const student = Boolean(user?.isStudent);
  useEffect(() => {
    if (student) router.replace("/student");
    else if (skip && only) router.replace(`/centers/${only.centerId}`);
  }, [only, router, skip, student]);

  const roleText = user?.isPlatformAdmin ? "Quản trị nền tảng" : "Thành viên";
  const adminLinks = user?.isPlatformAdmin ? [{ href: "/platform", label: "Quản trị nền tảng", icon: ShieldCheck }] : [];

  if (student) {
    return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang mở cổng học sinh</h1></main>;
  }

  if (skip) {
    return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang mở {only?.displayName}</h1></main>;
  }

  return (
    <div className="select-page">
      <header className="select-bar">
        <Link className="brand brand-dark" href="/select-center"><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></Link>
        <span className="only-wide"><AccountMenu roleLabel={roleText} links={adminLinks} /></span>
        <span className="only-narrow"><AccountMenu variant="compact" roleLabel={roleText} links={adminLinks} /></span>
      </header>
      <main className="select-main">
        <PageHeader title="Chọn nơi làm việc" description="Vai trò được áp dụng riêng cho từng trung tâm. Trung tâm bị đình chỉ vẫn hiện để bạn biết lý do không vào được." />
        <ErrorNotice error={centers.error} onReload={() => void centers.reload()} />

        {user?.isPlatformAdmin && (
          <section className="select-section">
            <h2>Khu vực theo vai trò</h2>
            <ul className="center-cards">
              <li><Link className="center-card" href="/platform"><span className="center-card-mark"><ShieldCheck aria-hidden="true" /></span><span><strong>Quản trị nền tảng</strong><small>Duyệt trung tâm, mời chủ trung tâm, xét yêu cầu đổi hồ sơ</small></span><ArrowRight aria-hidden="true" /></Link></li>
            </ul>
          </section>
        )}

        <section className="select-section">
          <h2>Trung tâm bạn là thành viên</h2>
          {!centers.data ? (
            <SkeletonRows rows={3} columns={2} />
          ) : centers.data.length === 0 ? (
            <EmptyState icon={<Building2 aria-hidden="true" />} title="Bạn chưa là thành viên trung tâm nào">
              Bạn sẽ thấy trung tâm ở đây sau khi nhận lời mời qua email: chủ trung tâm do quản trị nền tảng mời, giáo viên và nhân viên do chủ trung tâm mời.
            </EmptyState>
          ) : (
            <ul className="center-cards">
              {centers.data.map((center) => {
                const status = centerStatus[center.status] ?? { label: center.status, tone: "neutral" as const };
                const body = (
                  <>
                    <span className="center-card-mark">{center.canAccess ? initials(center.displayName) : <ShieldAlert aria-hidden="true" />}</span>
                    <span>
                      <strong>{center.displayName}</strong>
                      <small>{roleLabel(center.role)}{!center.canAccess && " · tạm thời không truy cập được"}</small>
                    </span>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </>
                );
                return (
                  <li key={center.centerId}>
                    {center.canAccess ? (
                      <Link className="center-card" href={`/centers/${center.centerId}`}>{body}<ArrowRight aria-hidden="true" /></Link>
                    ) : (
                      <div className="center-card is-blocked" aria-disabled="true">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
