"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DARK_QUERY, STORAGE_KEY } from "./theme-script";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const CHANGE_EVENT = "tm:theme";

export const themeOptions: Array<{ value: ThemePreference; label: string; description: string }> = [
  { value: "light", label: "Sáng", description: "Nền sáng, hợp làm việc ban ngày." },
  { value: "dark", label: "Tối", description: "Nền tối, dịu mắt khi ít ánh sáng." },
  { value: "system", label: "Theo thiết bị", description: "Tự đổi theo cài đặt sáng/tối của máy." },
];

export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemPrefersDark() {
  try {
    return window.matchMedia(DARK_QUERY).matches;
  } catch {
    return false;
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === "dark" || (preference === "system" && systemPrefersDark()) ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference = readThemePreference()) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* storage blocked: the choice still applies to this page view */
  }
  applyTheme(preference);
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: preference }));
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia(DARK_QUERY);
  const onSystem = () => {
    if (readThemePreference() === "system") applyTheme("system");
    onChange();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    applyTheme();
    onChange();
  };
  media.addEventListener("change", onSystem);
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function snapshot(): string {
  const preference = readThemePreference();
  return `${preference}:${resolveTheme(preference)}`;
}

/** The saved preference and the theme actually shown; follows other tabs and the OS setting. */
export function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:light");
  const [preference, resolved] = value.split(":") as [ThemePreference, ResolvedTheme];
  const setPreference = useCallback((next: ThemePreference) => setThemePreference(next), []);
  return { preference, resolved, setPreference };
}

/** Mounted once in the root layout so "Theo thiết bị" follows the OS even on pages without theme controls. */
export function ThemeWatcher() {
  useTheme();
  return null;
}
