import { useI18n } from "../i18n";
import { useEffect, useState } from "react";
import { useAppStore, type Snippet } from "../store/appStore";
import { Modal } from "./Modal";
import "./SnippetsDialog.css";

type SnippetsDialogProps = {
  projectId: string | null;
  onClose: () => void;
};

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `snip-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

export function SnippetsDialog({ projectId, onClose }: SnippetsDialogProps) {
  const { t } = useI18n();
  const project = useAppStore((s) =>
    projectId ? s.projects.find((p) => p.id === projectId) : undefined,
  );
  const setProjectSnippets = useAppStore((s) => s.setProjectSnippets);
  const runSnippet = useAppStore((s) => s.runSnippet);

  const [drafts, setDrafts] = useState<Snippet[]>([]);

  useEffect(() => {
    if (project) {
      setDrafts(project.snippets ?? []);
    }
  }, [project?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return null;

  function commit(next: Snippet[]) {
    setDrafts(next);
    void setProjectSnippets(project!.id, next);
  }

  function addSnippet() {
    commit([
      ...drafts,
      { id: uuid(), name: "", command: "", runAfterPaste: true },
    ]);
  }
  function updateSnippet(id: string, patch: Partial<Snippet>) {
    commit(drafts.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeSnippet(id: string) {
    commit(drafts.filter((s) => s.id !== id));
  }

  return (
    <Modal
      open={!!projectId}
      onClose={onClose}
      title={`${t("Preset commands")} · ${project.name}`}
      maxWidth={540}
    >
      <div className="snippets">
        {drafts.length === 0 && (
          <div className="snippets__empty">
            {t("No snippets yet. Quick commands you run often — they paste into the active terminal on click.")}</div>
        )}
        <div className="snippets__list">
          {drafts.map((s) => (
            <div key={s.id} className="snippets__row">
              <input
                className="snippets__name"
                placeholder={t("Name")}
                value={s.name}
                onChange={(e) => updateSnippet(s.id, { name: e.target.value })}
              />
              <input
                className="snippets__command"
                placeholder={t("command --arg")}
                value={s.command}
                onChange={(e) =>
                  updateSnippet(s.id, { command: e.target.value })
                }
              />
              <label
                className="snippets__toggle"
                data-tooltip={t("Send Enter after inserting, so the command runs immediately")}
              >
                <input
                  type="checkbox"
                  checked={s.runAfterPaste !== false}
                  onChange={(e) =>
                    updateSnippet(s.id, { runAfterPaste: e.target.checked })
                  }
                />
                {t("Run")}</label>
              <button
                type="button"
                className="snippets__run"
                data-tooltip={t("Run in active terminal")}
                disabled={!s.command.trim()}
                onClick={() => void runSnippet(project.id, s.id)}
              >
                {t("Run")}</button>
              <button
                type="button"
                className="snippets__remove"
                data-tooltip={t("Remove")}
                onClick={() => removeSnippet(s.id)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="snippets__actions">
          <button
            type="button"
            className="snippets__add"
            onClick={addSnippet}
          >
            {t("+ Add snippet")}</button>
          <button type="button" className="snippets__done" onClick={onClose}>
            {t("Done")}</button>
        </div>
      </div>
    </Modal>
  );
}
