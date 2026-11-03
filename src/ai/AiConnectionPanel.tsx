import { settingsCopyFor } from "../settingsCopy";
import { aiProviderLabel } from "../aiProviderCopy";
import { aiCopy, reasoningLabel } from "./aiCopy";
import { OFFICIAL_SETUP_DESTINATIONS as destinations } from "../setup/guideLinks";
import { cliErrorCode, cliErrorMessage } from "./cliCopy";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Check, RefreshCw, Terminal, Network } from "lucide-react";
import type { LangCode } from "../i18n";
import {
  CLI_DEFAULT_MODEL,
  CLI_PROVIDERS,
  CUSTOM_AI_MODEL_VALUE,
  aiConnectionMode,
  configForProvider,
  getAiModelClass,
  getStoredGroundingSearchMode,
  isCliAiProvider,
  saveGroundingSearchMode,
  saveTranslationConfig,
  storedProviderForMode,
  type AiConnectionMode,
  type AiProvider,
  type CliAiProvider,
  type TranslationConfig,
} from "../settings";

type CliStatus = {
  provider: CliAiProvider;
  installation: "installed" | "missing" | "unsupported" | "check_failed";
  path?: string | null;
  version?: string | null;
  message?: string | null;
  missingFeatures?: string[];
};
type CliModel = { id: string; label: string; reasoningOptions: string[] };
type CliCatalog = { models: CliModel[]; live: boolean };
type Feedback =
  | { kind: "idle" }
  | { kind: "testing" }
  | { kind: "success" }
  | { kind: "error"; error: unknown };

export const CLI_GUIDES: Record<
  CliAiProvider,
  { install: string; login: string; command: string }
> = {
  codex_cli: {
    install: destinations.codexCliInstall,
    login: destinations.codexCliLogin,
    command: "codex login",
  },
  claude_cli: {
    install: destinations.claudeCliInstall,
    login: destinations.claudeCliLogin,
    command: "claude auth login",
  },
  gemini_cli: {
    install: destinations.geminiCliInstall,
    login: destinations.geminiCliLogin,
    command: "gemini",
  },
  antigravity_cli: {
    install: destinations.antigravityCliInstall,
    login: destinations.antigravityCliLogin,
    command: "agy",
  },
  opencode_cli: {
    install: destinations.opencodeCliInstall,
    login: destinations.opencodeCliLogin,
    command: "opencode auth login",
  },
};
const CLI_RECOVERY: Record<CliAiProvider, { bin: string; update: string }> = {
  codex_cli: { bin: "codex", update: "npm install -g @openai/codex@latest" },
  claude_cli: { bin: "claude", update: "claude update" },
  gemini_cli: { bin: "gemini", update: "npm install -g @google/gemini-cli@latest" },
  antigravity_cli: { bin: "agy", update: "agy update" },
  opencode_cli: { bin: "opencode", update: "opencode upgrade" },
};
const API_PROVIDERS: readonly AiProvider[] = [
  "gemini",
  "openai",
  "claude",
  "openai_compatible",
];
const LOCAL_PROVIDERS: readonly AiProvider[] = ["ollama", "lmstudio"];
const cancel = (requestId: string) => {
  if (isTauri())
    void invoke("cancel_cli_ai_request", { requestId }).catch(() => {});
};

function GuideLink({ href, children, onOpen }: { href: string; children: ReactNode; onOpen?: () => void }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="settings-inline-link"
      onClick={(event) => {
        onOpen?.();
        if (!isTauri()) return;
        event.preventDefault();
        void openUrl(href).catch(() =>
          window.open(href, "_blank", "noopener,noreferrer"),
        );
      }}
    >
      {children} ↗
    </a>
  );
}
function ProviderLogo({ provider }: { provider: AiProvider }) {
  const logo =
    provider === "codex_cli"
      ? "openai"
      : provider === "claude_cli"
        ? "claude"
        : (provider === "gemini_cli" || provider === "antigravity_cli")
          ? "gemini"
          : provider;
  if (provider === "opencode_cli")
    return <Terminal size={22} aria-hidden="true" />;
  if (provider === "openai_compatible")
    return <Network size={22} aria-hidden="true" />;
  return (
    <img className="settings-provider-logo" src={`/provider-logos/${logo}.svg`} width={22} height={22} alt="" />
  );
}

