import { aiProviderLabel } from "../aiProviderCopy";
import { getErrorPresentation } from "../appError";
import { Check, Circle, CircleDot } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ProviderConnectionRiskModal } from "../ProviderConnectionRiskModal";
import { dictionary, LANG_OPTIONS, mapNavigatorLanguage, type LangCode } from "../i18n";
import { initialTranslationLanguage, translationLanguageLabel } from "../translationLanguages";
import { TranslationLanguageSelect } from "../TranslationLanguageSelect";
import type {
  DesktopPlatform,
  SetupBrowser,
} from "../platform/platformCopy";
import { CLOUD_AI_MODEL_OPTIONS, CLI_DEFAULT_MODEL, getStoredTranslationConfig, isCloudAiProvider, type AiProvider } from "../settings";
import { AiConnectionPanel } from "../ai/AiConnectionPanel";
import { SetupServerConnection } from "../ai/SetupServerConnection";
import {
  connectionNeedsPolling,
} from "../providerConnection";
import {
  formatProviderCopy,
  providerConnectionCopyFor,
  connectionStatusMessage,
} from "../providerConnectionContent";
import { useProviderConnection } from "../useProviderConnection";
import { CredentialSetupStep } from "./CredentialSetupStep";
import { KeychainPrimer } from "./KeychainPrimer";
import {
  setupBrowsersFor,
  setupCopyFor,
  type SetupGuideId,
} from "./setupContent";
import {
  SETUP_STEPS,
  canCompleteSetup,
  nextSetupStep,
  previousSetupStep,
  type SetupStep,
} from "./setupState";
import { useSetupCredentials } from "./useSetupCredentials";

export type SetupWizardMode = "first-run" | "reentry";

export type SetupWizardProps = {
  mode: SetupWizardMode;
  primerAccepted: boolean;
  onPrimerAccepted: () => void;
  onComplete: () => void;
  onSkip: () => void;
  onClose?: () => void;
  platform?: DesktopPlatform;
};

const initialLanguage = (key: "uiLang"): LangCode => {
  try {
    const stored = localStorage.getItem(key) as LangCode | null;
    if (stored && LANG_OPTIONS.some(({ code }) => code === stored)) return stored;
  } catch {
    // Fall through to the browser language when storage is unavailable.
  }

  return mapNavigatorLanguage(
    typeof navigator === "undefined" ? undefined : navigator.language,
  );
};

