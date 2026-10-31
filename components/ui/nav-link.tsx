"use client";

import { ViewTransition, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";

/**
 * Sidebar destination. The active highlight is one shared element that glides to
 * the new item during the route transition, so the shell shows where you went
 * while the workspace swaps; a pending rail marks the clicked item when the
 * destination is still loading.
 */
export function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: ReactNode; children: ReactNode }) {
  return (
    <Link className={`side-nav-item${active ? " active" : ""}`} href={href} aria-current={active ? "page" : undefined}>
      {active && (
        <ViewTransition name="side-nav-active" share="nav-glide" default="none">
          <span className="side-nav-pill" aria-hidden="true" />
        </ViewTransition>
      )}
      {icon}
      <span>{children}</span>
      <PendingRail />
    </Link>
  );
}

function PendingRail() {
  const { pending } = useLinkStatus();
  return <span className={`side-nav-pending${pending ? " is-pending" : ""}`} aria-hidden="true" />;
}
