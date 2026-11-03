import { useEffect, useId, useRef } from "react";
import type { LangCode } from "./i18n";
import type { SessionProvider } from "./providerConnection";
import {
  formatProviderCopy,
  providerConnectionCopyFor,
} from "./providerConnectionContent";

export type ProviderConnectionRiskModalProps = {
  open: boolean;
  provider: SessionProvider | null;
  uiLang: LangCode;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
};

export function ProviderConnectionRiskModal({
  open,
  provider,
  uiLang,
  onConfirm,
  onCancel,
  returnFocusTo,
}: ProviderConnectionRiskModalProps) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = returnFocusTo?.isConnected
      ? returnFocusTo
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);
      if (focusable.length === 0) {
        event.preventDefault();
        headingRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown, true);
      if (previousFocus?.isConnected && !previousFocus.closest("[inert]")) {
        previousFocus.focus();
      }
    };
  }, [open, returnFocusTo]);

  if (!open || !provider) return null;
  const copy = providerConnectionCopyFor(uiLang);

  return (
    <div
      className="provider-risk-backdrop"
      data-testid="provider-risk-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="provider-risk-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="provider-risk-badge">{copy.unofficial}</span>
        <h2 ref={headingRef} id={titleId} tabIndex={-1} className="provider-risk-title">
          {formatProviderCopy(copy.riskTitle, provider)}
        </h2>
        <p id={bodyId} className="provider-risk-body">
          {formatProviderCopy(copy.riskBody, provider)}
        </p>
        <div className="provider-risk-actions">
          <button type="button" className="provider-risk-cancel" onClick={onCancel}>
            {copy.cancel}
          </button>
          <button type="button" className="provider-risk-confirm" onClick={onConfirm}>
            {copy.understandAndConnect}
          </button>
        </div>
      </div>
    </div>
  );
}
