"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  Link2,
  LoaderCircle,
  Mail,
  MonitorSmartphone,
  Palette,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { accountName, useAccount } from "@/lib/auth/account";
import { useSessionUser } from "@/lib/auth/session";
import { readWorkspace, type Workspace } from "@/lib/auth/workspace";
import { initials } from "@/lib/format";
import { AccountMenu } from "@/components/ui/account-menu";

export interface SettingsNavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export const settingsGroups: Array<{ label: string; items: SettingsNavItem[] }> = [
  {
    label: "Tài khoản",
    items: [
      { href: "/settings/profile", label: "Hồ sơ cá nhân", description: "Họ tên hiển thị, số điện thoại", icon: UserRound },
      { href: "/settings/email", label: "Email đăng nhập", description: "Đổi email, xác minh bằng mã", icon: Mail },
    ],
  },
  {
    label: "Bảo mật",
    items: [
      { href: "/settings/password", label: "Mật khẩu", description: "Đổi mật khẩu đăng nhập", icon: KeyRound },
      { href: "/settings/google", label: "Đăng nhập Google", description: "Liên kết để vào nhanh", icon: Link2 },
      { href: "/settings/sessions", label: "Phiên đăng nhập", description: "Đăng xuất máy này hoặc mọi nơi", icon: MonitorSmartphone },
    ],
  },
  {
    label: "Tuỳ chọn",
    items: [
      { href: "/settings/appearance", label: "Giao diện", description: "Sáng, tối hoặc theo thiết bị", icon: Palette },
    ],
  },
];

/**
 * Settings shell in the style of a social-app settings hub: a list of sections on the left and the chosen
 * section on the right. On phones the list is the /settings page itself and each section opens on its own.
 */
export function SettingsFrame({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, status } = useSessionUser();
  const { account } = useAccount(status === "ready");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const isIndex = pathname === "/settings";

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [pathname, router, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => setWorkspace(readWorkspace()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (status !== "ready" || !user) {
    return <main className="standalone-state"><LoaderCircle className="spin" aria-hidden="true" /><h1>Đang mở cài đặt</h1></main>;
  }

  const home: Workspace = workspace ?? (user.isStudent
    ? { href: "/student", label: "Cổng học sinh" }
    : user.isPlatformAdmin ? { href: "/platform", label: "Quản trị nền tảng" } : { href: "/select-center", label: "Nơi làm việc" });
  const roleLabel = user.isStudent ? "Học sinh" : user.isPlatformAdmin ? "Quản trị nền tảng" : "Thành viên";
  const name = accountName(account, user);

  return (
    <div className="select-page settings-app">
      <header className="select-bar">
        <Link className="brand brand-dark" href={home.href}><span className="brand-mark"><BookOpen aria-hidden="true" /></span><strong>Quản Lý Dạy Thêm</strong></Link>
        <div className="settings-bar-actions">
          <Link className="settings-home-link" href={home.href}><ArrowLeft aria-hidden="true" /><span>Về {home.label}</span></Link>
          <span className="only-wide"><AccountMenu roleLabel={roleLabel} /></span>
          <span className="only-narrow"><AccountMenu variant="compact" roleLabel={roleLabel} /></span>
        </div>
      </header>

      <div className="settings-layout" data-index={isIndex ? "true" : "false"}>
        <aside className="settings-nav" aria-label="Mục cài đặt">
          <h1>Cài đặt</h1>
          <Link className="settings-nav-account" href="/settings/profile">
            <span className="account-avatar" aria-hidden="true">{initials(name)}</span>
            <span>
              <strong>{name}</strong>
              <small>{account?.email ?? "Hồ sơ của bạn"}</small>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          {settingsGroups.map((group) => (
            <nav className="settings-nav-group" key={group.label} aria-label={group.label}>
              <span className="settings-nav-label">{group.label}</span>
              {group.items.map(({ href, label, description, icon: Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link key={href} href={href} className="settings-nav-item" aria-current={active ? "page" : undefined}>
                    <span className="settings-nav-icon"><Icon aria-hidden="true" /></span>
                    <span className="settings-nav-text"><strong>{label}</strong><small>{description}</small></span>
                    <ChevronRight className="settings-nav-chevron" aria-hidden="true" />
                  </Link>
                );
              })}
            </nav>
          ))}
          <p className="settings-nav-note"><ShieldCheck aria-hidden="true" />Vai trò trong từng trung tâm do chủ trung tâm cấp; bạn không tự đổi ở đây.</p>
        </aside>
        <main className="settings-content">{children}</main>
      </div>
    </div>
  );
}

/** Header of one settings section; on phones it carries the way back to the list. */
export function SettingsPanel({ title, description, icon: Icon, children }: { title: string; description: ReactNode; icon: LucideIcon; children: ReactNode }) {
  return (
    <section className="settings-panel" aria-labelledby="settings-panel-title">
      <Link className="settings-back" href="/settings"><ChevronLeft aria-hidden="true" />Cài đặt</Link>
      <header className="settings-panel-head">
        <span className="settings-panel-icon"><Icon aria-hidden="true" /></span>
        <div>
          <h2 id="settings-panel-title">{title}</h2>
          <p>{description}</p>
        </div>
      </header>
      <div className="settings-panel-body">{children}</div>
    </section>
  );
}

/** A titled white card inside a section, like the rows of a settings page. */
export function SettingsCard({ title, description, children, tone }: { title?: string; description?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <div className={`settings-card${tone === "danger" ? " settings-card-danger" : ""}`}>
      {(title || description) && (
        <header className="settings-card-head">
          {title && <h3>{title}</h3>}
          {description && <p>{description}</p>}
        </header>
      )}
      {children}
    </div>
  );
}
