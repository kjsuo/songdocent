import { aiCopy, reasoningLabel } from "./ai/aiCopy";
import { aiProviderLabel } from "./aiProviderCopy";
import { AiConnectionPanel } from "./ai/AiConnectionPanel";
import { settingsCopyFor, formatSettingsCopy } from "./settingsCopy";
import { UpdateSettings } from "./UpdateSettings";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type RefObject,
  type ReactNode,
} from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { OFFICIAL_SETUP_DESTINATIONS } from "./setup/guideLinks";
import { LANG_OPTIONS, type LangCode } from "./i18n";
import { TranslationLanguageSelect } from "./TranslationLanguageSelect";
import {
  platformCopyFor,
  type DesktopPlatform,
} from "./platform/platformCopy";
import {
  supportsGroundingSearch,
  getStoredGroundingSearchMode,
  saveGroundingSearchMode,
  type GroundingSearchMode,
  CUSTOM_AI_MODEL_VALUE,
  DEFAULT_AI_MODELS,
  DEFAULT_LOCAL_AI_BASE_URLS,
  DEFAULT_TRANSLATION_CHUNK_MODE,
  DEFAULT_TRANSLATION_CHUNK_SIZE,
  DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
  MAX_TRANSLATION_CHUNK_SIZE,
  MAX_TRANSLATION_CHUNK_THRESHOLD,
  MIN_TRANSLATION_CHUNK_SIZE,
  MIN_TRANSLATION_CHUNK_THRESHOLD,
  type AiProvider,
  type LyricsSource,
  type SecretStatus,
  type SettingsOperationToken,
  type SettingsSection,
  type TranslationChunkConfig,
  type TranslationChunkMode,
  getAiModelSelection,
  getAiModelClass,
  getApiReasoningOptions,
  getStoredApiReasoning,
  saveApiReasoning,
  getProviderApiKeyDisplayValue,
  getStoredCustomAiModel,
  getStoredLyricsSource,
  getStoredTranslationChunkConfig,
  getStoredTranslationConfig,
  isLocalAiProvider,
  usesAiBaseUrl,
  isCloudAiProvider,
  isSettingsOperationCurrent,
  normalizeAiProvider,
  normalizeTranslationChunkConfig,
  normalizeSettingsSection,
  saveCustomAiModel,
  saveLyricsSource,
  saveTranslationChunkConfig,
  saveTranslationConfig,
  secretKindForProvider,
} from "./settings";
import { useCloudModels } from "./useCloudModels";
import { useAppError } from "./AppErrorProvider";
import { ProviderConnectionRiskModal } from "./ProviderConnectionRiskModal";
import {
  clearProviderExpired,
  connectionNeedsPolling,
  isProviderExpired,
} from "./providerConnection";
import {
  formatProviderCopy,
  connectionStatusMessage,
  providerConnectionCopyFor,
} from "./providerConnectionContent";
import { useProviderConnection } from "./useProviderConnection";
import { KeychainPrimer } from "./setup/KeychainPrimer";
import { setupCopyFor, setupBrowsersFor, type SetupCopy } from "./setup/setupContent";
import { SetupGuide } from "./setup/SetupGuide";
import {
  acceptPendingSecretSave,
  canLoadSecretStatus,
  cancelPendingSecretSave,
  requestSecretSave,
  type PendingSecretSave,
} from "./setup/setupState";
import {
  clearSecret,
  getSecretStatus,
  saveSecret as saveSecretValue,
  type SecretKind,
} from "./setup/secretClient";

const SECRET_MASK = "********";
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function canReceiveFocus(element: HTMLElement | null): element is HTMLElement {
  if (!element?.isConnected || element.closest("[inert]")) return false;
  if ((element as HTMLElement & { disabled?: boolean }).disabled) return false;
  return element.tabIndex >= 0;
}

function lyricsSecretKindForSource(source: LyricsSource): SecretKind {
  return source === "spotify"
    ? "spotify_sp_dc"
    : "apple_music_media_user_token";
}

function lyricsSourceForSecretKind(kind: SecretKind): LyricsSource | null {
  if (kind === "spotify_sp_dc") return "spotify";
  if (kind === "apple_music_media_user_token") return "apple_music";
  return null;
}

function readProviderExpiryState(): Record<LyricsSource, boolean> {
  return {
    spotify: isProviderExpired("spotify"),
    apple_music: isProviderExpired("apple_music"),
  };
}



const SETTINGS_NAV: {
  key: SettingsSection;
  label: string;
}[] = [
  { key: "ai", label: "AI" },
  { key: "lyrics", label: "Lyrics" },
  { key: "language", label: "Language" },
  { key: "setup", label: "Setup" },
  { key: "updates", label: "Updates" },
];

const LYRICS_SOURCE_OPTIONS: {
  key: LyricsSource;
  label: string;
}[] = [
  { key: "spotify", label: "Spotify" },
  { key: "apple_music", label: "Apple Music" },
];

type SaveFeedback = {
  tone: "neutral" | "saving" | "success" | "error";
  message: string;
};

type LocalAiConnectionStatus = {
  ok: boolean;
  message: string;
  models: string[];
};

type SettingsModalProps = {
  open: boolean;
  initialSection: SettingsSection;
  onClose: () => void;
  onOpenSetupGuide: () => void;
  primerAccepted: boolean;
  onPrimerAccepted: () => void;
  uiLang: LangCode;
  targetLang: string;
  setUiLang: (value: LangCode) => void;
  setTargetLang: (value: string) => void;
  platform?: DesktopPlatform;
};

const EMPTY_SECRET_STATUS: SecretStatus = {
  spotifySpDc: false,
  appleMusicMediaUserToken: false,
  openaiApiKey: false,
  geminiApiKey: false,
  claudeApiKey: false,
  openaiCompatibleApiKey: false,
};

function commitOnEnter(
  event: KeyboardEvent<HTMLInputElement>,
  commit: (value: string) => void,
) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  commit(event.currentTarget.value);
}

