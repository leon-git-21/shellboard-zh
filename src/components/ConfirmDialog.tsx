import { useEffect, useRef } from "react";
import { Modal } from "./Modal";
import "./ConfirmDialog.css";
import { useI18n } from "../i18n";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useI18n();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe (Cancel) button when the dialog opens, so a reflexive
  // Enter or Space keeps the tab. Escape and click-outside also cancel
  // (handled by Modal via onClose).
  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth={400}>
      <div className="confirm-dialog">
        <p className="confirm-dialog__message">{t(message)}</p>
        <div className="confirm-dialog__actions">
          <button
            ref={cancelRef}
            type="button"
            className="confirm-dialog__btn confirm-dialog__btn--cancel"
            onClick={onCancel}
          >
            {t(cancelLabel)}
          </button>
          <button
            type="button"
            className={
              "confirm-dialog__btn confirm-dialog__btn--confirm" +
              (destructive ? " is-destructive" : "")
            }
            onClick={onConfirm}
          >
            {t(confirmLabel)}
          </button>
        </div>
      </div>
    </Modal>
  );
}