export function AiConnectionPanel({
  provider,
  onProviderChange,
  uiLang,
  children,
  onReadyChange,
  disabled = false,
}: {
  provider: AiProvider;
  onProviderChange: (provider: AiProvider) => void;
  uiLang: LangCode;
  children?: ReactNode;
  onReadyChange?: (ready: boolean) => void;
  disabled?: boolean;
}) {
  const copy = aiCopy[uiLang];
  const mode = aiConnectionMode(provider);
  const [statuses, setStatuses] = useState<CliStatus[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanFailed, setScanFailed] = useState(false);
  const scanId = useRef<string | null>(null);
  const rescanOnReturn = useRef(false);
  const onProvider = useRef(onProviderChange);
  onProvider.current = onProviderChange;
  const activeProvider = useRef(provider);
  activeProvider.current = provider;
  const ready = useRef(onReadyChange);
  ready.current = onReadyChange;
  const newUser = useRef(
    localStorage.getItem("songdocent_ai_provider") === null,
  );
  const mounted = useRef(false);
  const scan = useCallback(async () => {
    if (!isTauri()) {
      setStatuses([]);
      return;
    }
    if (scanId.current) cancel(scanId.current);
    const requestId = crypto.randomUUID();
    scanId.current = requestId;
    setScanning(true);
    setScanFailed(false);
    const paths: Partial<Record<CliAiProvider, string>> = {};
    for (const provider of CLI_PROVIDERS) {
      const path = configForProvider(provider).cliOptions?.executablePath;
      if (path) paths[provider] = path;
    }
    try {
      const result = await invoke<CliStatus[]>("scan_cli_providers", {
        paths,
        requestId,
      });
      if (!mounted.current || scanId.current !== requestId) return;
      const statuses = Array.isArray(result) ? result.map((status) => ({
        ...status, path: status.path ?? undefined, version: status.version ?? undefined,
        message: status.message ?? undefined, missingFeatures: status.missingFeatures ?? undefined,
      })) : [];
      setStatuses(statuses);
      if (newUser.current && !localStorage.getItem("songdocent_ai_provider")) {
        newUser.current = false;
        const first = CLI_PROVIDERS.find((provider) =>
          statuses.some(
            (status) =>
              status.provider === provider &&
              status.installation === "installed",
          ),
        );
        const selected = first ?? "gemini";
        saveTranslationConfig(configForProvider(selected));
        onProvider.current(selected);
      }
    } catch {
      if (mounted.current && scanId.current === requestId) setScanFailed(true);
    } finally {
      if (mounted.current && scanId.current === requestId) {
        setScanning(false);
        scanId.current = null;
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    if (newUser.current || isCliAiProvider(activeProvider.current)) void scan();
    return () => {
      mounted.current = false;
      if (scanId.current) cancel(scanId.current);
    };
  }, [scan]);
  useEffect(() => {
    if (mode === "cli" && statuses.length === 0 && !scanning && !scanFailed && !scanId.current)
      void scan();
  }, [mode, statuses.length, scanning, scanFailed, scan]);
  useEffect(() => {
    const onReturn = () => {
      if (!rescanOnReturn.current || document.visibilityState === "hidden") return;
      rescanOnReturn.current = false;
      void scan();
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [scan]);
  const choose = (next: AiProvider) => {
    if (disabled) return;
    localStorage.setItem(`songdocent_ai_last_provider_${mode}`, provider);
    newUser.current = false;
    ready.current?.(false);
    saveTranslationConfig(configForProvider(next));
    onProviderChange(next);
  };
  const installed = CLI_PROVIDERS.filter((provider) =>
    statuses.some(
      (status) =>
        status.provider === provider && status.installation !== "missing",
    ),
  );
  const missing = CLI_PROVIDERS.filter(
    (provider) => !installed.includes(provider),
  );
  const switchMode = (next: AiConnectionMode) => {
    let nextProvider = storedProviderForMode(next);
    if (
      next === "cli" &&
      !localStorage.getItem("songdocent_ai_last_provider_cli")
    )
      nextProvider = installed[0] ?? "codex_cli";
    choose(nextProvider);
  };
  const row = (key: AiProvider, content?: ReactNode, status?: CliStatus) => (
    <section
      key={key}
      className="ai-provider-card"
      data-selected={provider === key}
    >
      <button
        type="button"
        className="ai-provider-row"
        disabled={disabled}
        aria-pressed={provider === key}
        onClick={() => choose(key)}
      >
        <span className="ai-provider-icon">
          <ProviderLogo provider={key} />
        </span>
        <span className="ai-provider-name">
          <span>{aiProviderLabel(key, uiLang)}</span>
          {status ? (
            <small>
              {status.installation === "unsupported"
                ? copy.featuresNotConfirmed
                : status.installation === "check_failed"
                  ? copy.verificationFailed
                  : copy.installed}
              {status.version ? ` · ${status.version}` : ""}
            </small>
          ) : null}
        </span>
        {provider === key ? <Check size={16} aria-hidden="true" /> : null}
      </button>
      {provider === key ? content : null}
    </section>
  );
  return (
    <div
      className="ai-connection-panel"
      onChangeCapture={() => {
        newUser.current = false;
      }}
    >
      <div
        className="ai-mode-tabs"
        role="tablist"
        aria-label={copy.connectionMethod}
      >
        {(["cli", "api", "local"] satisfies AiConnectionMode[]).map(
          (key, index, modes) => (
            <button
              key={key}
              id={`ai-mode-${key}`}
              type="button"
              role="tab"
              disabled={disabled}
              aria-selected={mode === key}
              aria-controls="ai-mode-content"
              tabIndex={mode === key ? 0 : -1}
              onClick={() => switchMode(key)}
              onKeyDown={(event) => {
                const target =
                  event.key === "ArrowRight"
                    ? modes[(index + 1) % modes.length]
                    : event.key === "ArrowLeft"
                      ? modes[(index + modes.length - 1) % modes.length]
                      : event.key === "Home"
                        ? modes[0]
                        : event.key === "End"
                          ? modes[modes.length - 1]
                          : null;
                if (target) {
                  event.preventDefault();
                  switchMode(target);
                  document.getElementById(`ai-mode-${target}`)?.focus();
                }
              }}
            >
              {key === "api"
                ? copy.apiKey
                : key === "cli"
                  ? "CLI"
                  : copy.localModels}
            </button>
          ),
        )}
      </div>
      <div
        id="ai-mode-content"
        role="tabpanel"
        aria-labelledby={`ai-mode-${mode}`}
      >
        {mode !== "cli" ? (
          <div className="ai-provider-list">
            {(mode === "api" ? API_PROVIDERS : LOCAL_PROVIDERS).map((key) =>
              row(key, <div className="ai-provider-detail">{children}</div>),
            )}
          </div>
        ) : (
          <>
            <div className="ai-list-heading">
              <span>
                {copy.installedClis} (
                {installed.length})
              </span>
              <button
                type="button"
                className="settings-inline-link"
                onClick={() => void scan()}
                disabled={scanning}
              >
                <RefreshCw
                  size={13}
                  className={scanning ? "ai-spinning" : ""}
                />{" "}
                {copy.rescan}
              </button>
            </div>
            {scanning ? (
              <p className="settings-helper" role="status">
                {copy.checkingClis}
              </p>
            ) : null}
            {scanFailed ? (
              <p className="ai-connection-error" role="alert">
                {copy.scanFailed}
              </p>
            ) : null}
            <div className="ai-provider-list">
              {installed.map((key) =>
                row(
                  key,
                  <CliDetail
                    key={key}
                    provider={key}
                    status={statuses.find((status) => status.provider === key)}
                    uiLang={uiLang}
                    onReadyChange={onReadyChange}
                    rescan={scan}
                    scanning={scanning}
                    onOpenGuide={() => { rescanOnReturn.current = true; }}
                  />,
                  statuses.find((status) => status.provider === key),
                ),
              )}
            </div>
            {!scanning && installed.length === 0 ? (
              <p className="settings-helper">
                {copy.installAndSignIn}
              </p>
            ) : null}
            <details
              className="ai-installable"
              open={installed.length === 0 ? true : undefined}
            >
              <summary>
                {copy.availableToInstall}{" "}
                ({missing.length})
              </summary>
              {missing.map((key) => (
                <div key={key} className="ai-missing-row">
                  <button
                    type="button"
                    className="ai-missing-choice"
                    aria-pressed={provider === key}
                    onClick={() => choose(key)}
                  >
                    <ProviderLogo provider={key} /> {aiProviderLabel(key, uiLang)}
                    {provider === key ? <Check size={13} /> : null}
                  </button>
                  <div className="ai-guide-links">
                    <GuideLink href={CLI_GUIDES[key].install}>
                      {copy.install}
                    </GuideLink>
                    <GuideLink href={CLI_GUIDES[key].login}>
                      {copy.signIn}
                    </GuideLink>
                  </div>
                </div>
              ))}
            </details>
            {isCliAiProvider(provider) && !installed.includes(provider) ? (
              <CliDetail
                key={provider}
                provider={provider}
                uiLang={uiLang}
                onReadyChange={onReadyChange}
                rescan={scan}
                scanning={scanning}
                onOpenGuide={() => { rescanOnReturn.current = true; }}
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function CliDetail({
  provider,
  status,
  uiLang,
  onReadyChange,
  rescan,
  scanning,
  onOpenGuide,
}: {
  provider: CliAiProvider;
  status?: CliStatus;
  uiLang: LangCode;
  onReadyChange?: (ready: boolean) => void;
  rescan: () => Promise<void>;
  scanning: boolean;
  onOpenGuide: () => void;
}) {
  const copy = aiCopy[uiLang];
  const [config, setConfig] = useState(() => configForProvider(provider));
  const [catalog, setCatalog] = useState<CliCatalog>({
    models: [],
    live: false,
  });
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [searchMode, setSearchMode] = useState(getStoredGroundingSearchMode);
  const [feedback, setFeedback] = useState<Feedback>({ kind: "idle" });
  const [custom, setCustom] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<"idle" | "success" | "error">("idle");
  const testId = useRef<string | null>(null);
  const modelId = useRef<string | null>(null);
  const ready = useRef(onReadyChange);
  ready.current = onReadyChange;
  const identity = JSON.stringify([config, searchMode]);
  const installed = status?.installation === "installed";
  const recoveryCommand = status?.installation === "unsupported"
    ? CLI_RECOVERY[provider].update
    : `${CLI_RECOVERY[provider].bin} --version`;
  useEffect(() => {
    setCopyFeedback("idle");
  }, [recoveryCommand]);
  useEffect(() => {
    setFeedback({ kind: "idle" });
    ready.current?.(false);
    return () => {
      if (testId.current) {
        cancel(testId.current);
        testId.current = null;
      }
    };
  }, [identity, installed]);
  const loadModels = useCallback(async () => {
    if (!installed || !isTauri()) return;
    if (modelId.current) cancel(modelId.current);
    const requestId = crypto.randomUUID();
    modelId.current = requestId;
    setCatalogLoading(true);
    setCatalogFailed(false);
    try {
      const result = await invoke<CliCatalog>("list_cli_models", {
        provider,
        cliOptions: { executablePath: config.cliOptions?.executablePath },
        requestId,
      });
      if (modelId.current !== requestId) return;
      if (!result || !Array.isArray(result.models))
        throw new Error("invalid catalog");
      setCatalog(result);
    } catch {
      if (modelId.current === requestId) setCatalogFailed(true);
    } finally {
      if (modelId.current === requestId) setCatalogLoading(false);
    }
  }, [provider, installed, config.cliOptions?.executablePath]);
  useEffect(() => {
    void loadModels();
    return () => {
      if (modelId.current) {
        cancel(modelId.current);
        modelId.current = null;
      }
    };
  }, [loadModels]);
  const save = (next: TranslationConfig) => {
    setConfig(next);
    saveTranslationConfig(next);
  };
  const test = async () => {
    const requestId = crypto.randomUUID();
    testId.current = requestId;
    setFeedback({ kind: "testing" });
    ready.current?.(false);
    try {
      const result = await invoke<{ ok: boolean; searchVerified: boolean }>(
        "test_cli_connection",
        {
          provider,
          model: config.model,
          cliOptions: config.cliOptions,
          searchMode,
          requestId,
        },
      );
      if (testId.current !== requestId) return;
      if (!result?.ok || (searchMode !== "off" && !result.searchVerified))
        throw "CLI_SEARCH_UNAVAILABLE";
      setFeedback({ kind: "success" });
      ready.current?.(true);
    } catch (error) {
      if (testId.current === requestId)
        setFeedback({ kind: "error", error });
    } finally {
      if (testId.current === requestId) testId.current = null;
    }
  };
  const settingsCopy = settingsCopyFor(uiLang);
  const modelClassDescriptions = {
    fast: settingsCopy.modelFast,
    balanced: settingsCopy.modelBalanced,
    capable: settingsCopy.modelCapable,
  };
  const models = catalog.models.filter(
    (model) => model.id !== CLI_DEFAULT_MODEL,
  );
  const known = models.some((model) => model.id === config.model);
  const modelValue =
    custom || (config.model !== CLI_DEFAULT_MODEL && !known)
      ? CUSTOM_AI_MODEL_VALUE
      : config.model;
  const reasoning =
    models.find((model) => model.id === config.model)?.reasoningOptions ?? [];
  return (
    <div className="ai-provider-detail ai-cli-detail">
      {installed ? (
        <>
          <div className="ai-model-field">
            <label className="ai-compact-field">
              <span>{copy.model}</span>
              <select
                value={modelValue}
                onChange={(event) => {
                  if (event.target.value === CUSTOM_AI_MODEL_VALUE) {
                    setCustom(true);
                  } else {
                    setCustom(false);
                    save({
                      ...config,
                      model: event.target.value,
                      cliOptions: { ...config.cliOptions, reasoning: undefined },
                    });
                  }
                }}
              >
                <option value={CLI_DEFAULT_MODEL}>
                  {copy.cliDefault} · {copy.followsCliSettings}
                </option>
                {models.map((model) => {
                  const modelClass = getAiModelClass(provider, model.id);
                  return (
                    <option key={model.id} value={model.id}>
                      {model.label}{modelClass ? ` · ${modelClassDescriptions[modelClass]}` : ""}
                    </option>
                  );
                })}
                <option value={CUSTOM_AI_MODEL_VALUE}>
                  {copy.customModelId}
                </option>
              </select>
            </label>
            <div className="ai-model-caption">
              <span className="settings-helper" role="status">
                {catalogLoading
                  ? copy.loadingModels
                  : catalogFailed
                    ? copy.refreshFailed
                    : catalog.live
                      ? null
                      : copy.documentedModels}
              </span>
              <button
                type="button"
                className="settings-inline-link"
                onClick={() => void loadModels()}
                disabled={catalogLoading}
              >
                <RefreshCw size={12} />
                {copy.refresh}
              </button>
            </div>
          </div>
          {modelValue === CUSTOM_AI_MODEL_VALUE ? (
            <label className="ai-compact-field">
              <span>{copy.modelId}</span>
              <input
                value={config.model === CLI_DEFAULT_MODEL ? "" : config.model}
                onChange={(event) =>
                  save({
                    ...config,
                    model: event.target.value,
                    cliOptions: { ...config.cliOptions, reasoning: undefined },
                  })
                }
                spellCheck={false}
                autoComplete="off"
                placeholder={
                  provider === "opencode_cli" ? "provider/model" : "model-id"
                }
              />
            </label>
          ) : null}
          {reasoning.length ? (
            <label className="ai-compact-field">
              <span>{copy.reasoning}</span>
              <select
                value={config.cliOptions?.reasoning ?? ""}
                onChange={(event) =>
                  save({
                    ...config,
                    cliOptions: {
                      ...config.cliOptions,
                      reasoning: event.target.value || undefined,
                    },
                  })
                }
              >
                <option value="">
                  {copy.cliDefault}
                </option>
                {reasoning.map((level) => (
                  <option key={level} value={level}>
                    {reasoningLabel(level, copy)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="ai-compact-field">
            <span>{copy.webSearch}</span>
            <select
              value={searchMode}
              onChange={(event) => {
                const mode = event.target.value;
                if (
                  mode === "translation" ||
                  mode === "annotation" ||
                  mode === "off"
                ) {
                  setSearchMode(mode);
                  saveGroundingSearchMode(mode);
                  window.dispatchEvent(
                    new Event("songdocent-settings-changed"),
                  );
                }
              }}
            >
              <option value="off">{copy.off}</option>
              <option value="translation">
                {copy.translationAndAnnotations}
              </option>
              <option value="annotation">
                {copy.additionalAnnotations}
              </option>
            </select>
          </label>
          {provider === "opencode_cli" && searchMode !== "off" ? (
            <p className="settings-helper">
              {copy.exaSearch}
            </p>
          ) : null}
          <div className="ai-test-row">
            <div aria-live="polite">
            {feedback.kind === "success" ? (
              <p className="ai-connection-success">
                {copy.connectionVerified}
              </p>
            ) : feedback.kind === "error" ? (
              <p className="ai-connection-error" role="alert">
                {cliErrorMessage(feedback.error, uiLang)}
              </p>
            ) : feedback.kind === "idle" ? (
              <p className="settings-helper">
                {copy.connectionUntested}
              </p>
            ) : null}
            </div>
            <button
              type="button"
              className="settings-test-button"
              disabled={feedback.kind === "testing"}
              onClick={() => void test()}
            >
              {feedback.kind === "testing" ? copy.testing : copy.testConnection}
            </button>
          </div>
        </>
      ) : status?.installation === "unsupported" || status?.installation === "check_failed" ? (
        <div className="ai-cli-recovery">
          <p className="ai-connection-error">
            {status.installation === "unsupported"
              ? copy.featuresUnavailable
              : status.message?.startsWith("CLI_TIMEOUT")
                ? cliErrorMessage("CLI_TIMEOUT", uiLang)
                : copy.verificationCouldNotRun}
          </p>
          {status.installation === "unsupported" ? (
            <p className="settings-helper">{copy.versionNotRequired}</p>
          ) : null}
          {status.version ? <p>{copy.detectedVersion}: <code>{status.version}</code></p> : null}
          {status.path ? <p>{copy.detectedPath}: <code>{status.path}</code></p> : null}
          {status.missingFeatures?.length ? (
            <details>
              <summary>{copy.missingFeatures}</summary>
              <code>{status.missingFeatures.join(", ")}</code>
            </details>
          ) : null}
          <p className="settings-helper">{status.installation === "unsupported"
            ? copy.updateAndRecheck
            : copy.runAndRecheck}</p>
          <div className="ai-cli-recovery-command">
            <code>{recoveryCommand}</code>
            <button type="button" className="settings-inline-link" onClick={async () => {
              try {
                await navigator.clipboard.writeText(recoveryCommand);
                setCopyFeedback("success");
              } catch {
                setCopyFeedback("error");
              }
            }}>{copy.copyCommand}</button>
          </div>
          <p aria-live="polite">{copyFeedback === "success" ? copy.copied : copyFeedback === "error" ? copy.copyFailed : null}</p>
          {status.installation === "unsupported" ? <p className="settings-helper">{provider === "codex_cli" || provider === "gemini_cli" ? copy.npmInstallHelp : copy.updateHelp}</p> : null}
          <div className="ai-guide-links">
            <GuideLink href={CLI_GUIDES[provider].install} onOpen={onOpenGuide}>{copy.officialGuide}</GuideLink>
            <button type="button" className="settings-inline-link" disabled={scanning} onClick={() => void rescan()}>{copy.recheck}</button>
          </div>
        </div>
      ) : null}
      {feedback.kind === "error" && cliErrorCode(feedback.error) === "CLI_AUTH_REQUIRED" ? (
        <div className="ai-guide-links">
          <GuideLink href={CLI_GUIDES[provider].login} onOpen={onOpenGuide}>
            {copy.signInGuide}
          </GuideLink>
          <code>{CLI_GUIDES[provider].command}</code>
        </div>
      ) : null}
      <details className="ai-advanced">
        <summary>
          {copy.advancedPath}
        </summary>
        <label className="ai-compact-field">
          <span>
            {copy.executablePath}
          </span>
          <input
            key={config.cliOptions?.executablePath ?? "auto"}
            defaultValue={config.cliOptions?.executablePath ?? ""}
            placeholder={
              status?.path ??
              copy.automaticDetection
            }
            spellCheck={false}
            autoComplete="off"
            onBlur={(event) => {
              const executablePath = event.target.value.trim() || undefined;
              if (executablePath !== config.cliOptions?.executablePath) {
                save({
                  ...config,
                  cliOptions: { ...config.cliOptions, executablePath },
                });
                void rescan();
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
        </label>
        <button
          type="button"
          className="settings-inline-link"
          onClick={() => {
            save({
              ...config,
              cliOptions: { ...config.cliOptions, executablePath: undefined },
            });
            void rescan();
          }}
        >
          {copy.useAutomaticDetection}
        </button>
      </details>
    </div>
  );
}
