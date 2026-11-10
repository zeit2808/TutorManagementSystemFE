"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Building2,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  LogOut,
  Monitor,
  Moon,
  Settings,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { accountName, useAccount } from "@/lib/auth/account";
import { useSessionUser } from "@/lib/auth/session";
import { useLogout } from "@/lib/auth/use-logout";
import { initials } from "@/lib/format";
import { useTheme, type ThemePreference } from "@/lib/theme";

export interface AccountMenuCenter {
  name: string;
  statusLabel: string;
  tone: string;
  canManage: boolean;
}

export interface AccountMenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface AccountMenuProps {
  /** Badge on the chip and in the menu header, e.g. "Chủ trung tâm". */
  roleLabel: string;
  /** The center the user is working in, when there is one. */
  center?: AccountMenuCenter;
  /** Shows "Đổi trung tâm" (only when the account has somewhere else to go). */
  canSwitchCenter?: boolean;
  /** Other areas of the product this account can open (platform admin, student portal…). */
  links?: AccountMenuLink[];
  /** "compact" draws only the round avatar (phones, narrow bars). */
  variant?: "full" | "compact";
  className?: string;
}

const themeChoices: Array<{ value: ThemePreference; label: string; icon: LucideIcon }> = [
  { value: "light", label: "Sáng", icon: Sun },
  { value: "dark", label: "Tối", icon: Moon },
  { value: "system", label: "Theo máy", icon: Monitor },
];

const CLOSE_MS = 140;
const SHEET_QUERY = "(max-width: 600px)";

type Phase = "closed" | "open" | "closing";

/**
 * The account chip in the top bar and its menu: who is signed in, the center in use, Settings, a quick
 * light/dark switch and sign-out. Follows the WAI-ARIA menu-button pattern; on phones the menu is a bottom sheet.
 */
