import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../store/appStore";
import { findTheme } from "../utils/themes";
import { Activity, Logo, Moon, Sun, Search, SidebarIcon } from "./icons";
import { CommandLauncher } from "./CommandLauncher";
import "./TopBar.css";
import { useI18n } from "../i18n";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { IS_MAC } from "../shortcuts/binding";

/** Relative luminance of an #rrggbb / #rgb / rgba(...) color. Returns 0..1. */
function colorLuminance(input: string | undefined): number {
  if (!input) return 0;
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(input.trim());
  if (m) {
    const hex = m[1].length === 3
      ? m[1].split("").map((c) => c + c).join("")
      : m[1];
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  const rgba = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(input);
  if (rgba) {
    const r = Number(rgba[1]) / 255;
    const g = Number(rgba[2]) / 255;
    const b = Number(rgba[3]) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  return 0;
}

function isLightTheme(themeId: string): boolean {
  const bg = findTheme(themeId).theme.background;
  return colorLuminance(bg) > 0.5;
}

const CHROME_THEME_KEY = "shellboard.chromeTheme";
const TERM_PREF_KEY = "shellboard.terminalThemeByChrome";

function readSavedChromeTheme(): "dark" | "light" {
  if (typeof localStorage === "undefined") return "dark";
  const v = localStorage.getItem(CHROME_THEME_KEY);
  return v === "light" ? "light" : "dark";
}

function readTermPrefs(): { dark: string; light: string } {
  const fallback = { dark: "shellboard", light: "shellboard-light" };
  if (typeof localStorage === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(TERM_PREF_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<{ dark: string; light: string }>;
    return {
      dark: typeof parsed.dark === "string" ? parsed.dark : fallback.dark,
      light: typeof parsed.light === "string" ? parsed.light : fallback.light,
    };
  } catch {
    return fallback;
  }
}

function writeTermPrefs(prefs: { dark: string; light: string }) {
  try {
    localStorage.setItem(TERM_PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

type TopBarProps = {
  onOpenPalette: () => void;
  onOpenRunningApps: () => void;
};

export function TopBar({ onOpenPalette, onOpenRunningApps }: TopBarProps) {
  const { t } = useI18n();
  const showError = useAppStore((state) => state.showError);
  const activeProjectId = useAppStore((s) => s.activeProjectId);
  const projects = useAppStore((s) => s.projects);
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const sidebarVisible = useAppStore((s) => s.sidebarVisible);
  const sidebarWidth = useAppStore((s) => s.sidebarWidth);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const terminalTheme = useAppStore((s) => s.settings.terminalTheme);
  const updateSettings = useAppStore((s) => s.updateSettings);

  const [chromeTheme, setChromeTheme] = useState<"dark" | "light">(
    readSavedChromeTheme,
  );
  // Per-mode terminal theme memory. When the user picks a terminal theme
  // (via Settings or palette) we record it as the preferred theme for the
  // current chrome mode; toggling chrome then restores the other mode's
  // saved choice. Defaults to the ShellBoard pair.
  const termPrefsRef = useRef(readTermPrefs());
  // Distinguishes "store changed because the user picked a theme" from
  // "store changed because we applied a saved pref" — so the auto-apply
  // doesn't keep overwriting itself.
  const applyingPrefRef = useRef(false);

  // Idempotent: just keeps the DOM attribute and the chrome-mode pointer in
  // localStorage in sync with state. NEVER calls updateSettings here —
  // App.tsx hydrates the store from disk asynchronously, and any mount-time
  // (or React-StrictMode double-fired) settings write would clobber the
  // user's saved font/size with DEFAULT_SETTINGS. Theme restoration on
  // chrome toggle is handled inline in toggleChromeTheme instead.
  useEffect(() => {
    if (chromeTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    void getCurrentWindow().setTheme(chromeTheme).catch((error) => showError(String(error)));
    try {
      localStorage.setItem(CHROME_THEME_KEY, chromeTheme);
    } catch {
      /* ignore */
    }
  }, [chromeTheme, showError]);

  // When the user manually picks a terminal theme (from Settings or the
  // palette), follow its lightness with the chrome and remember the choice
  // as the pref for that chrome mode. Skip the next change if it's just us
  // applying the saved pref above.
  useEffect(() => {
    if (applyingPrefRef.current) {
      applyingPrefRef.current = false;
      return;
    }
    const themeIsLight = isLightTheme(terminalTheme);
    const targetChrome: "dark" | "light" = themeIsLight ? "light" : "dark";
    if (targetChrome !== chromeTheme) {
      // Save the pref under the *new* chrome mode so toggling back later
      // restores this choice, not the placeholder it would have replaced.
      termPrefsRef.current = {
        ...termPrefsRef.current,
        [targetChrome]: terminalTheme,
      };
      writeTermPrefs(termPrefsRef.current);
      setChromeTheme(targetChrome);
      return;
    }
    if (termPrefsRef.current[chromeTheme] === terminalTheme) return;
    termPrefsRef.current = {
      ...termPrefsRef.current,
      [chromeTheme]: terminalTheme,
    };
    writeTermPrefs(termPrefsRef.current);
  }, [terminalTheme, chromeTheme]);

  const toggleChromeTheme = () => {
    const next = chromeTheme === "dark" ? "light" : "dark";
    setChromeTheme(next);
    // Restore the user's last terminal theme for the target chrome mode.
    // Done here (not in useEffect) so it can never fire on mount or under
    // StrictMode's double-effect — both of those would race with App.tsx's
    // async hydrate and overwrite the saved settings file with defaults.
    const desired = termPrefsRef.current[next];
    if (desired && useAppStore.getState().settings.terminalTheme !== desired) {
      applyingPrefRef.current = true;
      void updateSettings({ terminalTheme: desired });
    }
  };

  // The native menu's "Toggle Light/Dark Chrome" item dispatches this event so
  // it reuses the exact toggle above without lifting its localStorage / per-mode
  // logic out of the component. A ref keeps the listener calling the latest
  // closure without re-subscribing on every render.
  const toggleRef = useRef(toggleChromeTheme);
  toggleRef.current = toggleChromeTheme;
  useEffect(() => {
    const handler = () => toggleRef.current();
    window.addEventListener("shellboard:toggle-chrome-theme", handler);
    return () =>
      window.removeEventListener("shellboard:toggle-chrome-theme", handler);
  }, []);

  return (
    <header className="topbar" data-tauri-drag-region>
      <div className="topbar__brand" style={{ width: sidebarVisible ? sidebarWidth + 1 : undefined }} data-tauri-drag-region>
        <span className="topbar__logo"><Logo size={22} color="var(--accent-strong)" /></span>
        <span className="topbar__name">{t("ShellBoard")}</span>
        <button type="button" className="topbar__btn topbar__sidebar-toggle"
          onClick={() => void toggleSidebar()}
          aria-label={t(sidebarVisible ? "Hide sidebar" : "Show sidebar")}
          data-tooltip={t(sidebarVisible ? "Hide sidebar" : "Show sidebar")}>
          <SidebarIcon size={16} />
        </button>
      </div>
      <div className="topbar__workspace">
        <div className="topbar__content" data-tauri-drag-region>
          {activeProject && <h1 className="topbar__project" data-tooltip={activeProject.path}>{activeProject.name}</h1>}
          <span className="topbar__spacer" data-tauri-drag-region />
          {activeProject && <CommandLauncher key={activeProject.id} projectId={activeProject.id} />}
          <div className="topbar__utilities">
      <button
        type="button"
        className="topbar__btn"
        onClick={onOpenRunningApps}
        aria-label={t("Running apps")}
        data-tooltip={t("Running apps")}
      >
        <Activity size={16} />
      </button>
      <button
        type="button"
        className="topbar__btn"
        onClick={toggleChromeTheme}
        aria-label={t(chromeTheme === "dark" ? "Switch to light" : "Switch to dark")}
        data-tooltip={t(chromeTheme === "dark" ? "Light mode" : "Dark mode")}
      >
        {chromeTheme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
      </button>
      <button
        type="button"
        className="topbar__btn topbar__palette"
        onClick={onOpenPalette}
        data-tooltip={t("Command palette")}
        aria-label={t("Command palette")}
      >
        <Search size={16} />
        <kbd>{IS_MAC ? "⌘ K" : "Ctrl K"}</kbd>
      </button>
          </div>
        </div>
      </div>
    </header>
  );
}
