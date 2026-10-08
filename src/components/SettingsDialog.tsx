import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { getName, getVersion, getTauriVersion } from "@tauri-apps/api/app";
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  useAppStore,
  type Settings,
} from "../store/appStore";
import { findTheme, THEMES } from "../utils/themes";
import { Cog, Folder, Search, Terminal as TerminalIcon } from "./icons";
import { ShortcutInput } from "./ShortcutInput";
import { bindingKey, shortcutCapture, IS_MAC, type Binding } from "../shortcuts/binding";
import {
  DEFAULT_BINDINGS,
  resolveBindings,
  SHORTCUT_ACTIONS,
  SHORTCUT_CATEGORIES,
} from "../shortcuts/registry";
import "./SettingsDialog.css";
import { useI18n } from "../i18n";

type SettingsDialogProps = {
  open: boolean;
  onClose: () => void;
  onOpenAbout: () => void;
};

type SectionId =
  | "general"
  | "terminal"
  | "appearance"
  | "shell"
  | "shortcuts"
  | "about";

const RAIL: ReadonlyArray<{
  id: SectionId;
  label: string;
  icon: (active: boolean) => ReactNode;
}> = [
  { id: "general", label: "General", icon: () => <Cog size={13} /> },
  { id: "terminal", label: "Terminal", icon: () => <TerminalIcon size={13} /> },
  {
    id: "appearance",
    label: "Appearance",
    icon: () => (
      <span
        className="settings__rail-swatch"
        aria-hidden
      />
    ),
  },
  { id: "shell", label: "Shell", icon: () => <Folder size={13} /> },
  {
    id: "shortcuts",
    label: "Shortcuts",
    icon: () => (
      <span className="settings__rail-glyph" aria-hidden>
        ⌘
      </span>
    ),
  },
  {
    id: "about",
    label: "About",
    icon: () => (
      <span className="settings__rail-glyph" aria-hidden>
        ⓘ
      </span>
    ),
  },
];

const FONT_PRESETS = [
  { label: "System (Menlo / Consolas)", value: DEFAULT_SETTINGS.terminalFontFamily },
  { label: "Menlo", value: "Menlo, monospace" },
  { label: "Monaco", value: "Monaco, monospace" },
  { label: "SF Mono", value: '"SF Mono", ui-monospace, monospace' },
  { label: "Fira Code", value: '"Fira Code", monospace' },
  { label: "JetBrains Mono", value: '"JetBrains Mono", monospace' },
  { label: "MesloLGS NF", value: '"MesloLGS NF", monospace' },
  { label: "Cascadia Code", value: '"Cascadia Code", monospace' },
  { label: "Source Code Pro", value: '"Source Code Pro", monospace' },
];

const SHELLBOARD_PALETTE = [
  "#181a1f",
  "#3a3d46",
  "#e57373",
  "#6ec27a",
  "#d8c66b",
  "#7aa8e8",
  "#d98ec9",
  "#6dc7c7",
  "#e8e9ee",
];

