"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Repeat } from "lucide-react";

/** One schedule area, two views: the sessions themselves and the weekly rules that generate them. */
export function ScheduleTabs({ centerId }: { centerId: string }) {
  const pathname = usePathname();
  const base = `/centers/${centerId}/schedule`;
  const tabs = [
    { href: base, label: "Theo tuần", hint: "Từng buổi học", icon: CalendarDays, active: pathname === base },
    { href: `${base}/series`, label: "Lịch lặp", hint: "Quy tắc sinh buổi", icon: Repeat, active: pathname.startsWith(`${base}/series`) },
  ];
  return (
    <nav className="view-tabs" aria-label="Chế độ xem lịch dạy">
      {tabs.map(({ href, label, hint, icon: Icon, active }) => (
        <Link key={href} href={href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
          <Icon aria-hidden="true" />
          <span><strong>{label}</strong><small>{hint}</small></span>
        </Link>
      ))}
    </nav>
  );
}
