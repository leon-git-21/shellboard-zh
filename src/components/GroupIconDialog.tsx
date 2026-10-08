import { useI18n } from "../i18n";
import { useEffect, useRef, useState } from "react";
import "./GroupIconDialog.css";

type GroupIconDialogProps = {
  open: boolean;
  initialIcon?: string;
  groupName: string;
  onSave: (icon: string | null) => void;
  onClose: () => void;
};

export function GroupIconDialog({
  open,
  initialIcon,
  groupName,
  onSave,
  onClose,
}: GroupIconDialogProps) {
  const { t } = useI18n();
  const [value, setValue] = useState(initialIcon ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setValue(initialIcon ?? "");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open, initialIcon]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () => {
      window.removeEventListener("keydown", onKey, { capture: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  function commit() {
    onSave(value.trim() || null);
    onClose();
  }

  function clear() {
    onSave(null);
    onClose();
  }

  return (
    <div className="group-icon-backdrop" onMouseDown={onClose}>
      <div
        className="group-icon-dialog"
        role="dialog"
        aria-label={t("Group icon")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="group-icon-dialog__title">{t("Icon for “")}{groupName}”</div>
        <div className="group-icon-dialog__body">
          <div className="group-icon-dialog__preview" aria-hidden>
            {value || "·"}
          </div>
          <input
            ref={inputRef}
            type="text"
            className="group-icon-dialog__input"
            value={value}
            placeholder={t("Paste or type any emoji…")}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
          />
        </div>
        <div className="group-icon-dialog__actions">
          <button
            type="button"
            className="group-icon-dialog__btn group-icon-dialog__btn--ghost"
            onClick={clear}
          >
            {t("Clear")}</button>
          <span className="group-icon-dialog__spacer" />
          <button
            type="button"
            className="group-icon-dialog__btn group-icon-dialog__btn--ghost"
            onClick={onClose}
          >
            {t("Cancel")}</button>
          <button
            type="button"
            className="group-icon-dialog__btn group-icon-dialog__btn--primary"
            onClick={commit}
          >
            {t("Save")}</button>
        </div>
      </div>
    </div>
  );
}
