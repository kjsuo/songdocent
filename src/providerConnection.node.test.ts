import assert from "node:assert/strict";
import test from "node:test";
import {
  clearProviderExpired,
  connectionNeedsPolling,
  isProviderExpired,
  markProviderExpired,
  providerCooldownMsForErrorCode,
  providerExpiredKey,
} from "./providerConnection.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

test("unavailable expiry storage fails closed without throwing", () => {
  const storage = {
    getItem(): string | null {
      throw new Error("storage unavailable");
    },
    setItem(): void {
      throw new Error("storage unavailable");
    },
  };

  assert.equal(isProviderExpired("spotify", storage), false);
  assert.doesNotThrow(() => markProviderExpired("spotify", storage));
});

test("terminal phases stop polling", () => {
  for (const phase of [
    "connected",
    "cancelled",
    "timed_out",
    "recoverable_error",
    "terminal_error",
  ] as const) {
    assert.equal(connectionNeedsPolling(phase), false);
  }
  assert.equal(connectionNeedsPolling("waiting_for_login"), true);
  assert.equal(connectionNeedsPolling("validating"), true);
});

test("provider expiry stores only a provider-scoped boolean", () => {
  const storage = new MemoryStorage();
  markProviderExpired("spotify", storage);

  assert.equal(storage.getItem(providerExpiredKey("spotify")), "true");
  assert.equal(isProviderExpired("spotify", storage), true);
  assert.equal(isProviderExpired("apple_music", storage), false);
});

test("successful connection or disconnect clears provider expiry", () => {
  const storage = new MemoryStorage();
  markProviderExpired("spotify", storage);
  clearProviderExpired("spotify", storage);

  assert.equal(storage.getItem(providerExpiredKey("spotify")), null);
  assert.equal(isProviderExpired("spotify", storage), false);
});

test("network and service lyrics errors do not create expiry or cooldown", () => {
  const storage = new MemoryStorage();

  for (const code of [
    "NETWORK_UNAVAILABLE",
    "LYRICS_SERVICE_UNAVAILABLE",
    "LYRICS_FETCH_FAILED",
  ]) {
    assert.equal(providerCooldownMsForErrorCode(code), 0);
  }
  assert.equal(isProviderExpired("spotify", storage), false);
});

test("lyrics rate limiting maps to a bounded provider cooldown", () => {
  assert.equal(providerCooldownMsForErrorCode("LYRICS_RATE_LIMITED"), 60_000);
  assert.equal(providerCooldownMsForErrorCode("LYRICS_AUTH_EXPIRED"), 0);
  assert.equal(providerCooldownMsForErrorCode(undefined), 0);
});
