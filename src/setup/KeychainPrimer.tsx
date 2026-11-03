import { useEffect, useId, useRef, type Ref } from "react";
import type { LangCode } from "../i18n";
import type { DesktopPlatform } from "../platform/platformCopy";
import { setupCopyFor } from "./setupContent";

export type KeychainPrimerProps = {
  uiLang: LangCode;
  presentation?: "embedded" | "modal";
  copyVariant?: "detailed" | "onboarding";
  onContinue: () => void;
  onCancel?: () => void;
  returnFocusTo?: HTMLElement | null;
  fallbackFocusTo?: HTMLElement | null;
  headingRef?: Ref<HTMLHeadingElement>;
  showEmbeddedAction?: boolean;
  platform?: DesktopPlatform;
};

export function KeychainPrimer({
  uiLang,
  presentation = "embedded",
  copyVariant = "detailed",
  onContinue,
  onCancel,
  returnFocusTo,
  fallbackFocusTo,
  headingRef,
  showEmbeddedAction = true,
  platform = "macos",
}: KeychainPrimerProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const copy = setupCopyFor(uiLang, platform);
  const body = copyVariant === "onboarding"
    ? copy.onboardingKeychain.body
    : copy.screens.keychain.body;
  const bullets = copyVariant === "onboarding"
    ? [
        copy.keychainBullets.directHttps,
        copy.keychainBullets.systemPrompt,
        copy.onboardingKeychain.sensitiveInformationWarning,
      ]
    : Object.values(copy.keychainBullets);

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    if (presentation !== "modal") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = returnFocusTo?.isConnected
      ? returnFocusTo
      : document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const fallbackFocus = fallbackFocusTo ?? null;
    const focusFrame = window.requestAnimationFrame(() => {
      (primaryActionRef.current ?? dialog).focus();
    });

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancelRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.tabIndex >= 0);
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
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
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      const canReceiveFocus = (element: HTMLElement | null): element is HTMLElement => {
        if (!element?.isConnected || element.closest("[inert]")) return false;
        if ((element as HTMLElement & { disabled?: boolean }).disabled) return false;
        return element.tabIndex >= 0;
      };
      const restoreTarget = canReceiveFocus(previousFocus)
        ? previousFocus
        : canReceiveFocus(fallbackFocus)
          ? fallbackFocus
          : null;
      restoreTarget?.focus();
    };
  }, [presentation]);

  const content = (
    <section
      ref={dialogRef}
      className={
        presentation === "modal"
          ? "keychain-primer max-h-[calc(100dvh-2.5rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/15 bg-neutral-950 p-7 text-white shadow-2xl md:p-9"
          : "keychain-primer w-full"
      }
      role={presentation === "modal" ? "dialog" : undefined}
      aria-modal={presentation === "modal" ? "true" : undefined}
      aria-labelledby={titleId}
      tabIndex={presentation === "modal" ? -1 : undefined}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {presentation === "modal" ? (
        <h2 id={titleId} className="text-2xl font-semibold tracking-tight md:text-3xl">
          {copy.screens.keychain.title}
        </h2>
      ) : (
        <h1
          ref={headingRef}
          id={titleId}
          tabIndex={-1}
          className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl"
        >
          {copy.screens.keychain.title}
        </h1>
      )}
      <p className="mt-4 max-w-2xl text-base leading-7 text-white/65">
        {body}
      </p>
      <ul className="mt-6 grid gap-3 text-sm leading-6 text-white/75" role="list">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex gap-3">
            <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/60" />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
      {presentation === "modal" || showEmbeddedAction ? (
        <div className="mt-8 flex flex-wrap justify-end gap-3">
          {presentation === "modal" ? (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm text-white/75"
            >
              {copy.buttons.cancel}
            </button>
          ) : null}
          <button
            ref={primaryActionRef}
            type="button"
            onClick={onContinue}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
          >
            {copy.buttons.continue}
          </button>
        </div>
      ) : null}
    </section>
  );

  if (presentation === "embedded") return content;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-5 backdrop-blur-sm"
      onMouseDown={(event) => event.stopPropagation()}
    >
      {content}
    </div>
  );
}
