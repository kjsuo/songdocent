import translationLanguages from "../translationLanguages.json" with { type: "json" };
import type { CloudAiProvider, SecretStatus } from "../settings";
import type { SecretKind, ValidationStatus } from "./secretClient";

export type SetupDisposition = "pending" | "completed" | "skipped";
export type SetupCompletionMode = "first-run" | "reentry";
export type SetupStep =
  | "welcome"
  | "keychain"
  | "lyrics"
  | "ai"
  | "language"
  | "review";

export type SetupStorage = Pick<Storage, "getItem" | "setItem">;
export type CredentialLyricsSource = "spotify" | "apple_music";

export type SetupCredentialProgress = {
  secretStatus: SecretStatus;
  validationStatus: ValidationStatus | null;
  savedAnyway: boolean;
  saveFailed: boolean;
};

export type CredentialAccess = {
  primerAccepted: boolean;
};

export type SecretStatusAccess = CredentialAccess & {
  open: boolean;
  isDesktop: boolean;
};

export type PendingSecretSave = {
  kind: SecretKind;
  value: string;
};

export type SecretSaveTransition = {
  pending: PendingSecretSave | null;
  ready: PendingSecretSave | null;
};

export type CredentialBackedLyricsFetch = {
  credentialsEnabled: boolean;
  selectedSource: CredentialLyricsSource;
  currentSource: CredentialLyricsSource;
  trackId: string | null | undefined;
  alreadyLoadedKey: string | null;
};

export type CredentialOperationContext = {
  epoch: number;
  credentialsEnabled: boolean;
  selectedSource: CredentialLyricsSource;
  trackId: string | null;
  targetLang: string;
};

export type CredentialOperation = {
  context: CredentialOperationContext;
  operationId: number;
};

export const SETUP_STATUS_KEY = "songdocent_setup_status";
export const KEYCHAIN_PRIMER_KEY = "songdocent_keychain_primer_seen";
export const SETUP_STEPS = [
  "welcome",
  "keychain",
  "lyrics",
  "ai",
  "language",
  "review",
] as const satisfies readonly SetupStep[];
const SUPPORTED_TARGET_LANGS = new Set(translationLanguages.map(({ code }) => code));

const defaultStorage = (): SetupStorage | undefined => {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
};

const readStorage = (storage: SetupStorage | undefined, key: string): string | null => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeStorage = (
  storage: SetupStorage | undefined,
  key: string,
  value: string,
): void => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Setup remains usable when storage is unavailable.
  }
};

export function getSetupDisposition(storage = defaultStorage()): SetupDisposition {
  const persisted = readStorage(storage, SETUP_STATUS_KEY);
  return persisted === "completed" || persisted === "skipped" ? persisted : "pending";
}

export function saveSetupDisposition(
  disposition: SetupDisposition,
  storage = defaultStorage(),
): void {
  writeStorage(storage, SETUP_STATUS_KEY, disposition);
}

export function getSetupCompletionDisposition({
  mode,
  disposition,
}: {
  mode: SetupCompletionMode;
  disposition: SetupDisposition;
}): SetupDisposition {
  return mode === "first-run" ? "completed" : disposition;
}

export function isKeychainPrimerAccepted(storage = defaultStorage()): boolean {
  return readStorage(storage, KEYCHAIN_PRIMER_KEY) === "true";
}

export function acceptKeychainPrimer(storage = defaultStorage()): void {
  writeStorage(storage, KEYCHAIN_PRIMER_KEY, "true");
}

export function canUseCredentials({ primerAccepted }: CredentialAccess): boolean {
  return primerAccepted;
}

export function canLoadSecretStatus({
  open,
  isDesktop,
  primerAccepted,
}: SecretStatusAccess): boolean {
  return open && isDesktop && primerAccepted;
}

export function requestSecretSave({
  primerAccepted,
  kind,
  value,
}: CredentialAccess & PendingSecretSave): SecretSaveTransition {
  const normalizedValue = value.trim();
  if (!normalizedValue) return { pending: null, ready: null };

  const secret = { kind, value: normalizedValue };
  return primerAccepted
    ? { pending: null, ready: secret }
    : { pending: secret, ready: null };
}