export function SettingsModal({
  open,
  initialSection,
  onClose,
  onOpenSetupGuide,
  primerAccepted,
  onPrimerAccepted,
  uiLang,
  targetLang,
  setUiLang,
  setTargetLang,
  platform = "macos",
}: SettingsModalProps) {
  const { reportError, clearError } = useAppError();
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [status, setStatus] = useState<SecretStatus>(EMPTY_SECRET_STATUS);
  const [spotifySpDc, setSpotifySpDc] = useState("");
  const [appleMusicMediaUserToken, setAppleMusicMediaUserToken] = useState("");
  const [lyricsSource, setLyricsSource] = useState<LyricsSource>("spotify");
  const [translationChunkMode, setTranslationChunkMode] = useState<TranslationChunkMode>(
    DEFAULT_TRANSLATION_CHUNK_MODE,
  );
  const [translationChunkThreshold, setTranslationChunkThreshold] = useState(
    DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
  );
  const [translationChunkSize, setTranslationChunkSize] = useState(
    DEFAULT_TRANSLATION_CHUNK_SIZE,
  );
  const [expiredProviders, setExpiredProviders] = useState<Record<LyricsSource, boolean>>(
    readProviderExpiryState,
  );
  const [provider, setProvider] = useState<AiProvider>("gemini");
  const [searchMode, setSearchMode] = useState<GroundingSearchMode>(getStoredGroundingSearchMode);
  const [model, setModel] = useState(DEFAULT_AI_MODELS.gemini);
  const [apiReasoning, setApiReasoning] = useState("");
  const [modelSelection, setModelSelection] = useState(DEFAULT_AI_MODELS.gemini);
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [secretStatusLoaded, setSecretStatusLoaded] = useState(false);
  const [primerOpen, setPrimerOpen] = useState(false);
  const [operationTick, setOperationTick] = useState(0);
  const wasOpenRef = useRef(false);
  const lastOpenPropRef = useRef(open);
  const settingsOpenRef = useRef(open);
  const operationGenerationRef = useRef(0);
  const nextOperationIdRef = useRef(0);
  const activeOperationRef = useRef<SettingsOperationToken | null>(null);
  const statusLoadAttemptedGenerationRef = useRef(-1);
  const statusLoadRetryRemainingRef = useRef(0);
  const statusRefreshPreservesMutationErrorRef = useRef(false);
  const secretStatusLoadedRef = useRef(false);
  const currentProviderRef = useRef<AiProvider>("gemini");
  const pendingLyricsConnectionRef = useRef<LyricsSource | null>(null);
  const pendingSecretSaveRef = useRef<PendingSecretSave | null>(null);
  const primerReturnFocusRef = useRef<HTMLElement | null>(null);
  const connectionButtonRef = useRef<HTMLButtonElement>(null);
  const settingsCloseButtonRef = useRef<HTMLButtonElement>(null);
  const settingsDialogRef = useRef<HTMLElement>(null);
  const settingsOverlayRef = useRef<HTMLDivElement>(null);
  const [feedback, setFeedback] = useState<SaveFeedback>({
    tone: "neutral",
    message: "Ready",
  });

  const invalidateSettingsOperations = (nextOpen: boolean) => {
    settingsOpenRef.current = nextOpen;
    operationGenerationRef.current += 1;
    activeOperationRef.current = null;
    statusLoadAttemptedGenerationRef.current = -1;
    statusLoadRetryRemainingRef.current = 0;
    statusRefreshPreservesMutationErrorRef.current = false;
    if (!nextOpen) secretStatusLoadedRef.current = false;
  };

  const beginSettingsOperation = (): SettingsOperationToken | null => {
    if (!settingsOpenRef.current || activeOperationRef.current) return null;
    const operation = {
      generation: operationGenerationRef.current,
      operationId: nextOperationIdRef.current + 1,
    };
    nextOperationIdRef.current = operation.operationId;
    activeOperationRef.current = operation;
    setBusy(true);
    return operation;
  };

  const settingsOperationIsCurrent = (operation: SettingsOperationToken) =>
    isSettingsOperationCurrent(operation, {
      open: settingsOpenRef.current,
      generation: operationGenerationRef.current,
      operationId: activeOperationRef.current?.operationId ?? -1,
    });

  const finishSettingsOperation = (operation: SettingsOperationToken) => {
    if (!settingsOperationIsCurrent(operation)) return;
    activeOperationRef.current = null;
    setBusy(false);
    setOperationTick((current) => current + 1);
  };

  const requestSecretStatusRefresh = (preserveMutationError: boolean) => {
    secretStatusLoadedRef.current = false;
    statusLoadAttemptedGenerationRef.current = -1;
    statusLoadRetryRemainingRef.current = 1;
    statusRefreshPreservesMutationErrorRef.current = preserveMutationError;
    setSecretStatusLoaded(false);
  };

  const providerConnection = useProviderConnection({
    language: uiLang,
    onConnected: () => {
      setExpiredProviders(readProviderExpiryState());
      requestSecretStatusRefresh(false);
      setOperationTick((current) => current + 1);
    },
  });

  const closeSettings = () => {
    invalidateSettingsOperations(false);
    pendingSecretSaveRef.current = null;
    pendingLyricsConnectionRef.current = null;
    primerReturnFocusRef.current = null;
    void providerConnection.cancelConnection();
    onClose();
  };

  useLayoutEffect(() => {
    if (lastOpenPropRef.current === open) return;
    lastOpenPropRef.current = open;
    invalidateSettingsOperations(open);
  }, [open]);

  useEffect(() => {
    if (!open) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false;
      }
      pendingSecretSaveRef.current = null;
      pendingLyricsConnectionRef.current = null;
      primerReturnFocusRef.current = null;
      setPrimerOpen(false);
      void providerConnection.cancelConnection();
      return;
    }

    setActiveSection(normalizeSettingsSection(initialSection));
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;

    setSearchMode(getStoredGroundingSearchMode());
    const config = getStoredTranslationConfig();
    const chunkConfig = getStoredTranslationChunkConfig();
    currentProviderRef.current = config.provider;
    setLyricsSource(getStoredLyricsSource());
    setTranslationChunkMode(chunkConfig.mode);
    setTranslationChunkThreshold(chunkConfig.threshold);
    setTranslationChunkSize(chunkConfig.chunkSize);
    setProvider(config.provider);
    setModel(config.model);
    setApiReasoning(config.apiReasoning ?? "");
    setModelSelection(getAiModelSelection(config.provider, config.model));
    setBaseUrl(config.baseUrl || DEFAULT_LOCAL_AI_BASE_URLS[config.provider] || "");
    setStatus(EMPTY_SECRET_STATUS);
    setExpiredProviders(readProviderExpiryState());
    secretStatusLoadedRef.current = false;
    setSecretStatusLoaded(false);
    setSpotifySpDc("");
    setAppleMusicMediaUserToken("");
    setApiKey("");
    setBusy(false);
    setFeedback(
      isTauri()
        ? { tone: "neutral", message: "Credential store access not authorized" }
        : { tone: "neutral", message: "Preview mode" },
    );
  }, [initialSection, open, providerConnection.cancelConnection]);

  useEffect(() => {
    const isDesktop = isTauri();
    if (!canLoadSecretStatus({ open, isDesktop, primerAccepted })) return;
    if (secretStatusLoadedRef.current) return;
    const generation = operationGenerationRef.current;
    if (statusLoadAttemptedGenerationRef.current === generation) return;

    const operation = beginSettingsOperation();
    if (!operation) return;
    statusLoadAttemptedGenerationRef.current = generation;
    const preserveMutationError = statusRefreshPreservesMutationErrorRef.current;
    if (!preserveMutationError) {
      setFeedback({ tone: "saving", message: "Loading settings…" });
    }

    const loadSecretStatus = async () => {
      try {
        const nextStatus = await getSecretStatus();
        if (!settingsOperationIsCurrent(operation)) return;

        setStatus(nextStatus);
        secretStatusLoadedRef.current = true;
        statusLoadRetryRemainingRef.current = 0;
        setSecretStatusLoaded(true);
        setSpotifySpDc(nextStatus.spotifySpDc ? SECRET_MASK : "");
        setAppleMusicMediaUserToken(nextStatus.appleMusicMediaUserToken ? SECRET_MASK : "");
        setApiKey(
          getProviderApiKeyDisplayValue(currentProviderRef.current, nextStatus),
        );
        if (!preserveMutationError) {
          setFeedback({ tone: "success", message: "All changes saved" });
          clearError("settings");
        }
        statusRefreshPreservesMutationErrorRef.current = false;
      } catch (error) {
        if (!settingsOperationIsCurrent(operation)) return;
        if (statusLoadRetryRemainingRef.current > 0) {
          statusLoadRetryRemainingRef.current -= 1;
          statusLoadAttemptedGenerationRef.current = -1;
        }
        if (!preserveMutationError) {
          setFeedback({ tone: "neutral", message: "Ready" });
          reportError(error);
        }
      } finally {
        finishSettingsOperation(operation);
      }
    };

    void loadSecretStatus();
  }, [clearError, open, operationTick, primerAccepted, reportError]);

  useLayoutEffect(() => {
    settingsOpenRef.current = lastOpenPropRef.current;
    return () => {
      invalidateSettingsOperations(false);
      pendingSecretSaveRef.current = null;
      pendingLyricsConnectionRef.current = null;
      primerReturnFocusRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    const overlay = settingsOverlayRef.current;
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const background = overlay?.parentElement
      ? Array.from(overlay.parentElement.children)
          .filter((element): element is HTMLElement => (
            element instanceof HTMLElement && element !== overlay
          ))
          .map((element) => ({
            element,
            inert: element.inert,
            ariaHidden: element.getAttribute("aria-hidden"),
          }))
      : [];

    for (const { element } of background) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }
    const focusFrame = window.requestAnimationFrame(() => {
      // Preserve focus if the user has already started navigating the dialog.
      if (settingsDialogRef.current?.contains(document.activeElement)
        && document.activeElement !== settingsDialogRef.current) return;
      const firstControl = settingsDialogRef.current?.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR,
      ) ?? null;
      (settingsCloseButtonRef.current ?? firstControl ?? settingsDialogRef.current)?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      for (const { element, inert, ariaHidden } of background) {
        element.inert = inert;
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      }
      if (canReceiveFocus(opener)) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (primerOpen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSettings();
        return;
      }
      if (event.key !== "Tab") return;

      const dialog = settingsDialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(canReceiveFocus);
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
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [open, primerOpen]);

  const markSaving = () => setFeedback({ tone: "saving", message: "Saving…" });
  const markSaved = () => {
    setFeedback({ tone: "success", message: "All changes saved" });
    clearError("settings");
  };
  const markError = (error: unknown) => {
    setFeedback({ tone: "error", message: "Could not save changes. Try again." });
    reportError(error);
  };

  const saveLocalPreference = (save: () => void) => {
    markSaving();
    try {
      save();
      markSaved();
    } catch (error) {
      markError(error);
    }
  };

  const saveAiConfig = (nextModel = model, nextBaseUrl = baseUrl) => {
    saveLocalPreference(() => {
      saveTranslationConfig({
        provider,
        model: nextModel.trim() || DEFAULT_AI_MODELS[provider],
        baseUrl: usesAiBaseUrl(provider)
          ? nextBaseUrl.trim() || DEFAULT_LOCAL_AI_BASE_URLS[provider]
          : undefined,
      });
    });
  };

  const handleProviderChange = (value: string) => {
    const nextProvider = normalizeAiProvider(value);
    currentProviderRef.current = nextProvider;
    const storedModel = localStorage.getItem(`songdocent_ai_model_${nextProvider}`)?.trim();
    const nextModel = storedModel || DEFAULT_AI_MODELS[nextProvider];
    const storedBaseUrl = localStorage
      .getItem(`songdocent_ai_base_url_${nextProvider}`)
      ?.trim();
    const nextBaseUrl =
      storedBaseUrl || DEFAULT_LOCAL_AI_BASE_URLS[nextProvider] || "";

    setProvider(nextProvider);
    setModel(nextModel);
    setApiReasoning(getStoredApiReasoning(nextProvider, nextModel) ?? "");
    setModelSelection(getAiModelSelection(nextProvider, nextModel));
    setBaseUrl(nextBaseUrl);
    setApiKey(
      secretStatusLoadedRef.current
        ? getProviderApiKeyDisplayValue(nextProvider, status)
        : "",
    );
    saveLocalPreference(() => {
      saveTranslationConfig({
        provider: nextProvider,
        model: nextModel,
        baseUrl: usesAiBaseUrl(nextProvider) ? nextBaseUrl : undefined,
      });
    });
  };

  const handleModelSelectionChange = (value: string) => {
    if (!isCloudAiProvider(provider)) return;

    setModelSelection(value);
    if (value === CUSTOM_AI_MODEL_VALUE) {
      const customModel = getStoredCustomAiModel(provider);
      setModel(customModel);
      setApiReasoning(getStoredApiReasoning(provider, customModel) ?? "");
      return;
    }

    setModel(value);
    setApiReasoning(getStoredApiReasoning(provider, value) ?? "");
    saveAiConfig(value, baseUrl);
  };

  const handleCustomModelCommit = (value: string) => {
    if (!isCloudAiProvider(provider)) return;
    const nextModel = value.trim();
    if (!nextModel) return;

    setModel(nextModel);
    saveCustomAiModel(provider, nextModel);
    saveAiConfig(nextModel, baseUrl);
  };

  const handleLyricsSourceChange = (value: LyricsSource) => {
    if (value === lyricsSource) return;
    pendingLyricsConnectionRef.current = null;
    void providerConnection.cancelConnection();
    setLyricsSource(value);
    saveLocalPreference(() => saveLyricsSource(value));
  };

  const handleTranslationChunkConfigChange = (
    config: Partial<TranslationChunkConfig>,
  ) => {
    const nextConfig = normalizeTranslationChunkConfig({
      mode: config.mode ?? translationChunkMode,
      threshold: config.threshold ?? translationChunkThreshold,
      chunkSize: config.chunkSize ?? translationChunkSize,
    });
    setTranslationChunkMode(nextConfig.mode);
    setTranslationChunkThreshold(nextConfig.threshold);
    setTranslationChunkSize(nextConfig.chunkSize);
    saveLocalPreference(() => saveTranslationChunkConfig(nextConfig));
  };

  const handleUiLanguageChange = (value: LangCode) => {
    markSaving();
    setUiLang(value);
    markSaved();
  };

  const handleTargetLanguageChange = (value: string) => {
    markSaving();
    setTargetLang(value);
    markSaved();
  };

  const performSecretSave = async (
    kind: SecretKind,
    value: string,
    accessAuthorized: boolean,
  ) => {
    if (!accessAuthorized) return;
    if (!isTauri()) {
      if (settingsOpenRef.current) {
        setFeedback({ tone: "neutral", message: "Desktop app only" });
      }
      return;
    }

    const operation = beginSettingsOperation();
    if (!operation) return;
    let mutationFailed = false;
    markSaving();
    try {
      await saveSecretValue(kind, value);
      if (!settingsOperationIsCurrent(operation)) return;
      const lyricsProvider = lyricsSourceForSecretKind(kind);
      if (lyricsProvider) {
        clearProviderExpired(lyricsProvider);
        setExpiredProviders(readProviderExpiryState());
      }
    } catch (error) {
      if (!settingsOperationIsCurrent(operation)) return;
      mutationFailed = true;
      markError(error);
    } finally {
      if (settingsOperationIsCurrent(operation)) {
        requestSecretStatusRefresh(mutationFailed);
      }
      finishSettingsOperation(operation);
    }
  };

  const handleSecretSave = (
    kind: SecretKind,
    rawValue: string,
    returnFocusTo?: HTMLElement,
  ) => {
    if (
      activeOperationRef.current ||
      pendingSecretSaveRef.current ||
      rawValue === SECRET_MASK
    ) return;

    const transition = requestSecretSave({
      primerAccepted,
      kind,
      value: rawValue,
    });
    if (transition.pending) {
      pendingSecretSaveRef.current = transition.pending;
      primerReturnFocusRef.current = returnFocusTo ?? null;
      setPrimerOpen(true);
      setFeedback({ tone: "neutral", message: "Credential store access not authorized" });
      return;
    }
    if (transition.ready) {
      void performSecretSave(
        transition.ready.kind,
        transition.ready.value,
        primerAccepted,
      );
    }
  };

  const handleRequestLyricsConnection = () => {
    if (!primerAccepted) {
      pendingLyricsConnectionRef.current = lyricsSource;
      primerReturnFocusRef.current = connectionButtonRef.current;
      setPrimerOpen(true);
      return;
    }
    void providerConnection.requestConnection(lyricsSource);
  };

  const handlePrimerContinue = () => {
    onPrimerAccepted();
    const pendingConnection = pendingLyricsConnectionRef.current;
    pendingLyricsConnectionRef.current = null;
    const transition = acceptPendingSecretSave(pendingSecretSaveRef.current);
    pendingSecretSaveRef.current = transition.pending;
    setPrimerOpen(false);
    primerReturnFocusRef.current = null;
    if (pendingConnection) void providerConnection.requestConnection(pendingConnection);
    if (transition.ready) {
      void performSecretSave(transition.ready.kind, transition.ready.value, true);
    }
  };

  const handlePrimerCancel = () => {
    pendingLyricsConnectionRef.current = null;
    pendingSecretSaveRef.current = cancelPendingSecretSave(
      pendingSecretSaveRef.current,
    );
    setPrimerOpen(false);
    primerReturnFocusRef.current = null;
    setFeedback({
      tone: "neutral",
      message: "Cancelled",
    });
  };

  const handleClearSecret = async (kind: SecretKind) => {
    if (
      activeOperationRef.current ||
      !primerAccepted ||
      !secretStatusLoadedRef.current
    ) return;
    if (!isTauri()) {
      if (settingsOpenRef.current) {
        setFeedback({ tone: "neutral", message: "Desktop app only" });
      }
      return;
    }

    const operation = beginSettingsOperation();
    if (!operation) return;
    let refreshStatus = false;
    markSaving();
    try {
      await clearSecret(kind);
      if (!settingsOperationIsCurrent(operation)) return;
      const lyricsProvider = lyricsSourceForSecretKind(kind);
      if (lyricsProvider) {
        clearProviderExpired(lyricsProvider);
        setExpiredProviders(readProviderExpiryState());
      }
      refreshStatus = true;
    } catch (error) {
      if (!settingsOperationIsCurrent(operation)) return;
      markError(error);
    } finally {
      if (settingsOperationIsCurrent(operation) && refreshStatus) {
        requestSecretStatusRefresh(false);
      }
      finishSettingsOperation(operation);
    }
  };

  const handleOpenSetupGuide = () => {
    pendingSecretSaveRef.current = cancelPendingSecretSave(
      pendingSecretSaveRef.current,
    );
    setPrimerOpen(false);
    void providerConnection.cancelConnection();
    closeSettings();
    onOpenSetupGuide();
  };

  const handleTestConnection = async () => {
    if (!usesAiBaseUrl(provider) || activeOperationRef.current) return;
    if (!isTauri()) {
      if (settingsOpenRef.current) {
        setFeedback({ tone: "neutral", message: "Desktop app only" });
      }
      return;
    }

    const operation = beginSettingsOperation();
    if (!operation) return;
    const testedProvider = provider;
    markSaving();
    try {
      const result = await invoke<LocalAiConnectionStatus>(
        provider === "openai_compatible" ? "test_openai_compatible_connection" : "test_local_ai_connection", {
        provider,
        baseUrl: baseUrl.trim() || DEFAULT_LOCAL_AI_BASE_URLS[provider],
        model: model.trim() || DEFAULT_AI_MODELS[provider],
      });
      if (!settingsOperationIsCurrent(operation)) return;
      if (currentProviderRef.current !== testedProvider) {
        setFeedback({ tone: "neutral", message: "Ready" });
        return;
      }
      if (result.ok) {
        setFeedback({ tone: "success", message: "All changes saved" });
        clearError("settings");
      } else {
        setFeedback({ tone: "neutral", message: "Ready" });
        reportError({
          code: "LOCAL_AI_MODEL_NOT_FOUND",
          domain: "settings",
          retryable: false,
          technicalMessage: result.message,
        });
      }
    } catch (error) {
      if (!settingsOperationIsCurrent(operation)) return;
      if (currentProviderRef.current !== testedProvider) return;
      markError(error);
    } finally {
      finishSettingsOperation(operation);
    }
  };

  const blurOnEnter = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") event.currentTarget.blur();
  };

  const handleOverlayMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeSettings();
  };

  const activeKeyKind = secretKindForProvider(provider);
  const visibleStatus = secretStatusLoaded && primerAccepted
    ? status
    : EMPTY_SECRET_STATUS;
  const activeKeySaved = getProviderApiKeyDisplayValue(provider, visibleStatus) !== "";
  const setupCopy = setupCopyFor(uiLang, platform);
  const selectedProviderConnectionStatus =
    providerConnection.status?.provider === lyricsSource
      ? providerConnection.status
      : null;
  const selectedLyricsSecretSaved = lyricsSource === "spotify"
    ? visibleStatus.spotifySpDc
    : visibleStatus.appleMusicMediaUserToken;
  const lyricsConnectionBusy = providerConnection.isStarting ||
    providerConnection.riskModalOpen ||
    Boolean(
      selectedProviderConnectionStatus &&
        connectionNeedsPolling(selectedProviderConnectionStatus.phase),
    );
  const lyricsConnectionHasSession =
    selectedLyricsSecretSaved ||
    selectedProviderConnectionStatus?.phase === "connected";
  const selectedLyricsSessionExpired =
    selectedLyricsSecretSaved && expiredProviders[lyricsSource];
  const copy = settingsCopyFor(uiLang);
  const lyricsUi = { ...copy, title: copy.lyricsTitle, description: copy.lyricsDescription };
  const phase = selectedProviderConnectionStatus?.phase;
  const connectionFailed = phase === "timed_out" || phase === "recoverable_error" || phase === "terminal_error";
  const lyricsConnectionMessage = lyricsConnectionBusy
    ? (phase === "validating" ? lyricsUi.validating : lyricsUi.waiting)
    : selectedLyricsSessionExpired ? lyricsUi.expired
    : connectionFailed ? connectionStatusMessage(selectedProviderConnectionStatus, providerConnectionCopyFor(uiLang))
    : lyricsConnectionHasSession ? lyricsUi.connected
    : formatProviderCopy(lyricsUi.prompt, lyricsSource);
  const lyricsConnectionDisabled = busy || lyricsConnectionBusy || (primerAccepted && !secretStatusLoaded);
  const lyricsDisconnectDisabled = busy || !primerAccepted || !secretStatusLoaded || !selectedLyricsSecretSaved;
  const lyricsConnectionActionLabel = connectionFailed ? lyricsUi.retry
    : selectedLyricsSessionExpired ? lyricsUi.reconnect
    : formatProviderCopy(lyricsUi.login, lyricsSource);
  const lyricsConnectionNeedsLogin = !lyricsConnectionHasSession || selectedLyricsSessionExpired || connectionFailed;
  const secureStore = platformCopyFor(uiLang, platform).secureStore;
  const currentCopy = activeSection === "setup"
    ? {
        title: setupCopy.settingsGuide.title,
        description: setupCopy.settingsGuide.body,
      }
    : activeSection === "lyrics" ? lyricsUi
    : activeSection === "ai" ? { title: copy.aiTitle, description: copy.aiDescription }
    : activeSection === "language" ? { title: copy.languageTitle, description: copy.languageDescription }
    : { title: copy.updatesTitle, description: copy.updatesDescription };

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          ref={settingsOverlayRef}
          className="settings-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={handleOverlayMouseDown}
        >
          <motion.section
            ref={settingsDialogRef}
            className="settings-window"
            data-platform={platform}
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            aria-hidden={primerOpen || providerConnection.riskModalOpen ? true : undefined}
            inert={primerOpen || providerConnection.riskModalOpen ? true : undefined}
            tabIndex={-1}
            data-save-feedback={feedback.message}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.985 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <aside className="settings-rail">
              <div className="settings-brand">{copy.settings}</div>
              <nav className="settings-nav" role="tablist" aria-label={copy.settingsSections} aria-orientation="vertical">
                {SETTINGS_NAV.map(({ key }) => {
                  const selected = activeSection === key;
                  const localizedLabel = key === "setup"
                    ? setupCopy.settingsGuide.title
                    : ({ ai: "AI", lyrics: copy.navLyrics, language: copy.navLanguage, updates: copy.navUpdates })[key];
                  return (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`settings-tab-${key}`}
                      aria-controls="settings-panel"
                      tabIndex={selected ? 0 : -1}
                      aria-selected={selected}
                      className="settings-nav-item"
                      data-selected={selected}
                      onClick={() => setActiveSection(key)}
                      onKeyDown={(event) => {
                        const index = SETTINGS_NAV.findIndex((item) => item.key === key);
                        const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? SETTINGS_NAV.length - 1
                          : event.key === "ArrowDown" || event.key === "ArrowRight" ? (index + 1) % SETTINGS_NAV.length
                          : event.key === "ArrowUp" || event.key === "ArrowLeft" ? (index - 1 + SETTINGS_NAV.length) % SETTINGS_NAV.length : null;
                        if (nextIndex === null) return;
                        event.preventDefault();
                        const next = SETTINGS_NAV[nextIndex].key;
                        setActiveSection(next);
                        document.getElementById(`settings-tab-${next}`)?.focus();
                      }}
                    >
                      <span>{localizedLabel}</span>
                    </button>
                  );
                })}
              </nav>
            </aside>

            <div className="settings-detail">
              <header className="settings-header">
                <div className="settings-heading">
                  <h2 id="settings-title">{currentCopy.title}</h2>
                  <p>{currentCopy.description}</p>
                </div>
                <div className="settings-header-actions">
                  <SaveStatus feedback={feedback} uiLang={uiLang} cancelledMessage={setupCopy.validation.cancelled} />
                  <button
                    ref={settingsCloseButtonRef}
                    type="button"
                    className="settings-icon-button"
                    onClick={closeSettings}
                    aria-label={copy.closeSettings}
                    title={copy.closeSettings}
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              <div className="settings-content" role="tabpanel" id="settings-panel" aria-labelledby={`settings-tab-${activeSection}`} data-section={activeSection}>
                {!primerAccepted && activeSection === "ai" ? (
                  <details className="settings-storage-notice">
                    <summary><ShieldCheck size={15} aria-hidden="true" /><span>{setupCopy.screens.keychain.title}</span></summary>
                    <p>{setupCopy.screens.keychain.body}</p>
                  </details>
                ) : null}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeSection}
                    className="settings-pane"
                    data-section={activeSection}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                  >
                    {activeSection === "ai" ? (
                      <AiSettingsPane
                        uiLang={uiLang}
                        provider={provider}
                        model={model}
                        modelSelection={modelSelection}
                        baseUrl={baseUrl}
                        apiKey={apiKey}
                        busy={busy}
                        activeKeyKind={activeKeyKind}
                        activeKeySaved={activeKeySaved}
                        searchMode={searchMode}
                        onSearchModeChange={(mode) => {
                          setSearchMode(mode);
                          saveGroundingSearchMode(mode);
                          setFeedback({ tone: "success", message: "All changes saved" });
                        }}
                        onProviderChange={handleProviderChange}
                        onModelSelectionChange={handleModelSelectionChange}
                        apiReasoning={apiReasoning}
                        onApiReasoningChange={(value) => {
                          saveLocalPreference(() => saveApiReasoning(provider, model, value));
                          setApiReasoning(value);
                        }}
                        onModelChange={(value) => {
                          setModel(value);
                          setApiReasoning(getStoredApiReasoning(provider, value) ?? "");
                        }}
                        onBaseUrlChange={setBaseUrl}
                        onApiKeyChange={setApiKey}
                        onModelCommit={(value) => saveAiConfig(value, baseUrl)}
                        onCustomModelCommit={handleCustomModelCommit}
                        onBaseUrlCommit={(value) => saveAiConfig(model, value)}
                        onInputKeyDown={blurOnEnter}
                        onSecretBlur={(input) => {
                          if (activeKeyKind) {
                            handleSecretSave(activeKeyKind, apiKey, input);
                          }
                        }}
                        onClearSecret={() => {
                          if (activeKeyKind) void handleClearSecret(activeKeyKind);
                        }}
                        onTestConnection={() => void handleTestConnection()}
                        secureStore={secureStore}
                      />
                    ) : null}

                    {activeSection === "lyrics" ? (
                      <LyricsSettingsPane
                        uiLang={uiLang}
                        ui={lyricsUi}
                        setupCopy={setupCopy}
                        platform={platform}
                        connectionInProgress={lyricsConnectionBusy}
                        connectionNeedsLogin={lyricsConnectionNeedsLogin}
                        onCancelConnection={() => { void providerConnection.cancelConnection(); }}
                        source={lyricsSource}
                        spotifySpDc={spotifySpDc}
                        appleMusicMediaUserToken={appleMusicMediaUserToken}
                        translationChunkMode={translationChunkMode}
                        translationChunkThreshold={translationChunkThreshold}
                        translationChunkSize={translationChunkSize}
                        status={visibleStatus}
                        busy={busy}
                        connectionMessage={lyricsConnectionMessage}
                        connectionActionLabel={lyricsConnectionActionLabel}
                        connectionDisabled={lyricsConnectionDisabled}
                        disconnectDisabled={lyricsDisconnectDisabled}
                        connectionHasSession={lyricsConnectionHasSession}
                        connectionButtonRef={connectionButtonRef}
                        onSourceChange={handleLyricsSourceChange}
                        onRequestConnection={handleRequestLyricsConnection}
                        onDisconnect={() => {
                          void providerConnection.cancelConnection();
                          void handleClearSecret(lyricsSecretKindForSource(lyricsSource));
                        }}
                        onSpotifySpDcChange={setSpotifySpDc}
                        onAppleMusicTokenChange={setAppleMusicMediaUserToken}
                        onTranslationChunkModeChange={(value) =>
                          handleTranslationChunkConfigChange({ mode: value })
                        }
                        onTranslationChunkThresholdChange={(value) =>
                          handleTranslationChunkConfigChange({ threshold: value })
                        }
                        onTranslationChunkSizeChange={(value) =>
                          handleTranslationChunkConfigChange({ chunkSize: value })
                        }
                        onInputKeyDown={blurOnEnter}
                        onSpotifyBlur={(input) =>
                          handleSecretSave("spotify_sp_dc", spotifySpDc, input)
                        }
                        onAppleMusicBlur={(input) =>
                          handleSecretSave(
                            "apple_music_media_user_token",
                            appleMusicMediaUserToken,
                            input,
                          )
                        }
                        onClearSecret={(kind) => void handleClearSecret(kind)}
                      />
                    ) : null}

                    {activeSection === "language" ? (
                      <LanguageSettingsPane
                        uiLang={uiLang}
                        targetLang={targetLang}
                        onUiLangChange={handleUiLanguageChange}
                        onTargetLangChange={handleTargetLanguageChange}
                      />
                    ) : null}

                    {activeSection === "updates" ? <UpdateSettings lang={uiLang} /> : null}

                    {activeSection === "setup" ? (
                      <SetupGuideSettingsPane
                        buttonLabel={setupCopy.settingsGuide.button}
                        onOpen={handleOpenSetupGuide}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
          {primerOpen ? (
            <KeychainPrimer
              uiLang={uiLang}
              platform={platform}
              presentation="modal"
              onContinue={handlePrimerContinue}
              onCancel={handlePrimerCancel}
              returnFocusTo={primerReturnFocusRef.current}
              fallbackFocusTo={settingsCloseButtonRef.current}
            />
          ) : null}
          <ProviderConnectionRiskModal
            open={providerConnection.riskModalOpen}
            provider={providerConnection.pendingProvider}
            uiLang={uiLang}
            onConfirm={() => void providerConnection.confirmRiskAndConnect()}
            onCancel={providerConnection.dismissRisk}
            returnFocusTo={connectionButtonRef.current}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function SaveStatus({ feedback, uiLang, cancelledMessage }: { feedback: SaveFeedback; uiLang: LangCode; cancelledMessage: string }) {
  const copy = settingsCopyFor(uiLang);
  const message = feedback.message === "Cancelled" ? cancelledMessage : feedback.message === "Could not save changes. Try again." ? copy.saveError : feedback.message === "Credential store access not authorized" ? copy.storeUnauthorized : feedback.message;
  const IGNORED_MESSAGES = ["Ready", "Preview mode", "Desktop app only", "Saving…", "Loading settings…", "All changes saved"];
  if (IGNORED_MESSAGES.includes(feedback.message)) return null;

  const icon =
    feedback.tone === "success" ? (
      <Check size={13} aria-hidden="true" />
    ) : (
      <span className="settings-status-dot" aria-hidden="true" />
    );

  return (
    <span
      className="settings-save-status"
      data-tone={feedback.tone}
      aria-live="polite"
      title={message}
    >
      {icon}
      <span>{message}</span>
    </span>
  );
}

type AiSettingsPaneProps = {
  searchMode: GroundingSearchMode;
  onSearchModeChange: (mode: GroundingSearchMode) => void;
  uiLang: LangCode;
  provider: AiProvider;
  model: string;
  modelSelection: string;
  apiReasoning: string;
  onApiReasoningChange: (value: string) => void;
  baseUrl: string;
  apiKey: string;
  busy: boolean;
  activeKeyKind: SecretKind | null;
  activeKeySaved: boolean;
  onProviderChange: (provider: string) => void;
  onModelSelectionChange: (value: string) => void;
  onModelChange: (value: string) => void;
  onBaseUrlChange: (value: string) => void;
  onApiKeyChange: (value: string) => void;
  onModelCommit: (value: string) => void;
  onCustomModelCommit: (value: string) => void;
  onBaseUrlCommit: (value: string) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSecretBlur: (input: HTMLInputElement) => void;
  onClearSecret: () => void;
  onTestConnection: () => void;
  secureStore: string;
};

function AiSettingsPane({
  searchMode,
  onSearchModeChange,
  uiLang,
  provider,
  model,
  modelSelection,
  apiReasoning,
  onApiReasoningChange,
  baseUrl,
  apiKey,
  busy,
  activeKeyKind,
  activeKeySaved,
  onProviderChange,
  onModelSelectionChange,
  onModelChange,
  onBaseUrlChange,
  onApiKeyChange,
  onModelCommit,
  onCustomModelCommit,
  onBaseUrlCommit,
  onInputKeyDown,
  onSecretBlur,
  onClearSecret,
  onTestConnection,
  secureStore,
}: AiSettingsPaneProps) {
  const copy = settingsCopyFor(uiLang);
  const [linkFailed, setLinkFailed] = useState(false);
  useEffect(() => setLinkFailed(false), [provider]);
  const keyUrl = provider === "gemini" ? OFFICIAL_SETUP_DESTINATIONS.geminiApiKeyConsole
    : provider === "openai" ? OFFICIAL_SETUP_DESTINATIONS.openAiApiKeys
    : provider === "claude" ? OFFICIAL_SETUP_DESTINATIONS.claudeApiKeys : null;
  const providerIsLocal = isLocalAiProvider(provider);
  const modelCatalog = useCloudModels(provider, activeKeySaved);
  const reasoningOptions = getApiReasoningOptions(provider, model);
  const modelClassDescriptions = { fast: copy.modelFast, balanced: copy.modelBalanced, capable: copy.modelCapable };
  const currentModelMissing = modelSelection !== CUSTOM_AI_MODEL_VALUE && !modelCatalog.options.some(({ id }) => id === modelSelection);

  return (
    <AiConnectionPanel provider={provider} onProviderChange={onProviderChange} uiLang={uiLang}>
    <div className="settings-ai-layout">
      <div className="settings-form-grid settings-connection-fields">
        {providerIsLocal || provider === "openai_compatible" ? (
          <>
            <SettingsField label={copy.baseUrl} helper={providerIsLocal
              ? undefined
              : copy.baseUrlHelp}>
              <input
                value={baseUrl}
                onChange={(event) => onBaseUrlChange(event.target.value)}
                onBlur={(event) => onBaseUrlCommit(event.currentTarget.value)}
                onKeyDown={(event) => commitOnEnter(event, onBaseUrlCommit)}
                type="url"
                autoComplete="off"
                spellCheck={false}
                placeholder={providerIsLocal ? DEFAULT_LOCAL_AI_BASE_URLS[provider] : "https://api.example.com/v1"}
              />
            </SettingsField>
            <SettingsField label={copy.model} helper={providerIsLocal
              ? undefined
              : copy.modelHelp}>
              <input
                value={model}
                onChange={(event) => onModelChange(event.target.value)}
                onBlur={(event) => onModelCommit(event.currentTarget.value)}
                onKeyDown={(event) => commitOnEnter(event, onModelCommit)}
                type="text"
                autoComplete="off"
                spellCheck={false}
                placeholder={providerIsLocal ? DEFAULT_AI_MODELS[provider] : "model-id"}
              />
            </SettingsField>
            {provider === "openai_compatible" ? (
              <SettingsField label={copy.optionalApiKey} helper={formatSettingsCopy(copy.storedSecurely, { store: secureStore })}>
                <div className="settings-credential-row">
                  <input
                    value={apiKey}
                    onChange={(event) => onApiKeyChange(event.target.value)}
                    onBlur={(event) => onSecretBlur(event.currentTarget)}
                    onKeyDown={onInputKeyDown}
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={copy.apiKey}
                    disabled={busy || activeKeySaved}
                  />
                  {activeKeySaved && activeKeyKind ? (
                    <DeleteSecretButton
                      label={copy.clearCompatibleKey}
                      disabled={busy}
                      onClick={onClearSecret}
                    />
                  ) : null}
                </div>
              </SettingsField>
            ) : null}
            <div className="settings-connection-test">
              <button
                type="button"
                className="settings-test-button"
                onClick={onTestConnection}
                disabled={busy}
              >
                <CheckCircle2 size={16} />
                <span>{copy.testConnection}</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <SettingsField
              label={copy.model}
            >
              <div className="settings-select-wrap">
                <select
                  value={modelSelection}
                  onChange={(event) => onModelSelectionChange(event.target.value)}
                >
                  {modelCatalog.options.map(
                    (option) => {
                      const showGuidance = provider !== "gemini" || /^gemini-(flash-lite|flash|pro)-latest$/.test(option.id.replace(/^models\//, ""));
                      const modelClass = showGuidance ? getAiModelClass(provider, option.id) : null;
                      return (
                        <option key={option.id} value={option.id}>
                          {option.label}{modelClass ? ` · ${modelClassDescriptions[modelClass]}` : ""}
                        </option>
                      );
                    },
                  )}
                  {currentModelMissing ? <option value={modelSelection}>{modelSelection} — {copy.currentSelection}</option> : null}
                  <option value={CUSTOM_AI_MODEL_VALUE}>{copy.custom}</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              <div className="settings-model-tools">
                <button type="button" className="settings-inline-link" aria-label={copy.refreshModelList}
                  aria-busy={modelCatalog.loading}
                  disabled={busy || !activeKeySaved || modelCatalog.loading} onClick={modelCatalog.refresh}>
                  <RefreshCw size={13} aria-hidden="true" /> {copy.refreshModels}
                </button>
                <span className="settings-helper" role="status">
                  {modelCatalog.loading ? copy.updatingModels
                    : modelCatalog.failed ? copy.updateModelsFailed
                    : !activeKeySaved ? copy.saveKeyToLoadModels : null}
                </span>
              </div>
            </SettingsField>

            {modelSelection === CUSTOM_AI_MODEL_VALUE ? (
              <SettingsField
                label={copy.customModel}
                helper={copy.customModelHelp}
              >
                <input
                  value={model}
                  onChange={(event) => onModelChange(event.target.value)}
                  onBlur={(event) => onCustomModelCommit(event.currentTarget.value)}
                  onKeyDown={(event) => commitOnEnter(event, onCustomModelCommit)}
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="model-id"
                />
              </SettingsField>
            ) : null}

            <SettingsField
              label={`${aiProviderLabel(provider, uiLang)} ${copy.apiKey}`}
              helper={activeKeySaved ? formatSettingsCopy(copy.savedSecurely, { store: secureStore }) : formatSettingsCopy(copy.storedSecurely, { store: secureStore })}
            >
              <div className="settings-credential-row">
                <input
                  value={apiKey}
                  onChange={(event) => onApiKeyChange(event.target.value)}
                  onBlur={(event) => onSecretBlur(event.currentTarget)}
                  onKeyDown={onInputKeyDown}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={`${aiProviderLabel(provider, uiLang)} ${copy.apiKey}`}
                  disabled={busy || activeKeySaved}
                />
                {activeKeySaved && activeKeyKind ? (
                  <DeleteSecretButton
                    label={formatSettingsCopy(copy.clearProviderKey, { provider: aiProviderLabel(provider, uiLang) })}
                    disabled={busy}
                    onClick={onClearSecret}
                  />
                ) : null}
              </div>
            </SettingsField>
          </>
        )}
        {isCloudAiProvider(provider) ? (
          <SettingsField label={aiCopy[uiLang].reasoning} helper={reasoningOptions.length ? undefined : copy.apiReasoningUnavailable}>
            <div className="settings-select-wrap">
              <select
                aria-label={aiCopy[uiLang].reasoning}
                value={reasoningOptions.includes(apiReasoning) ? apiReasoning : ""}
                disabled={busy || !reasoningOptions.length}
                onChange={(event) => onApiReasoningChange(event.target.value)}
              >
                <option value="">{copy.apiReasoningDefault}</option>
                {reasoningOptions.map((level) => (
                  <option key={level} value={level}>{reasoningLabel(level, aiCopy[uiLang])}</option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </SettingsField>
        ) : null}
        {supportsGroundingSearch(provider, model) ? (
          <SettingsField label={copy.webSearch}>
            <div className="settings-select-wrap">
              <select aria-label={copy.webSearch} value={searchMode} disabled={busy}
                onChange={(event) => onSearchModeChange(event.target.value as GroundingSearchMode)}>
                <option value="translation">{copy.searchTranslation}</option>
                <option value="annotation">{copy.searchAnnotations}</option>
                <option value="off">{copy.searchOff}</option>
              </select>
              <ChevronDown size={16} aria-hidden="true" />
            </div>
          </SettingsField>
        ) : null}
      </div>
      {keyUrl || linkFailed ? <div className="settings-save-guidance">
        {keyUrl ? <a href={keyUrl} target="_blank" rel="noreferrer" className="settings-inline-link" onClick={(event) => {
          if (!isTauri()) return;
          event.preventDefault();
          setLinkFailed(false);
          void openUrl(keyUrl).catch(() => setLinkFailed(true));
        }}>{copy.getApiKey} ↗</a> : null}
        {linkFailed ? <p role="alert">{copy.openLinkFailed}</p> : null}
      </div> : null}
    </div>
    </AiConnectionPanel>
  );
}

type LyricsSettingsPaneProps = {
  uiLang: LangCode;
  ui: ReturnType<typeof settingsCopyFor> & { title: string; description: string };
  setupCopy: SetupCopy;
  platform: DesktopPlatform;
  connectionInProgress: boolean;
  connectionNeedsLogin: boolean;
  onCancelConnection: () => void;
  source: LyricsSource;
  spotifySpDc: string;
  appleMusicMediaUserToken: string;
  translationChunkMode: TranslationChunkMode;
  translationChunkThreshold: number;
  translationChunkSize: number;
  status: SecretStatus;
  busy: boolean;
  connectionMessage: string | null;
  connectionActionLabel: string;
  connectionDisabled: boolean;
  disconnectDisabled: boolean;
  connectionHasSession: boolean;
  connectionButtonRef: RefObject<HTMLButtonElement | null>;
  onSourceChange: (source: LyricsSource) => void;
  onRequestConnection: () => void;
  onDisconnect: () => void;
  onSpotifySpDcChange: (value: string) => void;
  onAppleMusicTokenChange: (value: string) => void;
  onTranslationChunkModeChange: (value: TranslationChunkMode) => void;
  onTranslationChunkThresholdChange: (value: number) => void;
  onTranslationChunkSizeChange: (value: number) => void;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onSpotifyBlur: (input: HTMLInputElement) => void;
  onAppleMusicBlur: (input: HTMLInputElement) => void;
  onClearSecret: (kind: SecretKind) => void;
};

function LyricsSettingsPane({
  uiLang,
  ui,
  setupCopy,
  platform,
  connectionInProgress,
  connectionNeedsLogin,
  onCancelConnection,
  source,
  spotifySpDc,
  appleMusicMediaUserToken,
  translationChunkMode,
  translationChunkThreshold,
  translationChunkSize,
  status,
  busy,
  connectionMessage,
  connectionActionLabel,
  connectionDisabled,
  disconnectDisabled,
  connectionHasSession,
  connectionButtonRef,
  onSourceChange,
  onRequestConnection,
  onDisconnect,
  onSpotifySpDcChange,
  onAppleMusicTokenChange,
  onTranslationChunkModeChange,
  onTranslationChunkThresholdChange,
  onTranslationChunkSizeChange,
  onInputKeyDown,
  onSpotifyBlur,
  onAppleMusicBlur,
  onClearSecret,
}: LyricsSettingsPaneProps) {
  const copy = settingsCopyFor(uiLang);
  const [manualBrowser, setManualBrowser] = useState<"chrome" | "safari">("chrome");
  const manualGuideId = source === "spotify"
    ? manualBrowser === "safari" ? "spotifySafari" : "spotifyChrome"
    : manualBrowser === "safari" ? "appleMusicSafari" : "appleMusicChrome";
  const spotifySelected = source === "spotify";
  const chunkingEnabled = translationChunkMode !== "off";
  const chunkingSummary = translationChunkMode === "auto"
    ? formatSettingsCopy(copy.autoSummary, { threshold: translationChunkThreshold, size: translationChunkSize })
    : translationChunkMode === "always"
      ? formatSettingsCopy(copy.alwaysSummary, { size: translationChunkSize })
      : copy.translateAll;

  return (
    <>
      <div className="settings-lyrics-service-tabs" role="group" aria-label={ui.service}>
          {LYRICS_SOURCE_OPTIONS.map(({ key, label }) => {
            const selected = source === key;
            return (
              <button
                key={key}
                type="button"
                className="settings-lyrics-service-tab"
                data-selected={selected}
                aria-pressed={selected}
                onClick={() => onSourceChange(key)}
              >
                <span>{label}</span>
              </button>
            );
          })}
      </div>

      <div className="settings-section-divider" />

      <div className="settings-provider-connection-card">
        <div className="settings-provider-connection-summary">
          <div className="settings-provider-connection-heading">
            <h3>{spotifySelected ? "Spotify" : "Apple Music"}</h3>
          </div>
          <p className="settings-provider-storage-note">
            <span aria-live="polite" aria-atomic="true">{connectionMessage}</span>
            <br />
            {ui.storage}
          </p>
        </div>
        <div className="settings-provider-connection-actions">
          {connectionNeedsLogin || connectionInProgress ? (
            <button
              ref={connectionButtonRef}
              type="button"
              className="provider-connection-action settings-provider-connection-primary"
              disabled={connectionDisabled}
              onClick={onRequestConnection}
            >
              {connectionInProgress ? ui.progress : connectionActionLabel}
            </button>
          ) : null}
          {connectionInProgress ? (
            <button
              type="button"
              className="provider-connection-action settings-provider-connection-cancel"
              onClick={onCancelConnection}
            >
              {ui.cancel}
            </button>
          ) : null}
          {connectionHasSession && !connectionInProgress ? (
            <button
              type="button"
              className="provider-connection-action settings-provider-connection-secondary"
              disabled={disconnectDisabled}
              onClick={onDisconnect}
            >
              {ui.disconnect}
            </button>
          ) : null}
        </div>
      </div>

      <details className="credential-troubleshooting">
        <summary>{ui.trouble}</summary>
        <p>{ui.help}</p>
        <div className="credential-manual-content">
          {spotifySelected ? (
            <SettingsField
              label={copy.spotifyCookie}
              helper={ui.manualHelper}
            >
              <div className="settings-credential-row">
                <input
                  value={spotifySpDc}
                  onChange={(event) => onSpotifySpDcChange(event.target.value)}
                  onBlur={(event) => onSpotifyBlur(event.currentTarget)}
                  onKeyDown={onInputKeyDown}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="sp_dc"
                  disabled={busy || status.spotifySpDc}
                />
                {status.spotifySpDc ? (
                  <DeleteSecretButton
                    label={copy.clearSpotify}
                    disabled={busy}
                    onClick={() => onClearSecret("spotify_sp_dc")}
                  />
                ) : null}
              </div>
            </SettingsField>
          ) : (
            <SettingsField
              label={copy.appleToken}
              helper={ui.manualHelper}
            >
              <div className="settings-credential-row">
                <input
                  value={appleMusicMediaUserToken}
                  onChange={(event) => onAppleMusicTokenChange(event.target.value)}
                  onBlur={(event) => onAppleMusicBlur(event.currentTarget)}
                  onKeyDown={onInputKeyDown}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="media-user-token"
                  disabled={busy || status.appleMusicMediaUserToken}
                />
                {status.appleMusicMediaUserToken ? (
                  <DeleteSecretButton
                    label={copy.clearApple}
                    disabled={busy}
                    onClick={() => onClearSecret("apple_music_media_user_token")}
                  />
                ) : null}
              </div>
            </SettingsField>
          )}
          <div className="credential-guide-browser-options" role="group" aria-label={setupCopy.guides[manualGuideId].title}>
            {setupBrowsersFor(platform).map((browser) => (
              <button
                key={browser}
                type="button"
                className="settings-choice"
                data-selected={manualBrowser === browser}
                aria-pressed={manualBrowser === browser}
                onClick={() => setManualBrowser(browser)}
              >
                {setupCopy.browserTabs[browser]}
              </button>
            ))}
          </div>
          <SetupGuide guideId={manualGuideId} copy={setupCopy} />
        </div>
      </details>

      <div className="settings-section-divider" />

      <section className="translation-stability-panel" aria-labelledby="translation-settings-title">
        <h3 id="translation-settings-title" className="settings-group-title">{copy.lyricTranslation}</h3>
        <div className="translation-chunk-toggle-row">
          <div className="translation-stability-copy">
            <h3 id="translation-chunk-title">{copy.splitLong}</h3>
            <p id="translation-chunk-description">
              {copy.splitHelp}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            className="settings-switch"
            aria-checked={chunkingEnabled}
            aria-labelledby="translation-chunk-title"
            aria-describedby="translation-chunk-description translation-chunk-summary"
            onClick={() => onTranslationChunkModeChange(chunkingEnabled ? "off" : "auto")}
          >
            <span className="settings-switch-thumb" />
          </button>
        </div>

        <p id="translation-chunk-summary" className="translation-chunk-summary" aria-live="polite">
          {chunkingSummary}
        </p>

        <details className="translation-chunk-details">
          <summary>{copy.advanced}</summary>
          <div className="translation-chunk-sliders">
            {chunkingEnabled ? (
              <>
                <label className="translation-chunk-always">
                  <input
                    type="checkbox"
                    checked={translationChunkMode === "always"}
                    onChange={(event) =>
                      onTranslationChunkModeChange(event.currentTarget.checked ? "always" : "auto")
                    }
                  />
                  <span>
                    <span className="settings-label">{copy.alwaysSplit}</span>
                    <span className="translation-chunk-option-helper">
                      {copy.alwaysSplitHelp}
                    </span>
                  </span>
                </label>
                {translationChunkMode === "auto" ? (
                  <RangeSetting
                    label={copy.splitThreshold}
                    value={translationChunkThreshold}
                    suffix={copy.linesOrMore}
                    min={MIN_TRANSLATION_CHUNK_THRESHOLD}
                    max={MAX_TRANSLATION_CHUNK_THRESHOLD}
                    step={5}
                    disabled={false}
                    onChange={onTranslationChunkThresholdChange}
                  />
                ) : null}
                <RangeSetting
                  label={copy.linesPerGroup}
                  value={translationChunkSize}
                  suffix={copy.lines}
                  min={MIN_TRANSLATION_CHUNK_SIZE}
                  max={MAX_TRANSLATION_CHUNK_SIZE}
                  step={5}
                  disabled={false}
                  onChange={onTranslationChunkSizeChange}
                />
                <p className="translation-stability-warning">
                  {copy.chunkWarning}
                </p>
              </>
            ) : (
              <p className="translation-stability-warning">
                {copy.chunkDisabledHelp}
              </p>
            )}
          </div>
        </details>
      </section>


    </>
  );
}

function LanguageSettingsPane({
  uiLang,
  targetLang,
  onUiLangChange,
  onTargetLangChange,
}: {
  uiLang: LangCode;
  targetLang: string;
  onUiLangChange: (value: LangCode) => void;
  onTargetLangChange: (value: string) => void;
}) {
  const copy = settingsCopyFor(uiLang);
  return (
    <div className="settings-form-grid settings-language-fields">
      <SettingsField label={copy.appLanguage}>
        <div className="settings-select-wrap">
          <select
            value={uiLang}
            onChange={(event) => onUiLangChange(event.target.value as LangCode)}
          >
            {LANG_OPTIONS.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown size={16} aria-hidden="true" />
        </div>
      </SettingsField>

      <SettingsField label={copy.targetLanguage} htmlFor="settings-target-language">
        <TranslationLanguageSelect
          id="settings-target-language"
          value={targetLang}
          onChange={onTargetLangChange}
          uiLang={uiLang}
          label={copy.targetLanguage}
        />
      </SettingsField>
    </div>
  );
}

function SetupGuideSettingsPane({
  buttonLabel,
  onOpen,
}: {
  buttonLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      className="settings-test-button settings-reopen-guide"
      onClick={onOpen}
    >
      {buttonLabel}
    </button>
  );
}

function RangeSetting({
  label,
  value,
  suffix,
  min,
  max,
  step,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  step: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settings-range-field" data-disabled={disabled}>
      <span className="settings-range-heading">
        <span className="settings-label">{label}</span>
        <span className="settings-value-badge">
          {value}
          {suffix}
        </span>
      </span>
      <input
        className="settings-range"
        value={value}
        onChange={(event) => {
          const nextValue = event.currentTarget.valueAsNumber;
          if (Number.isFinite(nextValue)) onChange(nextValue);
        }}
        type="range"
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </label>
  );
}

function SettingsField({
  htmlFor,
  label,
  helper,
  badge,
  children,
}: {
  htmlFor?: string;
  label: string;
  helper?: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  const FieldTag = htmlFor ? "div" : "label";
  return (
    <FieldTag className="settings-field">
      <span className="settings-field-copy">
        <span className="settings-field-heading">
          {htmlFor ? <label className="settings-label" htmlFor={htmlFor}>{label}</label> : <span className="settings-label">{label}</span>}
          {badge}
        </span>
      </span>
      <span className="settings-field-control">
        {helper ? <span className="settings-helper">{helper}</span> : null}
        {children}
      </span>
    </FieldTag>
  );
}

function DeleteSecretButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="settings-delete-button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <Trash2 size={16} />
    </button>
  );
}
