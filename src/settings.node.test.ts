import assert from "node:assert/strict";
import test from "node:test";
import {
  CLOUD_AI_MODEL_OPTIONS,
  cloudModelOptions,
  CUSTOM_AI_MODEL_VALUE,
  DEFAULT_AI_MODELS,
  DEFAULT_LOCAL_AI_BASE_URLS,
  DEFAULT_TRANSLATION_CHUNK_MODE,
  DEFAULT_TRANSLATION_CHUNK_SIZE,
  DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
  configForProvider,
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
  isCloudAiProvider,
  isSettingsOperationCurrent,
  normalizeLyricsSource,
  normalizeAiProvider,
  normalizeSettingsSection,
  normalizeTranslationChunkConfig,
  saveCustomAiModel,
  saveLyricsSource,
  saveTranslationChunkConfig,
  saveTranslationConfig,
} from "./settings.ts";

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

const storage = new MemoryStorage();

Object.defineProperty(globalThis, "window", {
  value: {
    dispatchEvent() {},
  },
});
Object.defineProperty(globalThis, "localStorage", {
  value: storage,
});

test("normalizes local AI providers", () => {
  assert.equal(normalizeAiProvider("ollama"), "ollama");
  assert.equal(normalizeAiProvider("lmstudio"), "lmstudio");
  assert.equal(normalizeAiProvider("missing"), "gemini");
});

test("normalizes settings sections", () => {
  assert.equal(normalizeSettingsSection("lyrics"), "lyrics");
  assert.equal(normalizeSettingsSection("language"), "language");
  assert.equal(normalizeSettingsSection("setup"), "setup");
  assert.equal(normalizeSettingsSection("missing"), "ai");
});

test("settings async work applies only to the current open generation and operation", () => {
  const operation = { generation: 4, operationId: 9 };

  assert.equal(
    isSettingsOperationCurrent(operation, {
      open: true,
      generation: 4,
      operationId: 9,
    }),
    true,
  );
  assert.equal(
    isSettingsOperationCurrent(operation, {
      open: false,
      generation: 4,
      operationId: 9,
    }),
    false,
  );
  assert.equal(
    isSettingsOperationCurrent(operation, {
      open: true,
      generation: 5,
      operationId: 9,
    }),
    false,
  );
  assert.equal(
    isSettingsOperationCurrent(operation, {
      open: true,
      generation: 4,
      operationId: 10,
    }),
    false,
  );
});

test("API key display follows the current provider rather than the saved secret kind", () => {
  const geminiOnly = {
    spotifySpDc: false,
    appleMusicMediaUserToken: false,
    openaiApiKey: false,
    geminiApiKey: true,
    claudeApiKey: false,
    openaiCompatibleApiKey: false,
  };
  const openAiOnly = {
    ...geminiOnly,
    openaiApiKey: true,
    geminiApiKey: false,
  };

  assert.equal(getProviderApiKeyDisplayValue("openai", geminiOnly), "");
  assert.equal(getProviderApiKeyDisplayValue("gemini", geminiOnly), "********");
  assert.equal(getProviderApiKeyDisplayValue("gemini", openAiOnly), "");
  assert.equal(getProviderApiKeyDisplayValue("openai", openAiOnly), "********");
  assert.equal(getProviderApiKeyDisplayValue("claude", geminiOnly), "");
  assert.equal(getProviderApiKeyDisplayValue("claude", { ...geminiOnly, claudeApiKey: true }), "********");
  assert.equal(getProviderApiKeyDisplayValue("openai_compatible", geminiOnly), "");
  assert.equal(getProviderApiKeyDisplayValue("openai_compatible", { ...geminiOnly, openaiCompatibleApiKey: true }), "********");
});

test("stores an OpenAI-compatible base URL and model", () => {
  storage.clear();
  saveTranslationConfig({
    provider: "openai_compatible",
    model: "vendor-model",
    baseUrl: "https://api.example.com/v1",
  });

  assert.equal(normalizeAiProvider("openai_compatible"), "openai_compatible");
  assert.deepEqual(getStoredTranslationConfig(), {
    provider: "openai_compatible",
    model: "vendor-model",
    baseUrl: "https://api.example.com/v1",
  });
});