export function acceptPendingSecretSave(
  pending: PendingSecretSave | null,
): SecretSaveTransition {
  return { pending: null, ready: pending };
}

export function cancelPendingSecretSave(
  _pending: PendingSecretSave | null,
): null {
  return null;
}

export function shouldFetchCredentialBackedLyrics({
  credentialsEnabled,
  selectedSource,
  currentSource,
  trackId,
  alreadyLoadedKey,
}: CredentialBackedLyricsFetch): boolean {
  return Boolean(
    credentialsEnabled &&
      selectedSource === currentSource &&
      trackId &&
      trackId !== alreadyLoadedKey,
  );
}

export function shouldRunCredentialRetry(
  captured: CredentialOperationContext,
  current: CredentialOperationContext,
): boolean {
  return (
    captured.credentialsEnabled &&
    current.credentialsEnabled &&
    captured.epoch === current.epoch &&
    captured.selectedSource === current.selectedSource &&
    captured.trackId === current.trackId &&
    captured.targetLang === current.targetLang
  );
}

export function isCredentialOperationCurrent(
  operation: CredentialOperation,
  currentContext: CredentialOperationContext,
  currentOperationId: number,
): boolean {
  return (
    operation.operationId === currentOperationId &&
    shouldRunCredentialRetry(operation.context, currentContext)
  );
}

export function nextSetupStep(step: SetupStep): SetupStep {
  const index = SETUP_STEPS.indexOf(step);
  return SETUP_STEPS[Math.min(index + 1, SETUP_STEPS.length - 1)];
}

export function previousSetupStep(step: SetupStep): SetupStep {
  const index = SETUP_STEPS.indexOf(step);
  return SETUP_STEPS[Math.max(index - 1, 0)];
}

export function secretKindForLyricsSource(
  source: CredentialLyricsSource,
): SecretKind {
  return source === "spotify"
    ? "spotify_sp_dc"
    : "apple_music_media_user_token";
}

export function secretKindForAiProvider(provider: CloudAiProvider): SecretKind {
  if (provider === "gemini") return "gemini_api_key";
  if (provider === "openai") return "openai_api_key";
  return "claude_api_key";
}

export function secretStatusForKind(
  kind: SecretKind,
  status: SecretStatus,
): boolean {
  switch (kind) {
    case "spotify_sp_dc":
      return status.spotifySpDc;
    case "apple_music_media_user_token":
      return status.appleMusicMediaUserToken;
    case "gemini_api_key":
      return status.geminiApiKey;
    case "openai_api_key":
      return status.openaiApiKey;
    case "claude_api_key":
      return status.claudeApiKey;
    case "openai_compatible_api_key":
      return status.openaiCompatibleApiKey;
  }
}

function canContinueCredential(
  kind: SecretKind,
  progress: SetupCredentialProgress,
): boolean {
  if (progress.saveFailed || progress.validationStatus === "invalid") return false;
  if (
    progress.validationStatus === "unavailable" &&
    !progress.savedAnyway
  ) {
    return false;
  }
  return secretStatusForKind(kind, progress.secretStatus);
}

export function canContinueLyrics({
  source,
  ...progress
}: SetupCredentialProgress & {
  source: CredentialLyricsSource;
}): boolean {
  return canContinueCredential(secretKindForLyricsSource(source), progress);
}

export function canContinueAi({
  provider,
  ...progress
}: SetupCredentialProgress & {
  provider: CloudAiProvider;
}): boolean {
  return canContinueCredential(secretKindForAiProvider(provider), progress);
}

export function canCompleteSetup({
  lyricsSaved,
  aiSaved,
  targetLang,
}: {
  lyricsSaved: boolean;
  aiSaved: boolean;
  targetLang: string;
}): boolean {
  return Boolean(
    lyricsSaved &&
      aiSaved &&
      targetLang.trim() &&
      SUPPORTED_TARGET_LANGS.has(targetLang),
  );
}
