import assert from "node:assert/strict";
import test from "node:test";
import {
  KEYCHAIN_PRIMER_KEY,
  SETUP_STEPS,
  SETUP_STATUS_KEY,
  acceptKeychainPrimer,
  acceptPendingSecretSave,
  canCompleteSetup,
  canContinueAi,
  canContinueLyrics,
  canLoadSecretStatus,
  canUseCredentials,
  cancelPendingSecretSave,
  getSetupDisposition,
  getSetupCompletionDisposition,
  isCredentialOperationCurrent,
  isKeychainPrimerAccepted,
  nextSetupStep,
  previousSetupStep,
  requestSecretSave,
  saveSetupDisposition,
  secretKindForAiProvider,
  secretKindForLyricsSource,
  secretStatusForKind,
  shouldRunCredentialRetry,
  shouldFetchCredentialBackedLyrics,
} from "./setupState.ts";
import {
  SETUP_COPY,
  SETUP_GUIDES,
  setupBrowsersFor,
  setupCopyFor,
} from "./setupContent.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  clear() {
    this.values.clear();
  }
}

class ThrowingStorage {
  getItem(): never {
    throw new Error("storage read failed");
  }

  setItem(): never {
    throw new Error("storage write failed");
  }
}

const storage = new MemoryStorage();
const EMPTY_SECRET_STATUS = {
  spotifySpDc: false,
  appleMusicMediaUserToken: false,
  openaiApiKey: false,
  geminiApiKey: false,
  claudeApiKey: false,
};

test("lyrics continuation requires the selected source to have a saved credential", () => {
  assert.equal(
    canContinueLyrics({
      source: "spotify",
      secretStatus: { ...EMPTY_SECRET_STATUS, spotifySpDc: true },
      validationStatus: "valid",
      savedAnyway: false,
      saveFailed: false,
    }),
    true,
  );
  assert.equal(
    canContinueLyrics({
      source: "apple_music",
      secretStatus: { ...EMPTY_SECRET_STATUS, spotifySpDc: true },
      validationStatus: null,
      savedAnyway: false,
      saveFailed: false,
    }),
    false,
  );
});

test("invalid lyrics validation blocks continuation even when an older credential exists", () => {
  assert.equal(
    canContinueLyrics({
      source: "spotify",
      secretStatus: { ...EMPTY_SECRET_STATUS, spotifySpDc: true },
      validationStatus: "invalid",
      savedAnyway: false,
      saveFailed: false,
    }),
    false,
  );
});

test("AI continuation requires a saved credential and explicit save-anyway after unavailable validation", () => {
  const unavailable = {
    provider: "gemini" as const,
    secretStatus: { ...EMPTY_SECRET_STATUS, geminiApiKey: true },
    validationStatus: "unavailable" as const,
    saveFailed: false,
  };

  assert.equal(canContinueAi({ ...unavailable, savedAnyway: false }), false);
  assert.equal(canContinueAi({ ...unavailable, savedAnyway: true }), true);
  assert.equal(
    canContinueAi({
      ...unavailable,
      validationStatus: "invalid",
      savedAnyway: true,
    }),
    false,
  );
});

test("setup completion requires both credentials and a supported target language", () => {
  for (const targetLang of ["ar", "hi", "th", "sw", "zh-TW", "sr-Latn"]) {
    assert.equal(canCompleteSetup({ lyricsSaved: true, aiSaved: true, targetLang }), true);
  }
  assert.equal(
    canCompleteSetup({ lyricsSaved: true, aiSaved: true, targetLang: "ja" }),
    true,
  );
  assert.equal(
    canCompleteSetup({ lyricsSaved: false, aiSaved: true, targetLang: "ja" }),
    false,
  );
  assert.equal(
    canCompleteSetup({ lyricsSaved: true, aiSaved: true, targetLang: "" }),
    false,
  );
  assert.equal(
    canCompleteSetup({ lyricsSaved: true, aiSaved: true, targetLang: "xx" }),
    false,
  );
});

test("lyrics sources and AI providers map to exact secret kinds", () => {
  assert.equal(secretKindForLyricsSource("spotify"), "spotify_sp_dc");
  assert.equal(
    secretKindForLyricsSource("apple_music"),
    "apple_music_media_user_token",
  );
  assert.equal(secretKindForAiProvider("gemini"), "gemini_api_key");
  assert.equal(secretKindForAiProvider("openai"), "openai_api_key");
  assert.equal(secretKindForAiProvider("claude"), "claude_api_key");
});