test("stores model and base URL per local provider", () => {
  storage.clear();

  saveTranslationConfig({
    provider: "ollama",
    model: "llama3.1:8b",
    baseUrl: "http://localhost:11434",
  });

  assert.deepEqual(getStoredTranslationConfig(), {
    provider: "ollama",
    model: "llama3.1:8b",
    baseUrl: "http://localhost:11434",
  });
});

test("uses local provider defaults when values are missing", () => {
  storage.clear();
  storage.setItem("songdocent_ai_provider", "lmstudio");

  assert.deepEqual(getStoredTranslationConfig(), {
    provider: "lmstudio",
    model: DEFAULT_AI_MODELS.lmstudio,
    baseUrl: DEFAULT_LOCAL_AI_BASE_URLS.lmstudio,
  });
});

test("stores preferred lyrics source", () => {
  storage.clear();

  assert.equal(getStoredLyricsSource(), "spotify");
  assert.equal(normalizeLyricsSource("missing"), "spotify");

  saveLyricsSource("apple_music");

  assert.equal(getStoredLyricsSource(), "apple_music");
});

test("restores provider-scoped CLI options and trims saved values", () => {
  storage.clear();
  storage.setItem("songdocent_ai_provider", "codex_cli");
  storage.setItem("songdocent_ai_model_codex_cli", "  selected-model  ");
  storage.setItem("songdocent_ai_cli_path_codex_cli", "  /custom tools/codex  ");
  storage.setItem("songdocent_ai_cli_reasoning_codex_cli", "  high  ");
  const expected = {
    provider: "codex_cli",
    model: "selected-model",
    cliOptions: { executablePath: "/custom tools/codex", reasoning: "high" },
  };
  assert.deepEqual(getStoredTranslationConfig(), expected);
  assert.deepEqual(configForProvider("codex_cli"), expected);
  assert.deepEqual(configForProvider("claude_cli"), {
    provider: "claude_cli", model: "__cli_default__", cliOptions: {},
  });
});

test("stores long lyric translation chunk preferences", () => {
  storage.clear();

  assert.deepEqual(getStoredTranslationChunkConfig(), {
    mode: DEFAULT_TRANSLATION_CHUNK_MODE,
    threshold: DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
    chunkSize: DEFAULT_TRANSLATION_CHUNK_SIZE,
  });

  saveTranslationChunkConfig({ mode: "always", threshold: 80, chunkSize: 25 });

  assert.deepEqual(getStoredTranslationChunkConfig(), {
    mode: "always",
    threshold: 80,
    chunkSize: 25,
  });
});

test("normalizes translation chunk preferences", () => {
  assert.deepEqual(
    normalizeTranslationChunkConfig({ threshold: Number.NaN, chunkSize: Number.NaN }),
    {
      mode: DEFAULT_TRANSLATION_CHUNK_MODE,
      threshold: DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
      chunkSize: DEFAULT_TRANSLATION_CHUNK_SIZE,
    },
  );
  assert.deepEqual(normalizeTranslationChunkConfig({ mode: "off", threshold: 0, chunkSize: 1 }), {
    mode: "off",
    threshold: 25,
    chunkSize: 10,
  });
  assert.deepEqual(normalizeTranslationChunkConfig({ mode: "nope", threshold: 999, chunkSize: 999 }), {
    mode: "auto",
    threshold: 300,
    chunkSize: 50,
  });
});

test("lists curated cloud models in display order", () => {
  assert.deepEqual(
    CLOUD_AI_MODEL_OPTIONS.gemini.map(({ id }) => id),
    [
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite",
    ],
  );
  assert.deepEqual(
    CLOUD_AI_MODEL_OPTIONS.openai.map(({ id }) => id),
    ["gpt-5.5", "gpt-5.4", "gpt-5.4-mini", "gpt-5.4-nano"],
  );
  assert.equal(DEFAULT_AI_MODELS.gemini, "gemini-3.5-flash");
  assert.equal(DEFAULT_AI_MODELS.openai, "gpt-5.4-mini");
});

