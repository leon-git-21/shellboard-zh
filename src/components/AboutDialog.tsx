import { useI18n } from "../i18n";
import { useEffect, useState } from "react";
import { getName, getVersion, getTauriVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Modal } from "./Modal";
import "./AboutDialog.css";

const WEBSITE_URL = "https://calmbit.cz/en/shellboard";

type AboutDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function AboutDialog({ open, onClose }: AboutDialogProps) {
  const { t } = useI18n();
  const [info, setInfo] = useState<{
    name: string;
    version: string;
    tauri: string;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} maxWidth={400}>
      <div className="about">
        <img src="/logo.png" alt="Shellboard logo" className="about__logo" />
        <div className="about__name">{info?.name ?? "Shellboard"}</div>
        <div className="about__version">
          {t("Version")}{info?.version ?? "…"}
        </div>
        <div className="about__tagline">
          {t("Cross-platform terminal with per-project tabs & splits.")}</div>
        <div className="about__meta">
          {t("Built with Tauri")}{info?.tauri ?? "…"} {t("· React · xterm.js · portable-pty")}</div>
        <a
          className="about__link"
          href={WEBSITE_URL}
          onClick={(e) => {
            e.preventDefault();
            void openUrl(WEBSITE_URL).catch(() => {});
          }}
        >
          {t("calmbit.cz/en/shellboard")}</a>
        <button
          type="button"
          className="about__close"
          onClick={onClose}
        >
          {t("Close")}</button>
      </div>
    </Modal>
  );
}