test("each secret kind reads only its matching SecretStatus boolean", () => {
  const status = {
    spotifySpDc: true,
    appleMusicMediaUserToken: false,
    openaiApiKey: true,
    geminiApiKey: false,
    claudeApiKey: true,
  };

  assert.equal(secretStatusForKind("spotify_sp_dc", status), true);
  assert.equal(secretStatusForKind("apple_music_media_user_token", status), false);
  assert.equal(secretStatusForKind("openai_api_key", status), true);
  assert.equal(secretStatusForKind("gemini_api_key", status), false);
  assert.equal(secretStatusForKind("claude_api_key", status), true);
});

test("unavailable and invalid validation cannot bypass credential setup implicitly", () => {
  const common = {
    source: "spotify" as const,
    secretStatus: { ...EMPTY_SECRET_STATUS, spotifySpDc: true },
    saveFailed: false,
  };

  assert.equal(
    canContinueLyrics({
      ...common,
      validationStatus: "unavailable",
      savedAnyway: false,
    }),
    false,
  );
  assert.equal(
    canContinueLyrics({
      ...common,
      validationStatus: "unavailable",
      savedAnyway: true,
    }),
    true,
  );
  assert.equal(
    canContinueLyrics({
      ...common,
      validationStatus: "invalid",
      savedAnyway: true,
    }),
    false,
  );
});

test("setup disposition defaults to pending", () => {
  storage.clear();

  assert.equal(getSetupDisposition(storage), "pending");
  storage.setItem(SETUP_STATUS_KEY, "unknown");
  assert.equal(getSetupDisposition(storage), "pending");
});

test("completed setup disposition is persisted", () => {
  storage.clear();

  saveSetupDisposition("completed", storage);

  assert.equal(getSetupDisposition(storage), "completed");
});

test("skipped setup disposition is persisted", () => {
  storage.clear();

  saveSetupDisposition("skipped", storage);

  assert.equal(getSetupDisposition(storage), "skipped");
});

test("setup completion persists only on first run and preserves reentry disposition", () => {
  assert.equal(
    getSetupCompletionDisposition({ mode: "first-run", disposition: "pending" }),
    "completed",
  );
  assert.equal(
    getSetupCompletionDisposition({ mode: "reentry", disposition: "completed" }),
    "completed",
  );
  assert.equal(
    getSetupCompletionDisposition({ mode: "reentry", disposition: "skipped" }),
    "skipped",
  );
});

test("Keychain primer defaults to false and accepts only an exact persisted true", () => {
  storage.clear();

  assert.equal(isKeychainPrimerAccepted(storage), false);
  storage.setItem(KEYCHAIN_PRIMER_KEY, "TRUE");
  assert.equal(isKeychainPrimerAccepted(storage), false);
  acceptKeychainPrimer(storage);
  assert.equal(isKeychainPrimerAccepted(storage), true);
});

test("Keychain primer acknowledgement is independent from setup disposition", () => {
  storage.clear();

  saveSetupDisposition("completed", storage);

  assert.equal(isKeychainPrimerAccepted(storage), false);
});

test("credential access requires accepting the Keychain primer", () => {
  assert.equal(canUseCredentials({ primerAccepted: false }), false);
  assert.equal(canUseCredentials({ primerAccepted: true }), true);
});

test("secret status loads only for an open desktop surface after primer consent", () => {
  assert.equal(
    canLoadSecretStatus({ open: false, isDesktop: true, primerAccepted: true }),
    false,
  );
  assert.equal(
    canLoadSecretStatus({ open: true, isDesktop: false, primerAccepted: true }),
    false,
  );
  assert.equal(
    canLoadSecretStatus({ open: true, isDesktop: true, primerAccepted: false }),
    false,
  );
  assert.equal(
    canLoadSecretStatus({ open: true, isDesktop: true, primerAccepted: true }),
    true,
  );
});

test("a secret save before consent queues the trimmed value without becoming ready", () => {
  assert.deepEqual(
    requestSecretSave({
      primerAccepted: false,
      kind: "spotify_sp_dc",
      value: "  session-cookie  ",
    }),
    {
      pending: { kind: "spotify_sp_dc", value: "session-cookie" },
      ready: null,
    },
  );
});

