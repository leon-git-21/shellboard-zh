import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "../i18n";
import "./TooltipLayer.css";

export function TooltipLayer() {
  const { t } = useI18n();
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const hide = () => { if (timer.current) clearTimeout(timer.current); setTarget(null); };
    const show = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-tooltip]") : null;
      if (!element || (event instanceof MouseEvent && event.relatedTarget instanceof Node && element.contains(event.relatedTarget))) return;
      hide(); timer.current = setTimeout(() => setTarget(element), 300);
    };
    const leave = (event: Event) => {
      const element = event.target instanceof Element ? event.target.closest("[data-tooltip]") : null;
      if (event instanceof MouseEvent && event.relatedTarget instanceof Node && element?.contains(event.relatedTarget)) return;
      hide();
    };
    document.addEventListener("pointerover", show); document.addEventListener("focusin", show);
    document.addEventListener("pointerout", leave); document.addEventListener("focusout", hide);
    document.addEventListener("pointerdown", hide); document.addEventListener("keydown", hide); window.addEventListener("scroll", hide, true);
    return () => {
      hide(); document.removeEventListener("pointerover", show); document.removeEventListener("focusin", show);
      document.removeEventListener("pointerout", leave); document.removeEventListener("focusout", hide);
      document.removeEventListener("pointerdown", hide); document.removeEventListener("keydown", hide); window.removeEventListener("scroll", hide, true);
    };
  }, []);
  if (!target?.isConnected || !target.dataset.tooltip) return null;
  const rect = target.getBoundingClientRect();
  const below = rect.top < 48;
  const left = Math.max(130, Math.min(window.innerWidth - 130, rect.left + rect.width / 2));
  return createPortal(<div role="tooltip" className={`app-tooltip ${below ? "below" : ""}`} style={{ left, top: below ? rect.bottom + 8 : rect.top - 8 }}>{t(target.dataset.tooltip)}</div>, document.body);
}
