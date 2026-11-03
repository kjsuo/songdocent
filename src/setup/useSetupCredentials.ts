import { normalizeAppError, type AppError } from "../appError";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  CLOUD_AI_MODEL_OPTIONS,
  DEFAULT_AI_MODELS,
  configForProvider,
  getStoredLyricsSource,
  getStoredTranslationConfig,
  isCloudAiProvider,
  saveLyricsSource,
  saveTranslationConfig,
  type CloudAiProvider,
  type LyricsSource,
  type SecretStatus,
} from "../settings";
import {
  getSecretStatus,
  isDesktopRuntime,
  saveSecret,
  validateCredential,
  type SecretKind,
  type ValidationStatus,
} from "./secretClient";
import {
  canContinueAi,
  canContinueLyrics,
  secretKindForAiProvider,
  secretKindForLyricsSource,
  secretStatusForKind,
  type SetupStep,
} from "./setupState";

type CredentialUiState = {
  value: string;
  validationStatus: ValidationStatus | null;
  savedAnyway: boolean;
  saveFailed: boolean;
  busy: boolean;
};

const EMPTY_SECRET_STATUS: SecretStatus = {
  spotifySpDc: false,
  appleMusicMediaUserToken: false,
  openaiApiKey: false,
  geminiApiKey: false,
  claudeApiKey: false,
  openaiCompatibleApiKey: false,
};

const emptyCredentialState = (): CredentialUiState => ({
  value: "",
  validationStatus: null,
  savedAnyway: false,
  saveFailed: false,
  busy: false,
});

const withSavedSecret = (
  status: SecretStatus,
  kind: SecretKind,
): SecretStatus => {
  switch (kind) {
    case "spotify_sp_dc":
      return { ...status, spotifySpDc: true };
    case "apple_music_media_user_token":
      return { ...status, appleMusicMediaUserToken: true };
    case "gemini_api_key":
      return { ...status, geminiApiKey: true };
    case "openai_api_key":
      return { ...status, openaiApiKey: true };
    case "claude_api_key":
      return { ...status, claudeApiKey: true };
    case "openai_compatible_api_key":
      return { ...status, openaiCompatibleApiKey: true };
  }
};

const initialLyricsSource = (): LyricsSource => {
  try {
    return getStoredLyricsSource();
  } catch {
    return "spotify";
  }
};

const readCloudSetupConfig = (
  provider?: CloudAiProvider,
): { provider: CloudAiProvider; model: string } => {
  try {
    const stored = provider ? configForProvider(provider) : getStoredTranslationConfig();
    if (isCloudAiProvider(stored.provider)) {
      return {
        provider: stored.provider,
        model: CLOUD_AI_MODEL_OPTIONS[stored.provider].some(({ id }) => id === stored.model)
          ? stored.model
          : DEFAULT_AI_MODELS[stored.provider],
      };
    }
  } catch {}
  const fallback = provider ?? "gemini";
  return { provider: fallback, model: DEFAULT_AI_MODELS[fallback] };
};