export function AccountMenu({ roleLabel, center, canSwitchCenter = false, links = [], variant = "full", className }: AccountMenuProps) {
  const pathname = usePathname();
  const { user } = useSessionUser();
  const { account, error, loading, reload } = useAccount(Boolean(user));
  const { preference, setPreference } = useTheme();
  const { logout, pending: loggingOut } = useLogout();

  const [phase, setPhase] = useState<Phase>("closed");
  const [sheet, setSheet] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<"first" | "last">("first");
  const closeTimer = useRef<number | undefined>(undefined);
  const menuId = useId();
  const headingId = useId();

  const name = accountName(account, user);
  const avatar = initials(name);
  const open = phase === "open";
  const mounted = phase !== "closed";

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const isSheet = window.matchMedia(SHEET_QUERY).matches;
    setSheet(isSheet);
    const rect = trigger.getBoundingClientRect();
    setPosition({ top: Math.round(rect.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - rect.right)) });
  }, []);

  const show = useCallback((focus: "first" | "last" = "first") => {
    window.clearTimeout(closeTimer.current);
    focusOnOpen.current = focus;
    place();
    setPhase("open");
  }, [place]);

  const hide = useCallback((restoreFocus: boolean) => {
    setPhase((current) => (current === "open" ? "closing" : current));
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPhase("closed"), CLOSE_MS);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  // Any navigation closes the menu (a Link inside it, the browser Back button…).
  const lastPath = useRef(pathname);
  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    const timer = window.setTimeout(() => hide(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname, hide]);

  // Move focus into the menu once it is on screen.
  useLayoutEffect(() => {
    if (!open) return;
    const items = menuItems(menuRef.current);
    (focusOnOpen.current === "last" ? items.at(-1) : items[0])?.focus();
  }, [open]);

  // Outside press, resize and scroll while open.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      const focusInside = menuRef.current?.contains(document.activeElement) ?? false;
      hide(focusInside);
    };
    const onResize = () => place();
    document.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onResize, true);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open, hide, place]);

  // The bottom sheet holds the page still behind it.
  useEffect(() => {
    if (!open || !sheet) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => { document.documentElement.style.overflow = previous; };
  }, [open, sheet]);

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      show("first");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      show("last");
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems(menuRef.current);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (next: number) => {
      event.preventDefault();
      items[(next + items.length) % items.length]?.focus();
    };
    switch (event.key) {
      case "ArrowDown": return move(index + 1);
      case "ArrowUp": return move(index - 1);
      case "ArrowRight": if (isRadio(items[index])) move(index + 1); return;
      case "ArrowLeft": if (isRadio(items[index])) move(index - 1); return;
      case "Home": return move(0);
      case "End": return move(items.length - 1);
      case "Escape":
        event.preventDefault();
        return hide(true);
      case "Tab":
        event.preventDefault();
        return hide(true);
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const letter = event.key.toLocaleLowerCase("vi");
          const order = [...items.slice(index + 1), ...items.slice(0, index + 1)];
          const match = order.find((item) => (item.dataset.label ?? item.textContent ?? "").trim().toLocaleLowerCase("vi").startsWith(letter));
          if (match) { event.preventDefault(); match.focus(); }
        }
    }
  }

  const header = (
    <div className="account-menu-card" id={headingId}>
      <span className="account-avatar account-avatar-lg" aria-hidden="true">{avatar}</span>
      <span className="account-menu-who">
        <strong>{name}</strong>
        {account ? (
          <small>{account.email}</small>
        ) : error ? (
          <small className="account-menu-error">
            Chưa tải được email ·{" "}
            <button type="button" className="link-button" onClick={() => void reload()}>Thử lại</button>
          </small>
        ) : (
          <small className="account-menu-skeleton" aria-label="Đang tải email" />
        )}
        <span className="account-role">{roleLabel}</span>
      </span>
    </div>
  );

  const panel = mounted && position ? (
    <div className={`account-menu-layer${sheet ? " is-sheet" : ""}`} data-state={open ? "open" : "closing"}>
      {sheet && <div className="account-menu-backdrop" aria-hidden="true" />}
      <div
        ref={menuRef}
        id={menuId}
        role="menu"
        aria-labelledby={headingId}
        className="account-menu"
        style={sheet ? undefined : { top: position.top, right: position.right }}
        onKeyDown={onMenuKeyDown}
      >
        {sheet && <span className="account-menu-grip" aria-hidden="true" />}
        {header}

        {center && (
          <div role="group" aria-label="Trung tâm đang làm việc" className="account-menu-group">
            <div className="account-menu-center">
              <Building2 aria-hidden="true" />
              <span>
                <strong>{center.name}</strong>
                <small className={`tone-text-${center.tone}`}>{center.statusLabel} · {center.canManage ? "có quyền quản lý" : "chỉ xem"}</small>
              </span>
            </div>
            {canSwitchCenter && (
              <MenuLink href="/select-center" icon={ArrowLeftRight} onSelect={() => hide(false)}>Đổi trung tâm</MenuLink>
            )}
          </div>
        )}

        <div role="group" aria-label="Tài khoản" className="account-menu-group">
          <MenuLink href="/settings" icon={Settings} hint="Hồ sơ, mật khẩu, giao diện" onSelect={() => hide(false)} trailing>
            Cài đặt
          </MenuLink>
          {links.filter((link) => !pathname.startsWith(link.href)).map((link) => (
            <MenuLink key={link.href} href={link.href} icon={link.icon} onSelect={() => hide(false)}>{link.label}</MenuLink>
          ))}
        </div>

        <div role="group" aria-labelledby={`${menuId}-theme`} className="account-menu-group">
          <span className="account-menu-label" id={`${menuId}-theme`}>Giao diện</span>
          <div className="account-theme-row">
            {themeChoices.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="menuitemradio"
                aria-checked={preference === value}
                tabIndex={-1}
                data-label={label}
                className="account-theme-option"
                onClick={() => setPreference(value)}
              >
                <Icon aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div role="group" aria-label="Phiên đăng nhập" className="account-menu-group">
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="account-menu-item is-danger"
            aria-disabled={loggingOut || undefined}
            data-label="Đăng xuất"
            onClick={() => void logout()}
          >
            {loggingOut ? <LoaderCircle className="spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            <span className="account-menu-text">{loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}</span>
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`user-chip${variant === "compact" ? " is-compact" : ""}${className ? ` ${className}` : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={mounted ? menuId : undefined}
        aria-label={`Tài khoản: ${name}, ${roleLabel}`}
        onClick={() => (open ? hide(false) : show("first"))}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="user-chip-inner">
          <span className="user-chip-avatar" aria-hidden="true">{avatar}</span>
          {variant === "full" && (
            <>
              <span className="user-chip-name">{loading && !account && !user?.username ? "…" : name}</span>
              <span className="user-chip-role">{roleLabel}</span>
              <ChevronDown className="user-chip-caret" aria-hidden="true" />
            </>
          )}
        </span>
      </button>
      {panel && createPortal(panel, document.body)}
    </>
  );
}

function MenuLink({ href, icon: Icon, children, hint, trailing, onSelect }: { href: string; icon: LucideIcon; children: ReactNode; hint?: string; trailing?: boolean; onSelect: () => void }) {
  return (
    <Link href={href} role="menuitem" tabIndex={-1} className="account-menu-item" onClick={onSelect} data-label={typeof children === "string" ? children : undefined}>
      <Icon aria-hidden="true" />
      <span className="account-menu-text">
        {children}
        {hint && <small>{hint}</small>}
      </span>
      {trailing && <ChevronRight className="account-menu-trailing" aria-hidden="true" />}
    </Link>
  );
}

function menuItems(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemradio"]'))
    .filter((item) => item.getAttribute("aria-disabled") !== "true");
}

function isRadio(item: HTMLElement | undefined) {
  return item?.getAttribute("role") === "menuitemradio";
}