export function SettingsDialog({
  open,
  onClose,
  onOpenAbout,
}: SettingsDialogProps) {
  const { t } = useI18n();
  const [section, setSection] = useState<SectionId>("general");
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      // A shortcut is being recorded — let ShortcutInput own every key.
      if (shortcutCapture.isActive()) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (query) setQuery("");
        else onClose();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSection("general");
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="settings-backdrop" onMouseDown={onClose}>
      <div
        className="settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("Settings")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="settings-dialog__header">
          <Cog size={14} style={{ color: "var(--muted)" }} />
          <span className="settings-dialog__title">{t("Settings")}</span>
          <span className="settings-dialog__spacer" />
          <label className="settings-dialog__search">
            <Search size={11} style={{ color: "var(--muted)" }} />
            <input
              ref={searchRef}
              type="text"
              placeholder={t("Search settings…")}
              aria-label={t("Search settings…")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
            {query ? (
              <kbd className="kbd" onClick={() => setQuery("")}>
                {t("esc")}</kbd>
            ) : (
              <kbd className="kbd">{IS_MAC ? "⌘F" : "Ctrl+F"}</kbd>
            )}
          </label>
        </header>

        <div className="settings-dialog__body">
          <nav className="settings-dialog__rail" aria-label={t("Settings sections")}>
            {RAIL.map((item) => {
              const active = !query && section === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={
                    "settings-dialog__rail-item" +
                    (active ? " is-active" : "") +
                    (query ? " is-dim" : "")
                  }
                  onClick={() => {
                    setQuery("");
                    setSection(item.id);
                  }}
                >
                  <span className="settings-dialog__rail-icon">
                    {item.icon(active)}
                  </span>
                  <span>{t(item.label)}</span>
                </button>
              );
            })}
          </nav>

          <div className="settings-dialog__pane">
            {query ? (
              <SearchResults
                query={query}
                onJump={(id) => {
                  setQuery("");
                  setSection(id);
                }}
              />
            ) : (
              <SectionPane id={section} />
            )}
          </div>
        </div>

        <footer className="settings-dialog__footer">
          <button
            type="button"
            className="sb-btn sb-btn--ghost"
            onClick={onOpenAbout}
          >
            {t("About…")}</button>
          <span className="settings-dialog__spacer" />
          <button
            type="button"
            className="sb-btn sb-btn--secondary"
            onClick={() => {
              void useAppStore.getState().updateSettings(DEFAULT_SETTINGS);
            }}
          >
            {t("Reset to defaults")}</button>
          <button
            type="button"
            className="sb-btn sb-btn--primary"
            onClick={onClose}
          >
            <span>{t("Done")}</span>
            <kbd className="kbd kbd--on-accent">↵</kbd>
          </button>
        </footer>
      </div>
    </div>
  );
}

// ── Section pane ──────────────────────────────────────────────────────────

function SectionPane({ id }: { id: SectionId }) {
  const { t } = useI18n();
  switch (id) {
    case "general":
      return (
        <SectionHeader
          title={t("General")}
          subtitle={t("Window-wide preferences applied to every project.")}
        >
          <LanguageField />
          <UiFontSizeField />
          <ShowGroupCountField />
          <ConfirmCloseSplitTabField />
          <ConfirmBeforeQuittingField />
          <CheckForUpdatesField />
        </SectionHeader>
      );
    case "terminal":
      return (
        <SectionHeader
          title={t("Terminal")}
          subtitle={t("Font, scrollback, and behaviour used by every spawned shell.")}
        >
          <TerminalFontField />
          <TerminalFontSizeField />
          <ScrollbackField />
          <PersistScrollbackField />
          <ShowPanelHeaderField />
          <TrackCwdField />
          <NotifyLongCommandsField />
        </SectionHeader>
      );
    case "appearance":
      return (
        <SectionHeader
          title={t("Appearance")}
          subtitle={t("Terminal palette. The chrome auto-aligns to the background.")}
        >
          <ThemeField />
        </SectionHeader>
      );
    case "shell":
      return (
        <SectionHeader
          title={t("Shell")}
          subtitle={t("Override the program ShellBoard launches in new panels.")}
        >
          <ShellPathField />
          <ShellArgsField />
        </SectionHeader>
      );
    case "shortcuts":
      return (
        <SectionHeader
          title={t("Shortcuts")}
          subtitle={t("Click a shortcut to record a new combo. ⌫ resets it to the default; Esc cancels.")}
        >
          <ShortcutsList />
        </SectionHeader>
      );
    case "about":
      return <AboutPane />;
  }
}

function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className="settings-section__head">
        <h2 className="settings-section__title">{t(title)}</h2>
        <p className="settings-section__subtitle">{t(subtitle)}</p>
      </div>
      <div className="settings-section__body">{children}</div>
    </>
  );
}

// ── Field rows ────────────────────────────────────────────────────────────

type FieldRowProps = {
  label: string;
  hint?: ReactNode;
  align?: "center" | "top";
  children: ReactNode;
  section?: string;
};

function FieldRow({ label, hint, align = "center", children, section }: FieldRowProps) {
  const { t } = useI18n();
  return (
    <div
      className={
        "field-row" + (align === "top" ? " field-row--top" : "")
      }
    >
      <div className="field-row__text">
        {section && <span className="field-row__chip">{t(section)}</span>}
        <span className="field-row__label">{t(label)}</span>
        {hint && <p className="field-row__hint">{typeof hint === "string" ? t(hint) : hint}</p>}
      </div>
      <div className="field-row__control" role="group" aria-label={t(label)} data-tooltip={typeof hint === "string" ? t(hint) : t(label)}>{children}</div>
    </div>
  );
}

