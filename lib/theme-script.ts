export const STORAGE_KEY = "tm.theme";
export const DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * Runs in <head> before the first paint (see app/layout.tsx) so a dark-mode visitor never sees a white flash.
 * Kept as a plain string with no imports; it mirrors `applyTheme` in lib/theme.ts.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("${STORAGE_KEY}");var d=p==="dark"||(p!=="light"&&window.matchMedia("${DARK_QUERY}").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;