test("accepting consent consumes a queued secret save exactly once", () => {
  const queued = requestSecretSave({
    primerAccepted: false,
    kind: "openai_api_key",
    value: "  api-key  ",
  });

  const accepted = acceptPendingSecretSave(queued.pending);
  assert.deepEqual(accepted, {
    pending: null,
    ready: { kind: "openai_api_key", value: "api-key" },
  });
  assert.deepEqual(acceptPendingSecretSave(accepted.pending), {
    pending: null,
    ready: null,
  });
});

test("cancelling consent drops a queued secret save", () => {
  const queued = requestSecretSave({
    primerAccepted: false,
    kind: "gemini_api_key",
    value: "api-key",
  });

  assert.equal(cancelPendingSecretSave(queued.pending), null);
});

test("credential-backed lyrics fetch requires credential access", () => {
  const matchingFetch = {
    selectedSource: "spotify" as const,
    currentSource: "spotify" as const,
    trackId: "track-1",
    alreadyLoadedKey: null,
  };

  assert.equal(
    shouldFetchCredentialBackedLyrics({
      ...matchingFetch,
      credentialsEnabled: false,
    }),
    false,
  );
  assert.equal(
    shouldFetchCredentialBackedLyrics({
      ...matchingFetch,
      credentialsEnabled: true,
    }),
    true,
  );
});

test("credential-backed lyrics fetch rejects mismatches, missing tracks, and loaded tracks", () => {
  const matchingFetch = {
    credentialsEnabled: true,
    selectedSource: "spotify" as const,
    currentSource: "spotify" as const,
    trackId: "track-1",
    alreadyLoadedKey: null,
  };

  assert.equal(
    shouldFetchCredentialBackedLyrics({
      ...matchingFetch,
      currentSource: "apple_music",
    }),
    false,
  );
  assert.equal(
    shouldFetchCredentialBackedLyrics({
      ...matchingFetch,
      trackId: null,
    }),
    false,
  );
  assert.equal(
    shouldFetchCredentialBackedLyrics({
      ...matchingFetch,
      alreadyLoadedKey: matchingFetch.trackId,
    }),
    false,
  );
});

test("credential operations require the current epoch, context, and operation id", () => {
  const currentContext = {
    epoch: 4,
    credentialsEnabled: true,
    selectedSource: "spotify" as const,
    trackId: "track-1",
    targetLang: "ko",
  };
  const currentOperation = { context: currentContext, operationId: 2 };

  assert.equal(
    isCredentialOperationCurrent(currentOperation, currentContext, 2),
    true,
  );
  assert.equal(
    isCredentialOperationCurrent(
      { ...currentOperation, context: { ...currentContext, epoch: 2 } },
      currentContext,
      2,
    ),
    false,
    "a true-false-true credential cycle must invalidate the old epoch",
  );
  assert.equal(
    isCredentialOperationCurrent(currentOperation, currentContext, 3),
    false,
    "an older operation must not clear a newer operation's pending state",
  );
});

test("credential retry rejects an obsolete track, language, or credential epoch", () => {
  const captured = {
    epoch: 7,
    credentialsEnabled: true,
    selectedSource: "spotify" as const,
    trackId: "track-1",
    targetLang: "ko",
  };

  assert.equal(shouldRunCredentialRetry(captured, captured), true);
  assert.equal(
    shouldRunCredentialRetry(captured, { ...captured, trackId: "track-2" }),
    false,
  );
  assert.equal(
    shouldRunCredentialRetry(captured, { ...captured, targetLang: "ja" }),
    false,
  );
  assert.equal(
    shouldRunCredentialRetry(captured, { ...captured, epoch: captured.epoch + 2 }),
    false,
  );
});

test("storage read failures safely use setup defaults", () => {
  const throwingStorage = new ThrowingStorage();

  assert.equal(getSetupDisposition(throwingStorage), "pending");
  assert.equal(isKeychainPrimerAccepted(throwingStorage), false);
});

test("storage write failures do not crash setup", () => {
  const throwingStorage = new ThrowingStorage();

  assert.doesNotThrow(() => saveSetupDisposition("completed", throwingStorage));
  assert.doesNotThrow(() => acceptKeychainPrimer(throwingStorage));
});

test("setup steps use the exact wizard order", () => {
  assert.deepEqual(SETUP_STEPS, [
    "welcome",
    "keychain",
    "lyrics",
    "ai",
    "language",
    "review",
  ]);
});