function FieldStack({
  label,
  hint,
  children,
  section,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  section?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="field-stack">
      {section && <span className="field-row__chip">{t(section)}</span>}
      <span className="field-stack__label">{t(label)}</span>
      {children}
      {hint && <p className="field-row__hint">{typeof hint === "string" ? t(hint) : hint}</p>}
    </div>
  );
}

// ── Control primitives ────────────────────────────────────────────────────

type SelectInputProps = {
  value: string;
  onChange: (next: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
  width?: number;
  mono?: boolean;
  id?: string;
};

function SelectInput({
  value,
  onChange,
  options,
  width,
  mono,
  id,
}: SelectInputProps) {
  const { t } = useI18n();
  return (
    <div
      className="sb-surface sb-select"
      style={width ? { width } : undefined}
    >
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "sb-select__native sb-select__native--mono" : "sb-select__native"}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {t(o.label)}
          </option>
        ))}
      </select>
      <span className="sb-select__chevron" aria-hidden>
        ▾
      </span>
    </div>
  );
}

type StepperProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (next: number) => void;
  width?: number;
  id?: string;
};

function Stepper({
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  width = 96,
  id,
}: StepperProps) {
  const { t } = useI18n();
  function clamp(n: number) {
    if (Number.isNaN(n)) return value;
    return Math.max(min, Math.min(max, n));
  }
  return (
    <div className="sb-surface sb-stepper" style={{ width }}>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        className="sb-stepper__input"
      />
      {suffix && <span className="sb-stepper__suffix">{suffix}</span>}
      <span className="sb-stepper__chevrons" aria-hidden>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value + step))}
          aria-label={t("Increase")}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path
              d="M1 4L4 1L7 4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onChange(clamp(value - step))}
          aria-label={t("Decrease")}
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none">
            <path
              d="M1 1L4 4L7 1"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </span>
    </div>
  );
}

type TextInputProps = {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  mono?: boolean;
  id?: string;
  fullWidth?: boolean;
  style?: CSSProperties;
};

function TextInput({
  value,
  placeholder,
  onChange,
  mono,
  id,
  fullWidth,
  style,
}: TextInputProps) {
  return (
    <div
      className={
        "sb-surface sb-textinput" + (fullWidth ? " sb-textinput--full" : "")
      }
      style={style}
    >
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "sb-textinput__input sb-textinput__input--mono" : "sb-textinput__input"}
        spellCheck={false}
      />
    </div>
  );
}

function Toggle2({
  on,
  onChange,
  id,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={on}
      className={"sb-toggle" + (on ? " is-on" : "")}
      onClick={() => onChange(!on)}
    >
      <span className="sb-toggle__thumb" />
    </button>
  );
}

function PaletteStrip({ colors }: { colors: ReadonlyArray<string> }) {
  return (
    <div className="sb-palette">
      {colors.map((c, i) => (
        <span key={i} className="sb-palette__swatch" style={{ background: c }} />
      ))}
    </div>
  );
}

// ── Concrete fields ───────────────────────────────────────────────────────

function useSettings() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  return { settings, update: updateSettings } as const;
}

function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  void useAppStore.getState().updateSettings({ [key]: value } as Partial<Settings>);
}

function UiFontSizeField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("UI font size")}
      hint={`${t("Sidebar, tab bar, status bar.")} ${SETTINGS_LIMITS.uiFontSize.min}–${SETTINGS_LIMITS.uiFontSize.max} px.`}
      section={section}
    >
      <Stepper
        value={settings.uiFontSize}
        min={SETTINGS_LIMITS.uiFontSize.min}
        max={SETTINGS_LIMITS.uiFontSize.max}
        suffix="px"
        width={92}
        onChange={(n) => set("uiFontSize", n)}
      />
    </FieldRow>
  );
}

function LanguageField() {
  const { language, t } = useI18n();
  return <FieldRow label={t("Language")}><select className="sb-select__native" aria-label={t("Language")} value={language} onChange={(event) => { void useAppStore.getState().updateSettings({ language: event.target.value === "en" ? "en" : "zh-CN" }); }}><option value="zh-CN">简体中文</option><option value="en">{t("English")}</option></select></FieldRow>;
}

