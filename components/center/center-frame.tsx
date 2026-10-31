"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import Link from "next/link";
import { NavLink } from "@/components/ui/nav-link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  ChevronsUpDown,
  Coins,
  HandCoins,
  ClipboardCheck,
  DoorOpen,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  MessageSquareReply,
  Presentation,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  UserCog,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { ApiError, authApi, getApiErrorMessage, identityApi, payrollApi, type CenterContext, type PayrollStatus } from "@/lib/api";
import { useResource } from "@/lib/hooks/use-resource";
import { FINANCE_ROLES, MANAGEMENT_ROLES, centerStatus, payrollModeLabels, roleLabel } from "@/lib/labels";
import { initials } from "@/lib/format";
import { useSessionUser } from "@/lib/auth/session";
import { UserChip } from "@/components/ui/primitives";

export interface CenterScope {
  centerId: string;
  context: CenterContext;
  canManage: boolean;
  isOwner: boolean;
  /** H13: owner, manager and staff see tuition; teachers do not. */
  canSeeFinance: boolean;
  /** docs/LUONG-VA-CHIA-THU-NHAP.md: null while loading or when it failed (the menu then hides payroll). */
  payroll: PayrollStatus | null;
  reloadPayroll: () => void;
}

const CenterScopeContext = createContext<CenterScope | null>(null);

export function useCenter(): CenterScope {
  const scope = useContext(CenterScopeContext);
  if (!scope) throw new Error("useCenter must be used inside CenterFrame.");
  return scope;
}

type NavItem = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
  requires?: "manage" | "owner" | "finance";
  reason?: string;
};

function navGroups(centerId: string, payroll: PayrollStatus | null): Array<{ label: string; items: NavItem[] }> {
  const base = `/centers/${centerId}`;
  // C1: hidden entirely while the platform admin has payroll off for this center.
  const payrollItems: NavItem[] = !payroll?.enabled ? [] : [
    ...(payroll.canSeeAll ? [{ href: `${base}/payroll`, label: payrollModeLabels[payroll.mode]?.title ?? "Lương", icon: Coins }] : []),
    ...(payroll.myTeacherId ? [{ href: `${base}/my-earnings`, label: "Thu nhập của tôi", icon: HandCoins }] : []),
  ];
  return [
    {
      label: "Vận hành",
      items: [
        { href: base, label: "Tổng quan", icon: LayoutDashboard, exact: true },
        { href: `${base}/schedule`, label: "Lịch dạy", icon: CalendarDays },
        { href: `${base}/attendance`, label: "Điểm danh", icon: ClipboardCheck },
        { href: `${base}/applications`, label: "Đơn đăng ký lớp", icon: Inbox, requires: "manage", reason: "Duyệt đơn chỉ dành cho chủ hoặc quản lý trung tâm." },
        { href: `${base}/requests`, label: "Phản hồi học sinh", icon: MessageSquareReply, requires: "manage", reason: "Duyệt yêu cầu học sinh dành cho chủ hoặc quản lý trung tâm." },
        { href: `${base}/my-schedule`, label: "Lịch của tôi", icon: CalendarCheck },
      ],
    },
    {
      label: "Đào tạo",
      items: [
        { href: `${base}/classes`, label: "Lớp học", icon: Presentation },
        { href: `${base}/students`, label: "Học sinh", icon: GraduationCap },
        { href: `${base}/teachers`, label: "Giáo viên", icon: UsersRound },
        { href: `${base}/subjects`, label: "Môn học", icon: BookOpen },
        { href: `${base}/rooms`, label: "Phòng học", icon: DoorOpen },
      ],
    },
    {
      label: "Trung tâm",
      items: [
        { href: `${base}/profile`, label: "Hồ sơ trung tâm", icon: Building2 },
        { href: `${base}/members`, label: "Thành viên", icon: UserCog, requires: "manage", reason: "Danh sách thành viên dành cho chủ và quản lý trung tâm." },
      ],
    },
    {
      label: "Tài chính",
      items: [
        { href: `${base}/tuition`, label: "Học phí", icon: WalletCards, requires: "finance", reason: "Học phí dành cho chủ, quản lý và nhân viên trung tâm." },
        ...payrollItems,
      ],
    },
  ];
}

const upcoming = [
  { label: "Báo cáo", icon: BarChart3 },
];