export function SetupWizard({
  mode,
  primerAccepted,
  onPrimerAccepted,
  onComplete,
  onSkip,
  onClose,
  platform = "macos",
}: SetupWizardProps) {
  const [step, setStep] = useState<SetupStep>("welcome");
  const [uiLang, setUiLang] = useState<LangCode>(() => initialLanguage("uiLang"));
  const [targetLang, setTargetLang] = useState<string>(initialTranslationLanguage);
  const [browser, setBrowser] = useState<SetupBrowser>("chrome");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const detailContentRef = useRef<HTMLDivElement>(null);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const credentials = useSetupCredentials({ primerAccepted, step });
  const {
    secretStatusError,
    lyricsSource,
    selectLyricsSource,
    aiProvider,
    selectAiProvider,
    aiModel,
    selectAiModel,
    lyricsCredential,
    aiCredential,
    lyricsSaved,
    aiSaved: apiAiSaved,
    isLyricsSecretSaved,
    isAiSecretSaved,
    setLyricsCredentialValue,
    setAiCredentialValue,
    validateLyrics,
    validateAi,
    saveLyricsAnyway,
    saveAiAnyway,
    confirmAiConfig,
    refreshSecretStatus,
    cancelOperations,
  } = credentials;
  const handleProviderConnected = useCallback(async () => {
    await refreshSecretStatus();
  }, [refreshSecretStatus]);
  const providerConnection = useProviderConnection({
    language: uiLang,
    onConnected: handleProviderConnected,
  });
  const copy = setupCopyFor(uiLang, platform);
  const connectionCopy = providerConnectionCopyFor(uiLang);
  const browserOptions = setupBrowsersFor(platform);
  const stepIndex = SETUP_STEPS.indexOf(step);
  const isFirstStep = step === SETUP_STEPS[0];
  const isReview = step === SETUP_STEPS[SETUP_STEPS.length - 1];
  const automaticConnectionBusy = providerConnection.isStarting ||
    providerConnection.riskModalOpen ||
    Boolean(providerConnection.status && connectionNeedsPolling(providerConnection.status.phase));
  const credentialBusy = step === "lyrics"
    ? lyricsCredential.busy || automaticConnectionBusy
    : step === "ai"
      ? aiCredential.busy
      : false;

  useEffect(() => {
    try {
      localStorage.setItem("uiLang", uiLang);
    } catch {
      // The wizard remains usable when storage is unavailable.
    }
  }, [uiLang]);

  useEffect(() => {
    try {
      localStorage.setItem("targetLang", targetLang);
    } catch {
      // The wizard remains usable when storage is unavailable.
    }
  }, [targetLang]);

  useLayoutEffect(() => {
    if (detailContentRef.current) detailContentRef.current.scrollTop = 0;
    headingRef.current?.focus({ preventScroll: true });
  }, [step]);

  const handleSkip = () => {
    cancelOperations();
    void providerConnection.cancelConnection();
    if (mode === "reentry") {
      onClose?.();
      return;
    }
    onSkip();
  };

  const [connectionProvider, setConnectionProvider] = useState<AiProvider>(() => getStoredTranslationConfig().provider);
  const [connectionReady, setConnectionReady] = useState(false);
  const aiSaved = isCloudAiProvider(connectionProvider) ? connectionProvider === aiProvider && apiAiSaved : connectionReady;
  const selectConnectionProvider = (provider: AiProvider) => {
    setConnectionProvider(provider); setConnectionReady(false);
    if (isCloudAiProvider(provider)) selectAiProvider(provider);
  };
  const setupComplete = canCompleteSetup({ lyricsSaved, aiSaved, targetLang });

  const handleContinue = () => {
    if (step === "lyrics" && !lyricsSaved) return;
    if (step === "ai") {
      if (!aiSaved) return;
      if (isCloudAiProvider(connectionProvider)) confirmAiConfig();
    }
    if (isReview) {
      if (setupComplete) onComplete();
      return;
    }
    if (step === "keychain" && !primerAccepted) onPrimerAccepted();
    setStep((current) => nextSetupStep(current));
  };

  const lyricsGuideId = `${lyricsSource === "spotify" ? "spotify" : "appleMusic"}${
    browser === "chrome" ? "Chrome" : "Safari"
  }` as SetupGuideId;
  const aiGuideId: SetupGuideId = aiProvider === "gemini" ? "geminiApiKey"
    : aiProvider === "openai" ? "openAiApiKey" : "claudeApiKey";
  const selectedModel = CLOUD_AI_MODEL_OPTIONS[aiProvider].find(({ id }) => id === aiModel);
  const targetLanguageLabel = translationLanguageLabel(targetLang).nativeName;
  const connectionMessage = connectionStatusMessage(providerConnection.status, connectionCopy);
  const connectionActionLabel = providerConnection.status?.phase === "timed_out" ||
    providerConnection.status?.phase === "recoverable_error" ||
    providerConnection.status?.phase === "terminal_error"
    ? connectionCopy.retry
    : isLyricsSecretSaved || providerConnection.status?.phase === "connected"
      ? connectionCopy.reconnect
      : formatProviderCopy(connectionCopy.connect, lyricsSource);

  const handleSelectLyricsSource = (source: typeof lyricsSource) => {
    if (source === lyricsSource) return;
    void providerConnection.cancelConnection();
    selectLyricsSource(source);
  };

  return (
    <main className="setup-wizard min-h-screen bg-neutral-950 px-6 py-10 text-white">
      <div
        data-tauri-drag-region
        aria-hidden="true"
        className="setup-wizard-titlebar-drag-region"
      />
      <div className="setup-wizard-shell mx-auto grid w-full max-w-5xl gap-8 md:grid-cols-[15rem_1fr]">
        <aside
          aria-label={copy.accessibility.progressLabel}
          className="setup-wizard-rail p-5"
          data-fixed-region="progress"
        >
          <div className="setup-wizard-brand">SongDocent</div>
          <ol className="setup-progress-list">
            {SETUP_STEPS.map((setupStep, index) => {
              const progressState = index < stepIndex
                ? "completed"
                : setupStep === step
                  ? "current"
                  : "upcoming";
              const ProgressIcon = progressState === "completed"
                ? Check
                : progressState === "current"
                  ? CircleDot
                  : Circle;
              return (
                <li
                  key={setupStep}
                  aria-current={progressState === "current" ? "step" : undefined}
                  className="setup-progress-item"
                  data-state={progressState}
                >
                  <span className="setup-progress-icon" aria-hidden="true">
                    <ProgressIcon size={16} strokeWidth={2} />
                  </span>
                  <span className="setup-progress-copy">
                    <span className="setup-progress-title">
                      <span className="setup-progress-number">{index + 1}</span>
                      {copy.screens[setupStep].title}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="setup-wizard-detail flex min-h-[32rem] flex-col p-7 md:p-10">
          <div className="setup-wizard-header mb-10 flex items-center justify-between gap-4">
            <div
              data-tauri-drag-region
              aria-hidden="true"
              className="setup-wizard-drag-region min-w-8 flex-1"
            >
              <span data-tauri-drag-region className="text-sm text-white/50">
                {stepIndex + 1} / {SETUP_STEPS.length}
              </span>
            </div>
            <div className="setup-wizard-header-actions flex items-center gap-2">
              <button
                type="button"
                onClick={handleSkip}
                className="setup-skip-action rounded-full px-4 py-2.5 text-sm text-white/55 hover:text-white"
              >
                {copy.buttons.skip}
              </button>
              <label className="setup-language-control flex min-w-0 items-center gap-2 text-sm text-white/70">
                <span className="sr-only">{copy.accessibility.appLanguageLabel}</span>
                <select
                  aria-label={copy.accessibility.appLanguageLabel}
                  value={uiLang}
                  onChange={(event) => setUiLang(event.target.value as LangCode)}
                  className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-white"
                >
                  {LANG_OPTIONS.map(({ code, label }) => (
                    <option key={code} value={code}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div
            ref={detailContentRef}
            className="setup-wizard-content flex flex-1 flex-col justify-center"
            data-step={step}
            data-scroll-region="detail"
          >
            {secretStatusError && (
              <div role="alert" className="mb-5 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100">
                <p>{getErrorPresentation(secretStatusError, uiLang, platform).message}</p>
                <button type="button" className="mt-2 underline underline-offset-4" onClick={() => void refreshSecretStatus()}>
                  {connectionCopy.retry}
                </button>
              </div>
            )}
            {step === "keychain" ? (
              <KeychainPrimer
                uiLang={uiLang}
                platform={platform}
                copyVariant="onboarding"
                headingRef={headingRef}
                showEmbeddedAction={false}
                onContinue={handleContinue}
              />
            ) : step === "lyrics" ? (
              <CredentialSetupStep
                headingRef={headingRef}
                title={copy.screens.lyrics.title}
                body={copy.screens.lyrics.body}
                description={copy.providerDescriptions.lyricsChoice}
                providers={[
                  {
                    id: "spotify",
                    label: copy.providerLabels.spotify,
                    selectedBackground: "#1DB95426",
                  },
                  {
                    id: "apple_music",
                    label: copy.providerLabels.appleMusic,
                    selectedBackground: "#FF4E6B26",
                  },
                ]}
                selectedProvider={lyricsSource}
                onSelectProvider={handleSelectLyricsSource}
                primaryCredentialAction={(
                  <div className="provider-connection-panel">
                    <button
                      ref={connectionButtonRef}
                      type="button"
                      disabled={automaticConnectionBusy}
                      onClick={() => void providerConnection.requestConnection(lyricsSource)}
                      className="provider-connection-action bg-white text-black disabled:cursor-wait disabled:opacity-45"
                    >
                      {providerConnection.isStarting
                        ? connectionCopy.validating
                        : connectionActionLabel}
                    </button>
                    <div
                      className="provider-connection-status"
                      aria-live="polite"
                      aria-atomic="true"
                    >
                      {connectionMessage}
                    </div>
                  </div>
                )}
                manualCredentialDisclosure={{ label: connectionCopy.manualAdvanced }}
                guideId={lyricsGuideId}
                guideControls={(
                  <div className="setup-browser-tabs mt-6 flex gap-2" aria-label={copy.screens.lyrics.title}>
                    {browserOptions.map((browserOption) => (
                      <button
                        key={browserOption}
                        type="button"
                        disabled={lyricsCredential.busy}
                        aria-pressed={browser === browserOption}
                        data-selected={browser === browserOption}
                        onClick={() => setBrowser(browserOption)}
                        className={`rounded-full px-4 py-2 text-sm ${
                          browser === browserOption ? "bg-white text-black" : "bg-white/5 text-white/65"
                        }`}
                      >
                        <span>{copy.browserTabs[browserOption]}</span>
                      </button>
                    ))}
                  </div>
                )}
                credentialLabel={lyricsSource === "spotify" ? "Spotify SP_DC" : "Apple Music media-user-token"}
                credentialValue={lyricsCredential.value}
                onCredentialChange={setLyricsCredentialValue}
                validationStatus={lyricsCredential.validationStatus}
                savedAnyway={lyricsCredential.savedAnyway}
                saveFailed={lyricsCredential.saveFailed}
                isSaved={isLyricsSecretSaved}
                busy={lyricsCredential.busy}
                onValidate={() => void validateLyrics()}
                onSaveAnyway={() => void saveLyricsAnyway()}
                copy={copy}
              />
            ) : step === "ai" ? (
              <div>
              {!isCloudAiProvider(connectionProvider) ? <><h1 ref={headingRef} tabIndex={-1} className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl">{copy.screens.ai.title}</h1><p className="setup-step-body mb-6">{copy.screens.ai.body}</p></> : null}
              <AiConnectionPanel provider={connectionProvider} onProviderChange={selectConnectionProvider} uiLang={uiLang} onReadyChange={setConnectionReady} disabled={aiCredential.busy}>
              {isCloudAiProvider(connectionProvider) ? (
              <CredentialSetupStep
                headingRef={headingRef}
                title={copy.screens.ai.title}
                body={copy.screens.ai.body}
                description={copy.providerDescriptions.aiChoice}
                providers={[]}
                selectedProvider={aiProvider}
                onSelectProvider={selectAiProvider}
                guideId={aiGuideId}
                beforeCredential={(
                  <div className="setup-field mt-5">
                    <label htmlFor="setup-ai-model" className="text-sm text-white/70">
                      {copy.accessibility.aiModelLabel}
                    </label>
                    <select
                      id="setup-ai-model"
                      disabled={aiCredential.busy}
                      value={aiModel}
                      onChange={(event) => selectAiModel(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 text-white"
                    >
                      {CLOUD_AI_MODEL_OPTIONS[aiProvider].map((model) => (
                        <option key={model.id} value={model.id}>{model.label}</option>
                      ))}
                    </select>
                  </div>
                )}
                credentialLabel={`${aiProvider === "gemini" ? "Gemini" : aiProvider === "openai" ? "OpenAI" : "Claude"} ${dictionary[uiLang].apiKey}`}
                credentialValue={aiCredential.value}
                onCredentialChange={setAiCredentialValue}
                validationStatus={aiCredential.validationStatus}
                savedAnyway={aiCredential.savedAnyway}
                saveFailed={aiCredential.saveFailed}
                isSaved={isAiSecretSaved}
                busy={aiCredential.busy}
                onValidate={() => void validateAi()}
                onSaveAnyway={() => void saveAiAnyway()}
                copy={copy}
              />
              ) : <SetupServerConnection key={connectionProvider} provider={connectionProvider} uiLang={uiLang} primerAccepted={primerAccepted} onReadyChange={setConnectionReady} />}
              </AiConnectionPanel>
              </div>
            ) : step === "language" ? (
              <div>
                <h1 ref={headingRef} tabIndex={-1} className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl">{copy.screens.language.title}</h1>
                <p className="setup-step-body">{copy.screens.language.body}</p>
                <label htmlFor="setup-target-language" className="mt-8 block text-sm font-medium text-white">
                  {copy.language.targetLabel}
                </label>
                <p className="mt-2 text-sm text-white/55">{copy.language.targetDescription}</p>
                <TranslationLanguageSelect
                  id="setup-target-language"
                  value={targetLang}
                  onChange={setTargetLang}
                  uiLang={uiLang}
                  label={copy.language.targetLabel}
                  className="mt-4"
                />
              </div>
            ) : step === "review" ? (
              <div>
                <h1 ref={headingRef} tabIndex={-1} className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl">{copy.screens.review.title}</h1>
                <p className="setup-step-body">{copy.screens.review.body}</p>
                <dl className="mt-8 grid gap-4 rounded-2xl border border-white/10 p-5 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-white/50">{copy.reviewLabels.lyricsProvider}</dt>
                    <dd>{lyricsSource === "spotify" ? copy.providerLabels.spotify : copy.providerLabels.appleMusic}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-white/50">{copy.reviewLabels.connectionStatus}</dt>
                    <dd>{lyricsSaved ? copy.reviewLabels.ready : copy.reviewLabels.notConfigured}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-white/50">{copy.reviewLabels.aiProvider}</dt>
                    <dd>{aiProviderLabel(connectionProvider, uiLang)} · {isCloudAiProvider(connectionProvider) ? selectedModel?.label ?? aiModel : getStoredTranslationConfig().model === CLI_DEFAULT_MODEL ? dictionary[uiLang].cliDefault : getStoredTranslationConfig().model}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-white/50">{copy.reviewLabels.connectionStatus}</dt>
                    <dd>{aiSaved ? copy.reviewLabels.ready : copy.reviewLabels.notConfigured}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-white/50">{copy.reviewLabels.targetLanguage}</dt>
                    <dd>{targetLanguageLabel}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <>
                <h1 ref={headingRef} tabIndex={-1} className="setup-step-heading text-3xl font-semibold tracking-tight md:text-5xl">{copy.screens.welcome.title}</h1>
                <p className="setup-step-body">{copy.screens.welcome.body}</p>
              </>
            )}
          </div>

          <div className="setup-wizard-actions mt-10 flex flex-wrap items-center gap-3" data-fixed-region="navigation">
            <button
              type="button"
              onClick={() => setStep((current) => previousSetupStep(current))}
              disabled={isFirstStep || credentialBusy}
              className="setup-secondary-action rounded-full border border-white/15 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-35"
            >
              {copy.buttons.back}
            </button>
            <button
              type="button"
              onClick={handleContinue}
              disabled={credentialBusy || (step === "lyrics" && !lyricsSaved) || (step === "ai" && !aiSaved) || (isReview && !setupComplete)}
              className="setup-primary-action rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black disabled:cursor-not-allowed disabled:opacity-35"
            >
              {isReview ? copy.buttons.complete : copy.buttons.continue}
            </button>
          </div>
        </section>
      </div>
      <ProviderConnectionRiskModal
        open={providerConnection.riskModalOpen}
        provider={providerConnection.pendingProvider}
        uiLang={uiLang}
        returnFocusTo={connectionButtonRef.current}
        onConfirm={() => void providerConnection.confirmRiskAndConnect()}
        onCancel={providerConnection.dismissRisk}
      />
    </main>
  );
}