function CheckForUpdatesField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Check for updates on startup")}
      align="top"
      hint={t("Pings GitHub Releases at most once per day. A clickable badge appears in the status bar when a newer version exists.")}
      section={section}
    >
      <Toggle2
        on={settings.checkForUpdatesOnStartup}
        onChange={(v) => set("checkForUpdatesOnStartup", v)}
      />
    </FieldRow>
  );
}

function TerminalFontField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const isCustom = !FONT_PRESETS.some(
    (p) => p.value === settings.terminalFontFamily,
  );
  const selectValue = isCustom ? "__custom__" : settings.terminalFontFamily;
  const options = [
    ...FONT_PRESETS.map((p) => ({ value: p.value, label: p.label })),
    { value: "__custom__", label: "Custom…" },
  ];
  return (
    <>
      <FieldRow
        label={t("Font")}
        hint={t("Powerline-aware fonts (Meslo, FiraCode, Hack NF) render Starship glyphs correctly.")}
        section={section}
      >
        <SelectInput
          value={selectValue}
          options={options}
          width={240}
          mono
          onChange={(v) => {
            if (v === "__custom__") return;
            set("terminalFontFamily", v);
          }}
        />
      </FieldRow>
      {isCustom && (
        <FieldRow label={t("Custom font-family")} section={section}>
          <TextInput
            value={settings.terminalFontFamily}
            placeholder={t("e.g. \"Fira Code\", monospace")}
            mono
            onChange={(v) => set("terminalFontFamily", v)}
            style={{ width: 240 }}
          />
        </FieldRow>
      )}
    </>
  );
}

function TerminalFontSizeField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Font size")}
      hint={`${SETTINGS_LIMITS.terminalFontSize.min}–${SETTINGS_LIMITS.terminalFontSize.max} px.`}
      section={section}
    >
      <Stepper
        value={settings.terminalFontSize}
        min={SETTINGS_LIMITS.terminalFontSize.min}
        max={SETTINGS_LIMITS.terminalFontSize.max}
        suffix="px"
        width={92}
        onChange={(n) => set("terminalFontSize", n)}
      />
    </FieldRow>
  );
}

function ScrollbackField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Scrollback")}
      hint={`${SETTINGS_LIMITS.scrollback.min.toLocaleString()}–${SETTINGS_LIMITS.scrollback.max.toLocaleString()} ${t("lines. Larger buffers use more RAM.")}`}
      section={section}
    >
      <Stepper
        value={settings.scrollback}
        min={SETTINGS_LIMITS.scrollback.min}
        max={SETTINGS_LIMITS.scrollback.max}
        step={500}
        width={112}
        onChange={(n) => set("scrollback", n)}
      />
    </FieldRow>
  );
}

function PersistScrollbackField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Persist scrollback across restarts")}
      align="top"
      hint={t("Snapshots each terminal’s scrollback to buffers.json so restored sessions show prior output. Off keeps disk writes lighter and avoids retaining sensitive output between launches; existing snapshots are wiped when you turn it off.")}
      section={section}
    >
      <Toggle2
        on={settings.persistScrollback}
        onChange={(v) => set("persistScrollback", v)}
      />
    </FieldRow>
  );
}

function ShowPanelHeaderField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Show panel header")}
      align="top"
      hint={t("Thin header above each terminal split showing shell + cwd. Turn off for absolute-minimum chrome.")}
      section={section}
    >
      <Toggle2
        on={settings.showPanelHeader}
        onChange={(v) => set("showPanelHeader", v)}
      />
    </FieldRow>
  );
}

function ShowGroupCountField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Show group project count")}
      align="top"
      hint={t("Small badge next to each group header in the sidebar showing how many projects it contains.")}
      section={section}
    >
      <Toggle2
        on={settings.showGroupCount}
        onChange={(v) => set("showGroupCount", v)}
      />
    </FieldRow>
  );
}

