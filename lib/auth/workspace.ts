"use client";

const KEY = "tm.lastWorkspace";

export interface Workspace {
  href: string;
  label: string;
}

/** Remembered by each frame so Settings can offer a way back to where the user was working. */
export function rememberWorkspace(workspace: Workspace) {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(workspace));
  } catch {
    /* storage unavailable: Settings falls back to the account's home */
  }
}

export function readWorkspace(): Workspace | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Workspace>;
    if (typeof parsed.href !== "string" || !parsed.href.startsWith("/") || parsed.href.startsWith("//")) return null;
    return { href: parsed.href, label: typeof parsed.label === "string" ? parsed.label : "Nơi làm việc" };
  } catch {
    return null;
  }
}

export function forgetWorkspace() {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to forget */
  }
}