test("setup step navigation follows every adjacent transition", () => {
  const adjacentSteps = [
    ["welcome", "keychain"],
    ["keychain", "lyrics"],
    ["lyrics", "ai"],
    ["ai", "language"],
    ["language", "review"],
  ] as const;

  for (const [previous, next] of adjacentSteps) {
    assert.equal(nextSetupStep(previous), next, `next from ${previous}`);
    assert.equal(previousSetupStep(next), previous, `previous from ${next}`);
  }
});

test("setup step navigation stops at both wizard boundaries", () => {
  assert.equal(previousSetupStep("welcome"), "welcome");
  assert.equal(nextSetupStep("review"), "review");
});

test("setup copy contains exactly the supported locales", () => {
  assert.deepEqual(
    Object.keys(SETUP_COPY).sort(),
    ["en", "ko", "ja", "es", "fr", "de", "pt-BR", "zh-CN"].sort(),
  );
});

const assertNonEmptyStrings = (value: unknown, path: string): void => {
  if (typeof value === "string") {
    assert.ok(value.trim(), `${path} must be non-empty`);
    return;
  }

  if (Array.isArray(value)) {
    assert.ok(value.length > 0, `${path} must not be an empty array`);
    value.forEach((item, index) => assertNonEmptyStrings(item, `${path}[${index}]`));
    return;
  }

  assert.ok(value && typeof value === "object", `${path} must be an object`);
  const entries = Object.entries(value);
  assert.ok(entries.length > 0, `${path} must not be empty`);
  entries.forEach(([key, item]) => assertNonEmptyStrings(item, `${path}.${key}`));
};

test("every locale provides complete non-empty setup and guide copy", () => {
  for (const [locale, copy] of Object.entries(SETUP_COPY)) {
    assert.deepEqual(Object.keys(copy.screens), SETUP_STEPS, `${locale}.screens`);
    assertNonEmptyStrings(copy.screens, `${locale}.screens`);
    assertNonEmptyStrings(copy.onboardingKeychain, `${locale}.onboardingKeychain`);
    assertNonEmptyStrings(copy.keychainBullets, `${locale}.keychainBullets`);
    assertNonEmptyStrings(copy.accessibility, `${locale}.accessibility`);
    assertNonEmptyStrings(copy.accessibility.aiModelLabel, `${locale}.accessibility.aiModelLabel`);
    assertNonEmptyStrings(copy.accessibility.selectedOption, `${locale}.accessibility.selectedOption`);
    assertNonEmptyStrings(copy.settingsGuide, `${locale}.settingsGuide`);
    assertNonEmptyStrings(copy.buttons, `${locale}.buttons`);
    assertNonEmptyStrings(copy.providerLabels, `${locale}.providerLabels`);
    assertNonEmptyStrings(copy.providerDescriptions, `${locale}.providerDescriptions`);
    assertNonEmptyStrings(copy.validation, `${locale}.validation`);
    assertNonEmptyStrings(copy.validation.saved, `${locale}.validation.saved`);
    assertNonEmptyStrings(copy.browserTabs, `${locale}.browserTabs`);
    assertNonEmptyStrings(copy.guideLinks, `${locale}.guideLinks`);
    assertNonEmptyStrings(copy.localLlmExplanation, `${locale}.localLlmExplanation`);
    assertNonEmptyStrings(copy.language, `${locale}.language`);
    assertNonEmptyStrings(copy.reviewLabels, `${locale}.reviewLabels`);

    assert.deepEqual(
      Object.keys(copy.guides),
      Object.keys(SETUP_GUIDES),
      `${locale}.guides`,
    );
    for (const [guideId, guide] of Object.entries(copy.guides)) {
      const metadata = SETUP_GUIDES[guideId as keyof typeof SETUP_GUIDES];
      assertNonEmptyStrings(guide.title, `${locale}.guides.${guideId}.title`);
      assertNonEmptyStrings(guide.body, `${locale}.guides.${guideId}.body`);
      assert.equal(
        guide.alts?.length,
        metadata.assets.length,
        `${locale}.guides.${guideId} must have one alt per asset`,
      );
      if (guide.alts.length) assertNonEmptyStrings(guide.alts, `${locale}.guides.${guideId}.alts`);
      assert.ok(guide.steps.length >= 3, `${locale}.guides.${guideId}.steps must be detailed`);
      assertNonEmptyStrings(guide.steps, `${locale}.guides.${guideId}.steps`);
      if (metadata.assets.length) assertNonEmptyStrings(metadata.assets, `${locale}.guides.${guideId}.assets`);
    }
  }
});

