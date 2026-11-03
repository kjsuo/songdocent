import { invoke } from "@tauri-apps/api/core";
import type { LangCode } from "./i18n";

export type SessionProvider = "spotify" | "apple_music";

export type ProviderConnectionPhase =
  | "idle"
  | "opening"
  | "waiting_for_login"
  | "validating"
  | "connected"
  | "cancelled"
  | "timed_out"
  | "recoverable_error"
  | "terminal_error";

export type ProviderConnectionStatus = {
  connectionId: number;
  provider: SessionProvider;
  phase: ProviderConnectionPhase;
  code: string | null;
};

export type ProviderExpiryStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?: (key: string) => void;
};

const PROVIDER_EXPIRED_VALUE = "true";

function browserStorage(): ProviderExpiryStorage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function providerExpiredKey(provider: SessionProvider): string {
  return `songdocent_provider_expired_${provider}`;
}

export function isProviderExpired(
  provider: SessionProvider,
  storage: ProviderExpiryStorage | undefined = browserStorage(),
): boolean {
  try {
    return storage?.getItem(providerExpiredKey(provider)) === PROVIDER_EXPIRED_VALUE;
  } catch {
    return false;
  }
}

export function markProviderExpired(
  provider: SessionProvider,
  storage: ProviderExpiryStorage | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(providerExpiredKey(provider), PROVIDER_EXPIRED_VALUE);
  } catch {
    // Expiry metadata is advisory. If storage is unavailable, keep the app usable.
  }
}

export function clearProviderExpired(
  provider: SessionProvider,
  storage: ProviderExpiryStorage | undefined = browserStorage(),
): void {
  try {
    const key = providerExpiredKey(provider);
    if (storage?.removeItem) {
      storage.removeItem(key);
    } else {
      storage?.setItem(key, "");
    }
  } catch {
    // Clearing expiry is best effort and must not expose credential details.
  }
}

export function providerCooldownMsForErrorCode(code: string | null | undefined): number {
  return code === "LYRICS_RATE_LIMITED" ? 60_000 : 0;
}

export function connectionNeedsPolling(phase: ProviderConnectionPhase): boolean {
  return phase === "opening" || phase === "waiting_for_login" || phase === "validating";
}

export function startProviderConnection(
  provider: SessionProvider,
  language: LangCode = "en",
): Promise<ProviderConnectionStatus> {
  return invoke<ProviderConnectionStatus>("start_provider_connection", { provider, language });
}

export function getProviderConnectionStatus(
  connectionId: number,
): Promise<ProviderConnectionStatus | null> {
  return invoke<ProviderConnectionStatus | null>("get_provider_connection_status", {
    connectionId,
  });
}

export function cancelProviderConnection(connectionId: number): Promise<void> {
  return invoke<void>("cancel_provider_connection", { connectionId });
}