export function useSetupCredentials({
  primerAccepted,
  step,
}: {
  primerAccepted: boolean;
  step: SetupStep;
}) {
  const [lyricsSource, setLyricsSource] = useState<LyricsSource>(initialLyricsSource);
  const [cloudConfig] = useState(readCloudSetupConfig);
  const [aiProvider, setAiProvider] = useState<CloudAiProvider>(cloudConfig.provider);
  const [aiModel, setAiModel] = useState(cloudConfig.model);
  const [secretStatusError, setSecretStatusError] = useState<AppError | null>(null);
  const [secretStatus, setSecretStatus] = useState<SecretStatus>(EMPTY_SECRET_STATUS);
  const [lyricsCredential, setLyricsCredential] = useState<CredentialUiState>(emptyCredentialState);
  const [aiCredential, setAiCredential] = useState<CredentialUiState>(emptyCredentialState);
  const statusLoadAttemptedRef = useRef(false);
  const statusRevisionRef = useRef(0);
  const activeOperationRef = useRef(0);
  const operationBusyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeOperationRef.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!primerAccepted || step === "welcome" || statusLoadAttemptedRef.current) return;
    let desktop = false;
    try {
      desktop = isDesktopRuntime();
    } catch {
      desktop = false;
    }
    statusLoadAttemptedRef.current = true;
    if (!desktop) {
      setSecretStatus(EMPTY_SECRET_STATUS);
      return;
    }

    const requestedRevision = statusRevisionRef.current;
    void getSecretStatus()
      .then((nextStatus) => {
        if (
          mountedRef.current &&
          statusRevisionRef.current === requestedRevision
        ) {
          setSecretStatus(nextStatus);
          setSecretStatusError(null);
        }
      })
      .catch((error) => {
        if (
          mountedRef.current &&
          statusRevisionRef.current === requestedRevision
        ) {
          setSecretStatusError(normalizeAppError(error));
        }
      });
  }, [primerAccepted, step]);

  const cancelOperations = () => {
    activeOperationRef.current += 1;
    operationBusyRef.current = false;
  };

  const refreshSecretStatus = useCallback(async () => {
    let desktop = false;
    try {
      desktop = isDesktopRuntime();
    } catch {
      desktop = false;
    }
    if (!desktop) return false;

    const requestedRevision = statusRevisionRef.current + 1;
    statusRevisionRef.current = requestedRevision;
    try {
      const nextStatus = await getSecretStatus();
      if (
        mountedRef.current &&
        statusRevisionRef.current === requestedRevision
      ) {
        setSecretStatus(nextStatus);
        setSecretStatusError(null);
        return true;
      }
    } catch (error) {
      if (mountedRef.current && statusRevisionRef.current === requestedRevision) {
        setSecretStatusError(normalizeAppError(error));
      }
      // Preserve the last confirmed local state when a refresh is unavailable.
    }
    return false;
  }, []);

  const selectLyricsSource = (source: LyricsSource) => {
    if (lyricsCredential.busy) return;
    cancelOperations();
    setLyricsSource(source);
    setLyricsCredential(emptyCredentialState());
    try {
      saveLyricsSource(source);
    } catch {
      // Keep the in-memory selection usable when storage is unavailable.
    }
  };

  const selectAiProvider = (provider: CloudAiProvider) => {
    if (aiCredential.busy) return;
    cancelOperations();
    const { model } = readCloudSetupConfig(provider);
    setAiProvider(provider);
    setAiModel(model);
    setAiCredential(emptyCredentialState());
    persistAiConfig(provider, model);
  };

  const persistAiConfig = (
    provider: CloudAiProvider = aiProvider,
    model: string = aiModel,
  ) => {
    try {
      saveTranslationConfig({ provider, model });
    } catch {
      // Keep the in-memory selection usable when storage is unavailable.
    }
  };

  const selectAiModel = (model: string) => {
    setAiModel(model);
    persistAiConfig(aiProvider, model);
  };

  const saveValidatedCredential = async ({
    kind,
    value,
    validationStatus,
    savedAnyway,
    operationId,
    setCredential,
    onSaved,
  }: {
    kind: SecretKind;
    value: string;
    validationStatus: ValidationStatus;
    savedAnyway: boolean;
    operationId: number;
    setCredential: Dispatch<SetStateAction<CredentialUiState>>;
    onSaved?: () => void;
  }) => {
    try {
      await saveSecret(kind, value);
    } catch {
      if (activeOperationRef.current !== operationId || !mountedRef.current) return;
      setCredential((current) => ({
        ...current,
        validationStatus: null,
        savedAnyway: false,
        saveFailed: true,
        busy: false,
      }));
      operationBusyRef.current = false;
      return;
    }

    if (activeOperationRef.current !== operationId || !mountedRef.current) return;
    const savedRevision = statusRevisionRef.current + 1;
    statusRevisionRef.current = savedRevision;
    setSecretStatus((current) => withSavedSecret(current, kind));
    onSaved?.();
    setCredential({
      value: "",
      validationStatus,
      savedAnyway,
      saveFailed: false,
      busy: false,
    });
    operationBusyRef.current = false;

    try {
      const nextStatus = await getSecretStatus();
      if (
        mountedRef.current &&
        statusRevisionRef.current === savedRevision
      ) {
        setSecretStatus(withSavedSecret(nextStatus, kind));
      }
    } catch {
      // The Keychain write already succeeded. Keep the local saved state and
      // let a later settings/status load reconcile the remaining secret flags.
    }
  };

  const validateAndSave = async ({
    kind,
    credential,
    setCredential,
    onSaved,
  }: {
    kind: SecretKind;
    credential: CredentialUiState;
    setCredential: Dispatch<SetStateAction<CredentialUiState>>;
    onSaved?: () => void;
  }) => {
    const value = credential.value.trim();
    if (!value || operationBusyRef.current) return;
    operationBusyRef.current = true;
    const operationId = activeOperationRef.current + 1;
    activeOperationRef.current = operationId;
    setCredential((current) => ({
      ...current,
      validationStatus: null,
      savedAnyway: false,
      saveFailed: false,
      busy: true,
    }));

    try {
      const result = await validateCredential(kind, value);
      if (activeOperationRef.current !== operationId || !mountedRef.current) return;
      if (result.status !== "valid") {
        setCredential((current) => ({
          ...current,
          validationStatus: result.status,
          savedAnyway: false,
          saveFailed: false,
          busy: false,
        }));
        operationBusyRef.current = false;
        return;
      }
      await saveValidatedCredential({
        kind,
        value,
        validationStatus: "valid",
        savedAnyway: false,
        operationId,
        setCredential,
        onSaved,
      });
    } catch {
      if (activeOperationRef.current !== operationId || !mountedRef.current) return;
      setCredential((current) => ({
        ...current,
        validationStatus: "unavailable",
        savedAnyway: false,
        saveFailed: false,
        busy: false,
      }));
      operationBusyRef.current = false;
    }
  };

  const saveAnyway = async ({
    kind,
    credential,
    setCredential,
    onSaved,
  }: {
    kind: SecretKind;
    credential: CredentialUiState;
    setCredential: Dispatch<SetStateAction<CredentialUiState>>;
    onSaved?: () => void;
  }) => {
    const value = credential.value.trim();
    if (
      !value ||
      credential.validationStatus !== "unavailable" ||
      operationBusyRef.current
    ) {
      return;
    }
    operationBusyRef.current = true;
    const operationId = activeOperationRef.current + 1;
    activeOperationRef.current = operationId;
    setCredential((current) => ({ ...current, busy: true, saveFailed: false }));
    await saveValidatedCredential({
      kind,
      value,
      validationStatus: "unavailable",
      savedAnyway: true,
      operationId,
      setCredential,
      onSaved,
    });
  };

  const lyricsKind = secretKindForLyricsSource(lyricsSource);
  const aiKind = secretKindForAiProvider(aiProvider);
  const hasLyricsDraft = Boolean(lyricsCredential.value.trim());
  const hasAiDraft = Boolean(aiCredential.value.trim());
  const lyricsSaved = !hasLyricsDraft && canContinueLyrics({
    source: lyricsSource,
    secretStatus,
    validationStatus: lyricsCredential.validationStatus,
    savedAnyway: lyricsCredential.savedAnyway,
    saveFailed: lyricsCredential.saveFailed,
  });
  const aiSaved = !hasAiDraft && canContinueAi({
    provider: aiProvider,
    secretStatus,
    validationStatus: aiCredential.validationStatus,
    savedAnyway: aiCredential.savedAnyway,
    saveFailed: aiCredential.saveFailed,
  });

  const setCredentialValue = (
    setCredential: Dispatch<SetStateAction<CredentialUiState>>,
    value: string,
  ) => setCredential((current) => ({
    ...current,
    value,
    validationStatus: null,
    savedAnyway: false,
    saveFailed: false,
  }));

  return {
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
    aiSaved,
    isLyricsSecretSaved: !hasLyricsDraft && secretStatusForKind(lyricsKind, secretStatus),
    isAiSecretSaved: !hasAiDraft && secretStatusForKind(aiKind, secretStatus),
    setLyricsCredentialValue: (value: string) => setCredentialValue(setLyricsCredential, value),
    setAiCredentialValue: (value: string) => setCredentialValue(setAiCredential, value),
    validateLyrics: () => validateAndSave({
      kind: lyricsKind,
      credential: lyricsCredential,
      setCredential: setLyricsCredential,
    }),
    validateAi: () => validateAndSave({
      kind: aiKind,
      credential: aiCredential,
      setCredential: setAiCredential,
      onSaved: persistAiConfig,
    }),
    saveLyricsAnyway: () => saveAnyway({
      kind: lyricsKind,
      credential: lyricsCredential,
      setCredential: setLyricsCredential,
    }),
    saveAiAnyway: () => saveAnyway({
      kind: aiKind,
      credential: aiCredential,
      setCredential: setAiCredential,
      onSaved: persistAiConfig,
    }),
    confirmAiConfig: persistAiConfig,
    refreshSecretStatus,
    cancelOperations,
  };
}