test("Korean onboarding Keychain copy matches the approved safety wording", () => {
  assert.equal(
    SETUP_COPY.ko.onboardingKeychain.body,
    "SongDocent은 어플리케이션 구동에 필요한 사용자의 정보를 안전하게 보관하기 위해 macos의 keychain을 사용합니다.\nSongDocent이 macOS에 Keychain 접근을 요청하기 전에 세부사항을 확인해보세요.",
  );
  assert.equal(
    SETUP_COPY.ko.onboardingKeychain.sensitiveInformationWarning,
    "AI api key와 음악 스트리밍 서비스 쿠키는 민감한 정보입니다. 타인과의 공유는 삼가해주세요.",
  );
});

test("Korean onboarding uses the concise credential validation label", () => {
  assert.equal(SETUP_COPY.ko.buttons.validate, "확인");
});

test("Windows setup copy never exposes macOS storage or browser guidance", () => {
  const copy = setupCopyFor("en", "windows");

  assert.deepEqual(setupBrowsersFor("windows"), ["chrome"]);
  assert.doesNotMatch(copy.screens.keychain.title, /macOS|Keychain|Safari/);
  assert.doesNotMatch(copy.screens.keychain.body, /macOS|Keychain|Safari/);
  assert.match(copy.keychainBullets.localStorage, /Windows Credential Manager/);
  assert.match(copy.guides.spotifyChrome.steps.join(" "), /Ctrl/);
  assert.doesNotMatch(copy.guides.spotifyChrome.steps.join(" "), /Command/);
  assert.match(copy.guides.appleMusicChrome.steps.join(" "), /Ctrl/);
  assert.doesNotMatch(copy.guides.appleMusicChrome.steps.join(" "), /Command/);
});

test("macOS setup copy keeps native Keychain and Safari guidance", () => {
  const copy = setupCopyFor("en", "macos");

  assert.deepEqual(setupBrowsersFor("macos"), ["chrome", "safari"]);
  assert.match(copy.screens.keychain.title, /Keychain/);
  assert.match(copy.guides.spotifyChrome.steps.join(" "), /Command/);
});

test("all guides use the exact provider, browser, destination, and asset metadata", () => {
  assert.deepEqual(SETUP_GUIDES, {
    spotifyChrome: {
      provider: "spotify",
      browser: "chrome",
      destinationIds: ["spotifyWeb"],
      assets: [
        "/onboarding/browser/chrome-cookies.webp",
        "/onboarding/spotify/chrome-sp-dc.webp",
      ],
    },
    spotifySafari: {
      provider: "spotify",
      browser: "safari",
      destinationIds: ["spotifyWeb"],
      assets: [
        "/onboarding/browser/safari-cookies.webp",
        "/onboarding/spotify/safari-sp-dc.webp",
      ],
    },
    appleMusicChrome: {
      provider: "appleMusic",
      browser: "chrome",
      destinationIds: ["appleMusicWeb"],
      assets: [
        "/onboarding/browser/chrome-cookies.webp",
        "/onboarding/apple-music/chrome-media-user-token.webp",
      ],
    },
    appleMusicSafari: {
      provider: "appleMusic",
      browser: "safari",
      destinationIds: ["appleMusicWeb"],
      assets: [
        "/onboarding/browser/safari-cookies.webp",
        "/onboarding/apple-music/safari-media-user-token.webp",
      ],
    },
    geminiApiKey: {
      provider: "gemini",
      browser: null,
      destinationIds: ["geminiApiKeyDocs", "geminiApiKeyConsole"],
      assets: ["/onboarding/ai/gemini-api-key.webp"],
    },
    claudeApiKey: {
      provider: "claude",
      browser: null,
      destinationIds: ["claudeApiKeys", "claudeApiKeyDocs"],
      assets: [],
    },
    openAiApiKey: {
      provider: "openai",
      browser: null,
      destinationIds: ["openAiApiKeys", "openAiApiKeyHelp"],
      assets: ["/onboarding/ai/openai-api-key.webp"],
    },
  });
});