test("classifies cloud providers and custom model selections", () => {
  assert.equal(isCloudAiProvider("gemini"), true);
  assert.equal(isCloudAiProvider("openai"), true);
  assert.equal(isCloudAiProvider("ollama"), false);
  assert.equal(getAiModelSelection("gemini", "gemini-3.5-flash"), "gemini-3.5-flash");
  assert.equal(getAiModelSelection("openai", "vendor/fine-tuned-model"), CUSTOM_AI_MODEL_VALUE);
});

test("remembers custom model values per cloud provider", () => {
  storage.clear();

  saveCustomAiModel("gemini", "gemini-experimental-custom");
  saveCustomAiModel("openai", "ft:gpt-custom");

  assert.equal(getStoredCustomAiModel("gemini"), "gemini-experimental-custom");
  assert.equal(getStoredCustomAiModel("openai"), "ft:gpt-custom");
});

test("grounding defaults to off, persists modes, and stays off outside cloud providers", async () => {
  const { getStoredGroundingSearchMode, getEffectiveGroundingSearchMode, saveGroundingSearchMode } = await import("./settings.ts");
  storage.clear();
  assert.equal(getStoredGroundingSearchMode(), "off");
  for (const mode of ["translation", "annotation", "off"] as const) {
    saveGroundingSearchMode(mode);
    assert.equal(getStoredGroundingSearchMode(), mode);
    for (const provider of ["gemini", "openai", "claude"] as const) assert.equal(getEffectiveGroundingSearchMode(provider), mode);
    for (const provider of ["ollama", "lmstudio", "openai_compatible"] as const) assert.equal(getEffectiveGroundingSearchMode(provider), "off");
  }
  storage.setItem("songdocent_grounding_search_mode", "invalid");
  assert.equal(getStoredGroundingSearchMode(), "off");
});

test("grounding model support accepts known snapshots and rejects unsupported custom models", async () => {
  const { supportsGroundingSearch, getEffectiveGroundingSearchMode, saveGroundingSearchMode } = await import("./settings.ts");
  for (const provider of ["gemini", "openai", "claude"] as const) {
    for (const { id } of CLOUD_AI_MODEL_OPTIONS[provider]) assert.equal(supportsGroundingSearch(provider, id), true);
  }
  assert.equal(supportsGroundingSearch("gemini", "models/gemini-3.5-flash"), true);
  assert.equal(supportsGroundingSearch("openai", "gpt-5.4-mini-2026-03-17"), true);
  assert.equal(supportsGroundingSearch("claude", "claude-haiku-4-5-20251001"), true);
  for (const model of ["gpt-4.1-nano", "gpt-5.4-mini-unknown", "custom-model", ""]) {
    assert.equal(supportsGroundingSearch("openai", model), false);
    saveGroundingSearchMode("translation");
    assert.equal(getEffectiveGroundingSearchMode("openai", model), "off");
  }
  assert.equal(supportsGroundingSearch("ollama", "gpt-5.4"), false);
});

test("restores Antigravity CLI settings", () => {
  storage.clear();
  saveTranslationConfig({
    provider: "antigravity_cli", model: "custom-model",
    cliOptions: { executablePath: "/custom/agy", reasoning: "high" },
  });
  assert.deepEqual(getStoredTranslationConfig(), {
    provider: "antigravity_cli", model: "custom-model",
    cliOptions: { executablePath: "/custom/agy", reasoning: "high" },
  });
  assert.equal(configForProvider("gemini_cli").model, "__cli_default__");
});


