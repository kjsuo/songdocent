import assert from "node:assert/strict";
import test from "node:test";
import {
  SUPPORTED_PLATFORM_COPY_LANGUAGES,
  browserOptionsForPlatform,
  normalizeDesktopPlatform,
  platformCopyFor,
} from "./platformCopy.ts";

test("normalizes only supported desktop targets", () => {
  assert.equal(normalizeDesktopPlatform("macos"), "macos");
  assert.equal(normalizeDesktopPlatform("windows"), "windows");
  assert.equal(normalizeDesktopPlatform("linux"), "macos");
});

test("defines platform copy for every supported UI language", () => {
  assert.deepEqual(SUPPORTED_PLATFORM_COPY_LANGUAGES, [
    "en",
    "ko",
    "ja",
    "es",
    "fr",
    "de",
    "pt-BR",
    "zh-CN",
  ]);

  for (const language of SUPPORTED_PLATFORM_COPY_LANGUAGES) {
    for (const platform of ["macos", "windows"] as const) {
      const copy = platformCopyFor(language, platform);
      assert.ok(copy.secureStore.trim());
      assert.ok(copy.primerTitle.trim());
      assert.ok(copy.primerBody.trim());
      assert.ok(copy.systemAuth.trim());
      assert.ok(copy.localStorage.trim());
      assert.ok(copy.systemPrompt.trim());
      assert.ok(copy.cancelled.trim());
      assert.ok(copy.retry.trim());
      assert.ok(copy.devtoolsShortcut.trim());
    }
  }
});

test("uses native secure-store and browser guidance", () => {
  assert.match(platformCopyFor("ko", "macos").secureStore, /Keychain/);
  assert.match(
    platformCopyFor("ko", "windows").secureStore,
    /Windows 자격 증명 관리자/,
  );
  assert.deepEqual(browserOptionsForPlatform("macos"), ["chrome", "safari"]);
  assert.deepEqual(browserOptionsForPlatform("windows"), ["chrome"]);
  assert.match(platformCopyFor("en", "windows").devtoolsShortcut, /Ctrl/);
  assert.match(platformCopyFor("en", "macos").devtoolsShortcut, /Command/);
});