function ConfirmCloseSplitTabField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Confirm before closing a split tab")}
      align="top"
      hint={t("Ask before closing a tab that contains multiple terminals (a split). Single-terminal tabs always close immediately.")}
      section={section}
    >
      <Toggle2
        on={settings.confirmCloseSplitTab}
        onChange={(v) => set("confirmCloseSplitTab", v)}
      />
    </FieldRow>
  );
}

function ConfirmBeforeQuittingField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Confirm before quitting")}
      align="top"
      hint={t("Ask for confirmation before the app quits (Cmd+Q or closing the window).")}
      section={section}
    >
      <Toggle2
        on={settings.confirmBeforeQuitting}
        onChange={(v) => set("confirmBeforeQuitting", v)}
      />
    </FieldRow>
  );
}

function TrackCwdField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Shell integration")}
      align="top"
      hint={t("Injects shell hooks (zsh, bash, fish, nushell): OSC 7 keeps the current directory in sync for session restore, OSC 133 marks prompts and command exits — powering prompt jumping (⌘↑/⌘↓), the failed-command tab dot, and long-command notifications. Affects newly-spawned terminals only.")}
      section={section}
    >
      <Toggle2
        on={settings.autoCwdTracking}
        onChange={(v) => set("autoCwdTracking", v)}
      />
    </FieldRow>
  );
}

function NotifyLongCommandsField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldRow
      label={t("Notify when long commands finish")}
      align="top"
      hint={t("OS notification when a command that ran ≥ 5 s finishes on an inactive tab or while the window is unfocused. Requires shell integration.")}
      section={section}
    >
      <Toggle2
        on={settings.notifyLongCommands}
        onChange={(v) => set("notifyLongCommands", v)}
      />
    </FieldRow>
  );
}

function ThemeField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const theme = findTheme(settings.terminalTheme).theme;
  const swatches = useMemo(
    () =>
      [
        theme.background,
        theme.foreground,
        theme.red,
        theme.green,
        theme.yellow,
        theme.blue,
        theme.magenta,
        theme.cyan,
        theme.white,
      ].filter(Boolean) as string[],
    [theme],
  );
  return (
    <FieldRow
      label={t("Theme")}
      align="top"
      hint={t("Chrome auto-aligns to the terminal background.")}
      section={section}
    >
      <div className="settings-theme-control">
        <SelectInput
          value={settings.terminalTheme}
          options={THEMES.map((t) => ({ value: t.id, label: t.name }))}
          width={220}
          onChange={(v) => set("terminalTheme", v)}
        />
        <PaletteStrip
          colors={swatches.length ? swatches : SHELLBOARD_PALETTE}
        />
      </div>
    </FieldRow>
  );
}

function ShellPathField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldStack label={t("Shell path")} section={section}>
      <TextInput
        value={settings.shellPath}
        placeholder={t("Default: $SHELL")}
        mono
        fullWidth
        onChange={(v) => set("shellPath", v)}
      />
    </FieldStack>
  );
}

function ShellArgsField({ section }: { section?: string } = {}) {
  const { t } = useI18n();
  const { settings } = useSettings();
  return (
    <FieldStack
      label={t("Shell arguments")}
      section={section}
      hint={
        <>
          {t("Leave both fields empty for automatic handling. When you set your own arguments, ShellBoard stops adding")}<code>-l</code> {t("automatically — provide it yourself if you want a login shell. Affects newly-spawned terminals only.")}</>
      }
    >
      <TextInput
        value={settings.shellArgs}
        placeholder={t("Default: auto (-l for POSIX shells)")}
        mono
        fullWidth
        onChange={(v) => set("shellArgs", v)}
      />
    </FieldStack>
  );
}

