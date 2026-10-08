import { useState } from "react";
import { useAppStore } from "../store/appStore";
import { useI18n } from "../i18n";
import { Cog } from "./icons";
import "./CommandLauncher.css";

export function CommandLauncher({ projectId }: { projectId: string }) {
  const { t } = useI18n();
  const project = useAppStore((state) => state.projects.find((item) => item.id === projectId));
  const launchSnippet = useAppStore((state) => state.launchSnippet);
  const requestSnippetsDialog = useAppStore((state) => state.requestSnippetsDialog);
  const showError = useAppStore((state) => state.showError);
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const commands = project?.snippets ?? [];
  const selected = commands.find((command) => command.id === selectedId) ?? commands[0];

  async function run() {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await launchSnippet(projectId, selected.id);
    } catch (error) {
      showError(String(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="command-launcher" role="group" aria-label={t("Project commands")}>
      <select
        className="command-launcher__select"
        aria-label={t("Select a command")}
        value={selected?.id ?? ""}
        disabled={commands.length === 0 || busy}
        data-tooltip={selected?.command || t("No saved commands")}
        onChange={(event) => setSelectedId(event.target.value)}
      >
        {commands.length === 0
          ? <option value="">{t("No saved commands")}</option>
          : commands.map((command) => <option value={command.id} key={command.id}>{command.name || command.command}</option>)}
      </select>
      <button
        type="button"
        className="command-launcher__run"
        disabled={!selected?.command.trim() || busy}
        data-tooltip={t("Run selected command in a new project terminal")}
        aria-label={t("Run selected command in a new project terminal")}
        onClick={() => void run()}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5 13 8l-9 5.5z" fill="currentColor" /></svg>
        <span>{t(busy ? "Running…" : "Run")}</span>
      </button>
      <button
        type="button"
        className="command-launcher__manage"
        data-tooltip={t("Manage project commands")}
        aria-label={t("Manage project commands")}
        onClick={() => requestSnippetsDialog(projectId)}
      >
        <Cog size={16} />
      </button>
    </div>
  );
}