export function CenterFrame({ centerId, children }: { centerId: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSessionUser();
  const resource = useResource(() => identityApi.centerContext(centerId), [centerId]);
  // Switching only makes sense when the account really has somewhere else to go.
  const memberships = useResource(() => identityApi.myCenters(), []);
  const canSwitch = Boolean(user?.isPlatformAdmin || (memberships.data && memberships.data.length > 1));
  const payroll = useResource(() => payrollApi.status(centerId), [centerId]);
  const reloadPayroll = payroll.reload;

  const scope = useMemo<CenterScope | null>(() => {
    if (!resource.data) return null;
    return {
      centerId,
      context: resource.data,
      canManage: MANAGEMENT_ROLES.has(resource.data.role),
      isOwner: resource.data.role === "CenterOwner",
      canSeeFinance: FINANCE_ROLES.has(resource.data.role),
      payroll: payroll.data ?? null,
      reloadPayroll: () => void reloadPayroll(),
    };
  }, [centerId, resource.data, payroll.data, reloadPayroll]);

  async function logout() {
    await authApi.logout();
    router.replace("/login");
  }

  if (resource.loading && !scope) {
    return (
      <main className="standalone-state">
        <LoaderCircle className="spin" aria-hidden="true" />
        <h1>Đang mở trung tâm</h1>
        <p>Khôi phục phiên và kiểm tra quyền thành viên…</p>
      </main>
    );
  }

  if (!scope) {
    const forbidden = resource.error instanceof ApiError && resource.error.status === 403;
    return (
      <main className="standalone-state">
        {forbidden ? <ShieldAlert aria-hidden="true" /> : <RefreshCcw aria-hidden="true" />}
        <h1>{forbidden ? "Không thể vào trung tâm này" : "Chưa tải được trung tâm"}</h1>
        <p>
          {forbidden
            ? "Trung tâm có thể đang bị đình chỉ, chưa được duyệt, hoặc tài khoản của bạn không còn là thành viên đang hoạt động."
            : getApiErrorMessage(resource.error, "Không kết nối được máy chủ.")}
        </p>
        <div className="standalone-actions">
          {!forbidden && <button className="btn btn-secondary" onClick={() => void resource.reload()}>Thử lại</button>}
          <Link className="btn btn-primary" href="/select-center">Chọn trung tâm khác</Link>
        </div>
      </main>
    );
  }

  const status = centerStatus[scope.context.status] ?? { label: scope.context.status, tone: "neutral" };
  const groups = navGroups(centerId, scope.payroll);

  return (
    <CenterScopeContext.Provider value={scope}>
      <div className="app">
        <aside className="sidebar">
          <Link className="brand" href={`/centers/${centerId}`}>
            <span className="brand-mark"><BookOpen aria-hidden="true" /></span>
            <span><strong>Quản Lý Dạy Thêm</strong><small>Vận hành trung tâm</small></span>
          </Link>

          {canSwitch ? (
            <Link className="center-switch" href="/select-center" title="Đổi nơi làm việc">
              <span className="center-avatar">{initials(scope.context.displayName)}</span>
              <span className="center-switch-text">
                <strong>{scope.context.displayName}</strong>
                <small>{roleLabel(scope.context.role)}</small>
              </span>
              <ChevronsUpDown aria-hidden="true" />
            </Link>
          ) : (
            <div className="center-switch is-static">
              <span className="center-avatar">{initials(scope.context.displayName)}</span>
              <span className="center-switch-text">
                <strong>{scope.context.displayName}</strong>
                <small>{roleLabel(scope.context.role)}</small>
              </span>
            </div>
          )}

          <p className={`access-line tone-${status.tone}`}>
            <ShieldCheck aria-hidden="true" />
            <span>Trung tâm {status.label.toLowerCase()} · {scope.canManage ? "có quyền quản lý" : "chỉ xem"}</span>
          </p>

          <nav className="side-nav" aria-label="Điều hướng trung tâm">
            {groups.map((group) => (
              <div className="side-nav-group" key={group.label}>
                <span className="side-nav-label">{group.label}</span>
                {group.items.map((item) => {
                  const allowed = !item.requires || (item.requires === "manage" ? scope.canManage
                    : item.requires === "finance" ? scope.canSeeFinance : scope.isOwner);
                  const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  if (!allowed) {
                    return (
                      <span className="side-nav-item disabled" key={item.href} title={item.reason} aria-disabled="true">
                        <Icon aria-hidden="true" /><span>{item.label}</span>
                      </span>
                    );
                  }
                  return (
                    <NavLink href={item.href} key={item.href} active={active} icon={<Icon aria-hidden="true" />}>{item.label}</NavLink>
                  );
                })}
              </div>
            ))}
            <div className="side-nav-group side-nav-upcoming">
              <span className="side-nav-label">Chưa có API</span>
              {upcoming.map(({ label, icon: Icon }) => (
                <span className="side-nav-item disabled" key={label} title="Back-end chưa cung cấp nghiệp vụ này" aria-disabled="true">
                  <Icon aria-hidden="true" /><span>{label}</span>
                </span>
              ))}
            </div>
          </nav>

          <div className="sidebar-footer">
            {user?.isPlatformAdmin && <Link href="/platform"><ShieldCheck aria-hidden="true" />Quản trị nền tảng</Link>}
            <Link href="/account/security"><UserCog aria-hidden="true" />Tài khoản & bảo mật</Link>
            <button type="button" onClick={() => void logout()}><LogOut aria-hidden="true" />Đăng xuất</button>
          </div>
        </aside>

        <div className="content">
          <header className="topbar">
            <span className="topbar-center"><Building2 aria-hidden="true" />{scope.context.displayName}</span>
            <UserChip name={user?.username ?? "Tài khoản"} role={roleLabel(scope.context.role)} />
          </header>
          <main className="workspace">{children}</main>
        </div>
      </div>
    </CenterScopeContext.Provider>
  );
}

/** Inline explanation shown when a route needs a role the member does not hold. */
export function RoleGate({ need, children }: { need: "manage" | "owner" | "finance"; children: ReactNode }) {
  const scope = useCenter();
  const allowed = need === "manage" ? scope.canManage : need === "finance" ? scope.canSeeFinance : scope.isOwner;
  if (allowed) return <>{children}</>;
  return (
    <div className="standalone-inline">
      <ShieldAlert aria-hidden="true" />
      <h1>Bạn đang ở vai trò {roleLabel(scope.context.role).toLowerCase()}</h1>
      <p>
        {need === "manage"
          ? "Màn hình này chỉ dành cho chủ trung tâm hoặc quản lý trung tâm theo chính sách hiện tại của hệ thống."
          : need === "finance"
            ? "Học phí chỉ dành cho chủ, quản lý và nhân viên trung tâm; giáo viên không xem được."
            : "Chỉ chủ trung tâm mới gửi được yêu cầu thay đổi hồ sơ pháp lý."}
      </p>
      <Link className="btn btn-secondary" href={`/centers/${scope.centerId}`}>Về tổng quan</Link>
    </div>
  );
}