function ShortcutsList() {
  const { t } = useI18n();
  const keybindings = useAppStore((s) => s.settings.keybindings);
  const resolved = useMemo(() => resolveBindings(keybindings), [keybindings]);

  // Group bindings by their stable key to flag combos shared by 2+ actions.
  const conflicts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const action of SHORTCUT_ACTIONS) {
      const k = bindingKey(resolved[action.id]);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    return counts;
  }, [resolved]);

  function setBinding(id: string, next: Binding) {
    void useAppStore.getState().updateSettings({
      keybindings: { ...keybindings, [id]: next },
    });
  }

  function resetBinding(id: string) {
    const next = { ...keybindings };
    delete next[id];
    void useAppStore.getState().updateSettings({ keybindings: next });
  }

  return (
    <div className="shortcuts-edit">
      {SHORTCUT_CATEGORIES.map((category) => {
        const actions = SHORTCUT_ACTIONS.filter((a) => a.category === category);
        if (actions.length === 0) return null;
        return (
          <div key={category} className="shortcuts-edit__group">
            <h3 className="shortcuts-edit__heading">{category}</h3>
            {actions.map((action) => {
              const binding = resolved[action.id];
              const overridden =
                bindingKey(binding) !== bindingKey(DEFAULT_BINDINGS[action.id]);
              const conflict = (conflicts.get(bindingKey(binding)) ?? 0) > 1;
              return (
                <FieldRow
                  key={action.id}
                  label={action.label}
                  hint={conflict ? "Used by another action" : undefined}
                >
                  <ShortcutInput
                    value={binding}
                    overridden={overridden}
                    conflict={conflict}
                    onChange={(b) => setBinding(action.id, b)}
                    onReset={() => resetBinding(action.id)}
                  />
                </FieldRow>
              );
            })}
          </div>
        );
      })}
      <p className="shortcuts-edit__note">
        {t("Tab numbers (")}<kbd className="kbd">{t("Cmd/Ctrl+1…9")}</kbd>{t(") and the command palette alias (")}<kbd className="kbd">{t("Cmd/Ctrl+Shift+P")}</kbd>{t(") are fixed. Copy/paste and link-click live in the terminal itself.")}</p>
    </div>
  );
}

function AboutPane() {
  const { t } = useI18n();
  const [info, setInfo] = useState<{
    name: string;
    version: string;
    tauri: string;
  } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const [name, version, tauri] = await Promise.all([
          getName(),
          getVersion(),
          getTauriVersion(),
        ]);
        setInfo({ name, version, tauri });
      } catch {
        setInfo({ name: "Shellboard", version: "?", tauri: "?" });
      }
    })();
  }, []);

  return (
    <div className="about-pane">
      <img src="/logo.png" alt="" className="about-pane__logo" />
      <div className="about-pane__name">{info?.name ?? "Shellboard"}</div>
      <div className="about-pane__version">{t("Version")}{info?.version ?? "…"}</div>
      <p className="about-pane__tagline">
        {t("Cross-platform terminal with per-project tabs &amp; splits.")}</p>
      <p className="about-pane__meta">
        {t("Built with Tauri")}{info?.tauri ?? "…"} {t("· React · xterm.js · portable-pty")}</p>
      <div className="about-pane__links">
        <a
          href="https://github.com/petrhlozek/shellboard"
          target="_blank"
          rel="noreferrer"
        >
          {t("GitHub repo")}</a>
        <span className="about-pane__sep">·</span>
        <a
          href="https://github.com/petrhlozek/shellboard/blob/main/CHANGELOG.md"
          target="_blank"
          rel="noreferrer"
        >
          {t("Changelog")}</a>
        <span className="about-pane__sep">·</span>
        <a
          href="https://github.com/petrhlozek/shellboard/issues/new"
          target="_blank"
          rel="noreferrer"
        >
          {t("Report an issue")}</a>
      </div>
    </div>
  );
}

// ── Search ────────────────────────────────────────────────────────────────

type SearchEntry = {
  id: string;
  section: SectionId;
  sectionLabel: string;
  label: string;
  keywords: string;
  render: (chipLabel: string) => ReactNode;
};

