import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import type { ReactNode, Ref } from "react";
import type { ValidationStatus } from "./secretClient";
import type { SetupCopy, SetupGuideId } from "./setupContent";
import { SetupGuide } from "./SetupGuide";

export type CredentialProviderOption<T extends string> = {
  id: T;
  label: string;
  selectedBackground?: string;
};

export function CredentialSetupStep<T extends string>({
  headingRef,
  title,
  body,
  description,
  providers,
  selectedProvider,
  onSelectProvider,
  beforeProviders,
  primaryCredentialAction,
  manualCredentialDisclosure,
  guideId,
  guideControls,
  beforeCredential,
  credentialLabel,
  credentialValue,
  onCredentialChange,
  validationStatus,
  savedAnyway,
  saveFailed,
  isSaved,
  busy,
  onValidate,
  onSaveAnyway,
  copy,
}: {
  headingRef?: Ref<HTMLHeadingElement>;
  title: string;
  body: string;
  description: string;
  providers: readonly CredentialProviderOption<T>[];
  selectedProvider: T;
  onSelectProvider: (provider: T) => void;
  beforeProviders?: ReactNode;
  primaryCredentialAction?: ReactNode;
  manualCredentialDisclosure?: { label: string; defaultOpen?: boolean };
  guideId: SetupGuideId;
  guideControls?: ReactNode;
  beforeCredential?: ReactNode;
  credentialLabel: string;
  credentialValue: string;
  onCredentialChange: (value: string) => void;
  validationStatus: ValidationStatus | null;
  savedAnyway: boolean;
  saveFailed: boolean;
  isSaved: boolean;
  busy: boolean;
  onValidate: () => void;
  onSaveAnyway: () => void;
  copy: SetupCopy;
}) {
  const statusState = saveFailed
    ? "save-failed"
    : savedAnyway
      ? "saved"
      : validationStatus ?? (isSaved ? "saved" : "idle");

  const manualContent = (
    <>
      {guideControls}
      <SetupGuide guideId={guideId} copy={copy} />

      {beforeCredential}
      <div className="mt-6 rounded-2xl border border-white/10 p-5">
        <label className="block text-sm font-medium text-white" htmlFor="setup-credential">
          {credentialLabel}
        </label>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="setup-credential"
            type="password"
            autoComplete="off"
            value={credentialValue}
            disabled={busy}
            onChange={(event) => onCredentialChange(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-white/35 disabled:opacity-60"
          />
          <button
            type="button"
            disabled={busy || !credentialValue.trim()}
            onClick={onValidate}
            className="rounded-xl bg-white px-5 py-3 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {copy.buttons.validate}
          </button>
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
          role="status"
          data-status={statusState}
          className="setup-status-region mt-3 min-h-6 text-sm leading-6"
        >
          {saveFailed ? (
            <>
              <p className="setup-status-message text-amber-300">
                <CircleAlert data-status-icon="save-failed" aria-hidden="true" size={16} />
                <span>{copy.validation.cancelled}</span>
              </p>
              <p className="text-white/60">{copy.validation.retry}</p>
            </>
          ) : savedAnyway ? (
            <p className="setup-status-message text-emerald-300">
              <CheckCircle2 data-status-icon="saved" aria-hidden="true" size={16} />
              <span>{copy.validation.saved}</span>
            </p>
          ) : validationStatus === "valid" ? (
            <p className="setup-status-message text-emerald-300">
              <CheckCircle2 data-status-icon="valid" aria-hidden="true" size={16} />
              <span>{copy.validation.valid}</span>
            </p>
          ) : validationStatus === "invalid" ? (
            <p className="setup-status-message text-rose-300">
              <XCircle data-status-icon="invalid" aria-hidden="true" size={16} />
              <span>{copy.validation.invalid}</span>
            </p>
          ) : validationStatus === "unavailable" ? (
            <>
              <p className="setup-status-message text-amber-300">
                <CircleAlert data-status-icon="unavailable" aria-hidden="true" size={16} />
                <span>{copy.validation.unavailable}</span>
              </p>
              <p className="text-white/60">{copy.validation.saveAnyway}</p>
            </>
          ) : isSaved ? (
            <p className="setup-status-message text-emerald-300">
              <CheckCircle2 data-status-icon="saved" aria-hidden="true" size={16} />
              <span>{copy.reviewLabels.ready}</span>
            </p>
          ) : null}
        </div>

        {validationStatus === "unavailable" && !savedAnyway && !saveFailed ? (
          <button
            type="button"
            disabled={busy}
            onClick={onSaveAnyway}
            className="mt-3 rounded-xl border border-white/15 px-4 py-2.5 text-sm text-white disabled:opacity-40"
          >
            {copy.buttons.saveAnyway}
          </button>
        ) : null}
      </div>
    </>
  );

  return (
    <div>
      <h1 ref={headingRef} tabIndex={-1} className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="setup-step-body">{body}</p>
      {beforeProviders}
      <p className="mt-2 text-sm text-white/50">{description}</p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {providers.map(({ id, label, selectedBackground }) => (
          <button
            key={id}
            type="button"
            disabled={busy}
            aria-pressed={selectedProvider === id}
            onClick={() => onSelectProvider(id)}
            style={
              selectedProvider === id && selectedBackground
                ? { backgroundColor: selectedBackground }
                : undefined
            }
            className={`rounded-2xl border px-5 py-4 text-left text-sm transition-colors ${
              selectedProvider === id
                ? selectedBackground
                  ? "border-white text-white"
                  : "border-white bg-white text-black"
                : "border-white/10 bg-white/5 text-white/75"
            }`}
          >
            <span>{label}</span>
          </button>
        ))}
      </div>

      {primaryCredentialAction}
      {manualCredentialDisclosure ? (
        <details className="credential-advanced" open={manualCredentialDisclosure.defaultOpen || undefined}>
          <summary className="credential-advanced-summary">
            {manualCredentialDisclosure.label}
          </summary>
          <div className="credential-advanced-content">{manualContent}</div>
        </details>
      ) : manualContent}
    </div>
  );
}