test("model guidance follows text model families across versions", () => {
  assert.equal(getAiModelClass("gemini", "gemini-3.1-flash-lite"), "fast");
  assert.equal(getAiModelClass("gemini", "models/gemini-9.5-flash-lite-preview-11-03"), "fast");
  assert.equal(getAiModelClass("gemini", "gemini-9.8-flash"), "balanced");
  assert.equal(getAiModelClass("gemini", "gemini-9.1-pro-preview"), "capable");
  assert.equal(getAiModelClass("openai", "gpt-6-luna"), "fast");
  assert.equal(getAiModelClass("openai", "gpt-9.1-luna-2027-01-01"), "fast");
  assert.equal(getAiModelClass("openai", "gpt-9.1-terra"), "balanced");
  assert.equal(getAiModelClass("openai", "gpt-9.1-sol"), "capable");
  assert.equal(getAiModelClass("claude", "claude-haiku-4-5"), "fast");
  assert.equal(getAiModelClass("claude", "claude-haiku-9-5-20270101"), "fast");
  assert.equal(getAiModelClass("claude", "claude-sonnet-9-5"), "balanced");
  assert.equal(getAiModelClass("claude", "claude-opus-9-5-latest"), "capable");
});

test("model guidance leaves unknown families and specialized models unclassified", () => {
  assert.equal(getAiModelClass("gemini", "gemini-3.1-flash-lite-image"), null);
  assert.equal(getAiModelClass("gemini", "gemini-9.1-flash-live"), null);
  assert.equal(getAiModelClass("gemini", "gemini-9.1-flash-native-audio-preview"), null);
  assert.equal(getAiModelClass("gemini", "gpt-6-luna"), null);
  assert.equal(getAiModelClass("openai", "gpt-5.4-mini"), null);
  assert.equal(getAiModelClass("openai", "gpt-9-astra"), null);
  assert.equal(getAiModelClass("openai", "vendor/gpt-6-luna"), null);
  assert.equal(getAiModelClass("ollama", "gpt-6-luna"), null);
  assert.equal(getAiModelClass("claude", ""), null);
});