const SEARCH_INDEX: ReadonlyArray<SearchEntry> = [
  {
    id: "ui-font-size",
    section: "general",
    sectionLabel: "General",
    label: "UI font size",
    keywords: "sidebar tab bar status bar font ui size",
    render: (s) => <UiFontSizeField section={s} />,
  },
  {
    id: "check-updates",
    section: "general",
    sectionLabel: "General",
    label: "Check for updates on startup",
    keywords: "updates github releases version",
    render: (s) => <CheckForUpdatesField section={s} />,
  },
  {
    id: "group-count",
    section: "general",
    sectionLabel: "General",
    label: "Show group project count",
    keywords: "sidebar group count badge projects number",
    render: (s) => <ShowGroupCountField section={s} />,
  },
  {
    id: "confirm-close-split",
    section: "general",
    sectionLabel: "General",
    label: "Confirm before closing a split tab",
    keywords: "confirm close tab split panels warn prompt accidental cmd w",
    render: (s) => <ConfirmCloseSplitTabField section={s} />,
  },
  {
    id: "confirm-quit",
    section: "general",
    sectionLabel: "General",
    label: "Confirm before quitting",
    keywords: "confirm quit exit close app window closing cmd q warn prompt accidental",
    render: (s) => <ConfirmBeforeQuittingField section={s} />,
  },
  {
    id: "term-font",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Font",
    keywords: "font family meslo fira jetbrains terminal",
    render: (s) => <TerminalFontField section={s} />,
  },
  {
    id: "term-font-size",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Font size",
    keywords: "terminal font size px",
    render: (s) => <TerminalFontSizeField section={s} />,
  },
  {
    id: "scrollback",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Scrollback",
    keywords: "scrollback buffer lines history",
    render: (s) => <ScrollbackField section={s} />,
  },
  {
    id: "persist-scrollback",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Persist scrollback across restarts",
    keywords: "persist scrollback buffers restore session",
    render: (s) => <PersistScrollbackField section={s} />,
  },
  {
    id: "panel-header",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Show panel header",
    keywords: "panel header shell cwd",
    render: (s) => <ShowPanelHeaderField section={s} />,
  },
  {
    id: "track-cwd",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Shell integration",
    keywords:
      "osc 7 133 cwd directory tracking shell integration hook zsh bash fish nushell prompt marks",
    render: (s) => <TrackCwdField section={s} />,
  },
  {
    id: "notify-long-commands",
    section: "terminal",
    sectionLabel: "Terminal",
    label: "Notify when long commands finish",
    keywords: "notification notify command finished exit osc 133 background",
    render: (s) => <NotifyLongCommandsField section={s} />,
  },
  {
    id: "theme",
    section: "appearance",
    sectionLabel: "Appearance",
    label: "Theme",
    keywords: "theme appearance palette colors shellboard dracula nord",
    render: (s) => <ThemeField section={s} />,
  },
  {
    id: "shell-path",
    section: "shell",
    sectionLabel: "Shell",
    label: "Shell path",
    keywords: "shell path zsh bash fish $SHELL program executable",
    render: (s) => <ShellPathField section={s} />,
  },
  {
    id: "shell-args",
    section: "shell",
    sectionLabel: "Shell",
    label: "Shell arguments",
    keywords: "shell arguments login -l flags",
    render: (s) => <ShellArgsField section={s} />,
  },
  {
    id: "keybindings",
    section: "shortcuts",
    sectionLabel: "Shortcuts",
    label: "Keyboard shortcuts",
    keywords:
      "shortcut shortcuts keybinding keybindings hotkey rebind key combo recent terminal switcher ctrl tab",
    render: () => (
      <FieldRow label="Keyboard shortcuts" hint="Rebind any action — click the section chip to open.">
        <span />
      </FieldRow>
    ),
  },
];

function SearchResults({
  query,
  onJump,
}: {
  query: string;
  onJump: (id: SectionId) => void;
}) {
  const { t } = useI18n();
  const q = query.trim().toLowerCase();
  const hits = SEARCH_INDEX.filter(
    (e) =>
      t(e.label).toLowerCase().includes(q) ||
      e.label.toLowerCase().includes(q) ||
      e.keywords.includes(q) ||
      t(e.sectionLabel).toLowerCase().includes(q),
  );
  return (
    <>
      <div className="settings-section__head">
        <h2 className="settings-section__title">
          {hits.length
            ? `${hits.length} result${hits.length === 1 ? "" : "s"}`
            : "No matches"}
        </h2>
        <p className="settings-section__subtitle">
          {hits.length
            ? "Click a section chip to jump back into the rail."
            : `Nothing in settings matches “${query}”.`}
        </p>
      </div>
      <div className="settings-section__body">
        {hits.map((h) => (
          <div key={h.id} className="search-result">
            <button
              type="button"
              className="search-result__chip"
              onClick={() => onJump(h.section)}
            >
              {t(h.sectionLabel)}
            </button>
            {h.render(h.sectionLabel)}
          </div>
        ))}
      </div>
    </>
  );
}