test("API reasoning choices respect model capabilities and specialized models", () => {
  assert.deepEqual(getApiReasoningOptions("gemini", "models/gemini-3.1-flash-lite"), ["minimal", "low", "medium", "high"]);
  assert.deepEqual(getApiReasoningOptions("gemini", "gemini-3.1-pro-preview"), ["low", "medium", "high"]);
  assert.deepEqual(getApiReasoningOptions("gemini", "gemini-3-pro-preview"), ["low", "high"]);
  assert.deepEqual(getApiReasoningOptions("openai", "gpt-6.1-terra"), ["none", "low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(getApiReasoningOptions("openai", "gpt-6-luna"), ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(getApiReasoningOptions("claude", "claude-haiku-5-5-20261007"), ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(getApiReasoningOptions("claude", "claude-opus-4-6"), ["low", "medium", "high", "max"]);
  assert.deepEqual(getApiReasoningOptions("claude", "claude-haiku-4-5"), []);
  assert.deepEqual(getApiReasoningOptions("gemini", "gemini-3.1-flash-lite-image"), []);
  assert.deepEqual(getApiReasoningOptions("openai", "gpt-5.4-pro"), []);
  assert.deepEqual(getApiReasoningOptions("openai", "unknown-model"), []);
  assert.deepEqual(getApiReasoningOptions("ollama", "gpt-6-luna"), []);
});

test("API reasoning persists per provider and model, resets, and rejects incompatible values", () => {
  storage.clear();
  saveTranslationConfig({ provider: "gemini", model: "gemini-3.1-flash-lite", apiReasoning: "minimal" });
  assert.equal(getStoredTranslationConfig().apiReasoning, "minimal");
  saveTranslationConfig({ provider: "gemini", model: "gemini-3.1-pro-preview" });
  assert.equal(getStoredTranslationConfig().apiReasoning, undefined);
  saveApiReasoning("gemini", "gemini-3.1-pro-preview", "high");
  saveTranslationConfig({ provider: "openai", model: "gpt-6-luna", apiReasoning: "low" });
  assert.equal(getStoredTranslationConfig().apiReasoning, "low");
  assert.equal(configForProvider("gemini").apiReasoning, "high");
  assert.equal(getStoredApiReasoning("gemini", "models/gemini-3.1-flash-lite"), "minimal");
  assert.throws(() => saveApiReasoning("gemini", "gemini-3.1-pro-preview", "minimal"));
  saveApiReasoning("openai", "gpt-6-luna", "");
  assert.equal(getStoredTranslationConfig().apiReasoning, undefined);
  storage.setItem("songdocent_ai_api_reasoning_openai_gpt-6-luna", "not-supported");
  assert.equal(getStoredTranslationConfig().apiReasoning, undefined);
});


test("Gemini catalog groups standard models by descending version, tier, and release status", () => {
  const ids = [
    "lyria-3", "gemini-2.5-pro", "gemma-4-31b-it", "gemini-3.5-flash",
    "gemini-flash-latest", "gemini-pro-latest", "gemini-flash-lite-latest",
    "gemini-3.1-flash-lite-preview", "gemini-3.10-flash",
    "gemini-3.1-pro-preview-customtools", "gemini-3.1-pro-preview",
    "gemini-3.1-flash-lite", "nano-banana-pro", "gemini-3.5-flash-lite",
    "models/gemini-3.1-flash", "gemini-2.5-computer-use-preview-10-2025",
  ];
  const models = ids.map((id) => ({ id, label: id, description: "" }));
  const sorted = cloudModelOptions({ provider: "gemini", models, fetchedAt: 0 });
  assert.deepEqual(sorted.map(({ id }) => id), [
    "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-pro-latest",
    "gemini-3.10-flash", "gemini-3.5-flash-lite", "gemini-3.5-flash",
    "gemini-3.1-flash-lite", "gemini-3.1-flash-lite-preview",
    "models/gemini-3.1-flash", "gemini-3.1-pro-preview", "gemini-2.5-pro",
    "gemini-2.5-computer-use-preview-10-2025",
    "gemini-3.1-pro-preview-customtools", "gemma-4-31b-it", "lyria-3", "nano-banana-pro",
  ]);
  assert.deepEqual(models.map(({ id }) => id), ids);
  assert.deepEqual(cloudModelOptions({ provider: "openai", models, fetchedAt: 0 }).map(({ id }) => id), ids);
});


test("CLI model guidance shares API classes while respecting tool aliases and model IDs", () => {
  assert.equal(getAiModelClass("codex_cli", "gpt-9.1-luna"), "fast");
  assert.equal(getAiModelClass("codex_cli", "gpt-9.1-terra"), "balanced");
  assert.equal(getAiModelClass("codex_cli", "gpt-9.1-sol"), "capable");
  assert.equal(getAiModelClass("claude_cli", "haiku"), "fast");
  assert.equal(getAiModelClass("claude_cli", "sonnet"), "balanced");
  assert.equal(getAiModelClass("claude_cli", "opus"), "capable");
  assert.equal(getAiModelClass("claude_cli", "claude-haiku-9-5"), "fast");
  assert.equal(getAiModelClass("gemini_cli", "flash-lite"), "fast");
  assert.equal(getAiModelClass("gemini_cli", "flash"), "balanced");
  assert.equal(getAiModelClass("gemini_cli", "pro"), "capable");
  assert.equal(getAiModelClass("antigravity_cli", "gemini-3.8-flash-low"), "balanced");
  assert.equal(getAiModelClass("antigravity_cli", "claude-opus-9-5-thinking"), "capable");
  assert.equal(getAiModelClass("opencode_cli", "openai/gpt-9.1-luna"), "fast");
  assert.equal(getAiModelClass("opencode_cli", "google/gemini-9.1-flash"), "balanced");
  assert.equal(getAiModelClass("opencode_cli", "anthropic/claude-opus-9-5"), "capable");
  assert.equal(getAiModelClass("codex_cli", "haiku"), null);
  assert.equal(getAiModelClass("claude_cli", "gpt-9.1-luna"), null);
  assert.equal(getAiModelClass("gemini_cli", "auto"), null);
  assert.equal(getAiModelClass("opencode_cli", "vendor/unknown-model"), null);
  assert.equal(getAiModelClass("opencode_cli", "google/gemini-3.1-flash-lite-image"), null);
  assert.equal(getAiModelClass("codex_cli", "__cli_default__"), null);
});
