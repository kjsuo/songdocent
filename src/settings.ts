import apiReasoningProfiles from "./apiReasoningProfiles.json" with { type: "json" };
import groundingModels from "./groundingModels.json" with { type: "json" };

export type CliAiProvider = "codex_cli" | "claude_cli" | "gemini_cli" | "antigravity_cli" | "opencode_cli";
export type AiProvider = "gemini" | "openai" | "claude" | "ollama" | "lmstudio" | "openai_compatible" | CliAiProvider;
export type AiConnectionMode = "api" | "cli" | "local";
export type CliOptions = { executablePath?: string; reasoning?: string };
export const CLI_DEFAULT_MODEL = "__cli_default__";
export const CLI_PROVIDERS: readonly CliAiProvider[] = ["codex_cli", "claude_cli", "gemini_cli", "antigravity_cli", "opencode_cli"];
export function isCliAiProvider(provider: AiProvider): provider is CliAiProvider {
  return provider === "codex_cli" || provider === "claude_cli" || provider === "gemini_cli" || provider === "antigravity_cli" || provider === "opencode_cli";
}
export function aiConnectionMode(provider: AiProvider): AiConnectionMode {
  return isCliAiProvider(provider) ? "cli" : isLocalAiProvider(provider) ? "local" : "api";
}
export function storedCliOptions(provider: CliAiProvider): CliOptions {
  if (typeof window === "undefined") return {};
  const executablePath = localStorage.getItem(`songdocent_ai_cli_path_${provider}`)?.trim();
  const reasoning = localStorage.getItem(`songdocent_ai_cli_reasoning_${provider}`)?.trim();
  return { ...(executablePath ? { executablePath } : {}), ...(reasoning ? { reasoning } : {}) };
}
export function storedProviderForMode(mode: AiConnectionMode): AiProvider {
  const fallback = mode === "cli" ? "codex_cli" : mode === "local" ? "ollama" : "gemini";
  if (typeof window === "undefined") return fallback;
  const saved = normalizeAiProvider(localStorage.getItem(`songdocent_ai_last_provider_${mode}`));
  return aiConnectionMode(saved) === mode ? saved : fallback;
}
export function configForProvider(provider: AiProvider): TranslationConfig {
  const model = typeof window === "undefined" ? DEFAULT_AI_MODELS[provider] : localStorage.getItem(`songdocent_ai_model_${provider}`)?.trim() || DEFAULT_AI_MODELS[provider];
  if (isCliAiProvider(provider)) return { provider, model, cliOptions:storedCliOptions(provider) };
  const baseUrl = typeof window === "undefined" ? DEFAULT_LOCAL_AI_BASE_URLS[provider] : localStorage.getItem(`songdocent_ai_base_url_${provider}`)?.trim() || DEFAULT_LOCAL_AI_BASE_URLS[provider];
  const apiReasoning = getStoredApiReasoning(provider, model);
  return usesAiBaseUrl(provider) ? { provider, model, baseUrl } : { provider, model, ...(apiReasoning ? { apiReasoning } : {}) };
}
export type CloudAiProvider = Extract<AiProvider, "gemini" | "openai" | "claude">;
export type AiModelClass = "fast" | "balanced" | "capable";

const CLOUD_MODEL_CLASSES: Record<CloudAiProvider, readonly { pattern: RegExp; modelClass: AiModelClass }[]> = {
  gemini: [
    { pattern: /^gemini-flash-lite-latest$/, modelClass: "fast" },
    { pattern: /^gemini-flash-latest$/, modelClass: "balanced" },
    { pattern: /^gemini-pro-latest$/, modelClass: "capable" },
    { pattern: /^gemini-[\d.]+-flash-lite(?:-(?:preview|exp|latest|\d+))*$/, modelClass: "fast" },
    { pattern: /^gemini-[\d.]+-flash(?:-(?:preview|exp|latest|\d+))*$/, modelClass: "balanced" },
    { pattern: /^gemini-[\d.]+-pro(?:-(?:preview|exp|latest|\d+))*$/, modelClass: "capable" },
  ],
  openai: [
    { pattern: /^gpt-(?:[\d.]+-)?luna(?:-(?:preview|latest|\d+))*$/, modelClass: "fast" },
    { pattern: /^gpt-(?:[\d.]+-)?terra(?:-(?:preview|latest|\d+))*$/, modelClass: "balanced" },
    { pattern: /^gpt-(?:[\d.]+-)?sol(?:-(?:preview|latest|\d+))*$/, modelClass: "capable" },
  ],
  claude: [
    { pattern: /^claude-haiku(?:-[\d.]+)*(?:-latest)?$/, modelClass: "fast" },
    { pattern: /^claude-sonnet(?:-[\d.]+)*(?:-latest)?$/, modelClass: "balanced" },
    { pattern: /^claude-opus(?:-[\d.]+)*(?:-latest)?$/, modelClass: "capable" },
  ],
};

const CLI_MODEL_PROVIDERS: Record<CliAiProvider, readonly CloudAiProvider[]> = {
  codex_cli: ["openai"],
  claude_cli: ["claude"],
  gemini_cli: ["gemini"],
  antigravity_cli: ["gemini", "claude", "openai"],
  opencode_cli: ["gemini", "claude", "openai"],
};
const CLI_MODEL_ALIASES: Partial<Record<CliAiProvider, Readonly<Record<string, AiModelClass>>>> = {
  claude_cli: { haiku: "fast", sonnet: "balanced", opus: "capable" },
  gemini_cli: { "flash-lite": "fast", flash: "balanced", pro: "capable" },
};

export function getAiModelClass(provider: AiProvider, model: string): AiModelClass | null {
  let id = model.trim().toLowerCase().replace(/^models\//, "");
  if (isCliAiProvider(provider)) {
    const alias = CLI_MODEL_ALIASES[provider]?.[id];
    if (alias) return alias;
    if (provider === "opencode_cli") id = id.slice(id.indexOf("/") + 1);
    if (provider === "antigravity_cli") id = id.replace(/-(?:low|medium|high|thinking)$/, "");
    for (const cloudProvider of CLI_MODEL_PROVIDERS[provider]) {
      const modelClass = CLOUD_MODEL_CLASSES[cloudProvider].find(({ pattern }) => pattern.test(id))?.modelClass;
      if (modelClass) return modelClass;
    }
    return null;
  }
  if (!isCloudAiProvider(provider)) return null;
  return CLOUD_MODEL_CLASSES[provider].find(({ pattern }) => pattern.test(id))?.modelClass ?? null;
}

function normalizedApiModel(model: string): string {
  return model.trim().toLowerCase().replace(/^models\//, "");
}

export function getApiReasoningOptions(provider: AiProvider, model: string): readonly string[] {
  if (!isCloudAiProvider(provider)) return [];
  const id = normalizedApiModel(model);
  const matches = apiReasoningProfiles[provider].flatMap(({ prefixes, levels }) =>
    prefixes.filter((prefix) => id === prefix || (id.startsWith(`${prefix}-`) &&
      id.slice(prefix.length + 1).split("-").every((part) => /^(?:\d+(?:\.\d+)*|preview|exp|latest|mini|nano)$/.test(part))))
      .map((prefix) => ({ length: prefix.length, levels })),
  );
  return matches.sort((a, b) => b.length - a.length)[0]?.levels ?? [];
}

export function getStoredApiReasoning(provider: AiProvider, model: string): string | undefined {
  if (typeof window === "undefined") return undefined;
  const value = localStorage.getItem(`songdocent_ai_api_reasoning_${provider}_${normalizedApiModel(model)}`);
  return value && getApiReasoningOptions(provider, model).includes(value) ? value : undefined;
}

function writeApiReasoning(provider: AiProvider, model: string, value: string) {
  if (typeof window === "undefined" || !isCloudAiProvider(provider)) return;
  if (value && !getApiReasoningOptions(provider, model).includes(value)) {
    throw new Error("This reasoning level is not supported by the selected model.");
  }
  localStorage.setItem(`songdocent_ai_api_reasoning_${provider}_${normalizedApiModel(model)}`, value);
}

export function saveApiReasoning(provider: AiProvider, model: string, value: string) {
  writeApiReasoning(provider, model, value);
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("songdocent-settings-changed"));
}

export type LyricsSource = "spotify" | "apple_music";
export type SettingsSection = "ai" | "lyrics" | "language" | "setup" | "updates";

export type AiModelOption = {
  id: string;
  label: string;
  description: string;
  searchSupported?: boolean | null;
  structuredOutputSupported?: boolean | null;
};

export type SecretStatus = {
  spotifySpDc: boolean;
  appleMusicMediaUserToken: boolean;
  openaiApiKey: boolean;
  geminiApiKey: boolean;
  claudeApiKey: boolean;
  openaiCompatibleApiKey: boolean;
};

export type SettingsOperationToken = {
  generation: number;
  operationId: number;
};

export type SettingsOperationState = SettingsOperationToken & {
  open: boolean;
};

export type TranslationConfig = {
  provider: AiProvider;
  model: string;
  baseUrl?: string;
  cliOptions?: CliOptions;
  apiReasoning?: string;
};

export type TranslationChunkMode = "auto" | "always" | "off";

export type TranslationChunkConfig = {
  mode: TranslationChunkMode;
  threshold: number;
  chunkSize: number;
};

export const CUSTOM_AI_MODEL_VALUE = "__custom__";
export const DEFAULT_TRANSLATION_CHUNK_MODE: TranslationChunkMode = "auto";
export const DEFAULT_TRANSLATION_CHUNK_THRESHOLD = 80;
export const DEFAULT_TRANSLATION_CHUNK_SIZE = 25;
export const MIN_TRANSLATION_CHUNK_THRESHOLD = 25;
export const MAX_TRANSLATION_CHUNK_THRESHOLD = 300;
export const MIN_TRANSLATION_CHUNK_SIZE = 10;
export const MAX_TRANSLATION_CHUNK_SIZE = 50;
export const TRANSLATION_CHUNK_MODES: readonly TranslationChunkMode[] = [
  "auto",
  "always",
  "off",
];

export const CLOUD_AI_MODEL_OPTIONS: Record<
  CloudAiProvider,
  readonly AiModelOption[]
> = {
  gemini: [
    {
      id: "gemini-3.1-pro-preview",
      label: "Gemini 3.1 Pro Preview",
      description: "",
    },
    {
      id: "gemini-3.5-flash",
      label: "Gemini 3.5 Flash",
      description: "",
    },
    {
      id: "gemini-3-flash-preview",
      label: "Gemini 3 Flash Preview",
      description: "",
    },
    {
      id: "gemini-3.1-flash-lite",
      label: "Gemini 3.1 Flash-Lite",
      description: "",
    },
  ],
  openai: [
    {
      id: "gpt-5.5",
      label: "GPT-5.5",
      description: "",
    },
    {
      id: "gpt-5.4",
      label: "GPT-5.4",
      description: "",
    },
    {
      id: "gpt-5.4-mini",
      label: "GPT-5.4 Mini",
      description: "",
    },
    {
      id: "gpt-5.4-nano",
      label: "GPT-5.4 Nano",
      description: "",
    },
  ],
  claude: [
    { id: "claude-opus-5-5", label: "Claude Opus 5.5", description: "" },
    { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5", description: "" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", description: "" },
  ],
};

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  codex_cli: CLI_DEFAULT_MODEL, claude_cli: CLI_DEFAULT_MODEL, gemini_cli: CLI_DEFAULT_MODEL, antigravity_cli: CLI_DEFAULT_MODEL, opencode_cli: CLI_DEFAULT_MODEL,
  gemini: "gemini-3.5-flash",
  openai: "gpt-5.4-mini",
  claude: "claude-sonnet-5-5",
  ollama: "llama3.1:8b",
  lmstudio: "qwen2.5-7b-instruct",
  openai_compatible: "",
};

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  codex_cli: "Codex CLI", claude_cli: "Claude Code", gemini_cli: "Gemini CLI", antigravity_cli: "Antigravity CLI", opencode_cli: "OpenCode",
  gemini: "Gemini",
  openai: "OpenAI",
  claude: "Claude",
  ollama: "Ollama (local)",
  lmstudio: "LM Studio (local)",
  openai_compatible: "OpenAI compatible",
};

export const DEFAULT_LOCAL_AI_BASE_URLS: Partial<Record<AiProvider, string>> = {
  ollama: "http://localhost:11434",
  lmstudio: "http://localhost:1234",
};

const AI_PROVIDERS = Object.keys(AI_PROVIDER_LABELS) as AiProvider[];
const LYRICS_SOURCES: LyricsSource[] = ["spotify", "apple_music"];
const SETTINGS_SECTIONS: SettingsSection[] = ["ai", "lyrics", "language", "setup", "updates"];

export function isCloudAiProvider(provider: AiProvider): provider is CloudAiProvider {
  return provider === "gemini" || provider === "openai" || provider === "claude";
}

export function getAiModelSelection(provider: AiProvider, model: string) {
  const normalizedModel = model.trim();
  if (!isCloudAiProvider(provider)) return normalizedModel;
  return getCloudAiModelOptions(provider).some(({ id }) => id === normalizedModel)
    ? normalizedModel
    : CUSTOM_AI_MODEL_VALUE;
}

export function getStoredCustomAiModel(provider: CloudAiProvider) {
  if (typeof window === "undefined") return "";

  const customModel = localStorage
    .getItem(`songdocent_ai_custom_model_${provider}`)
    ?.trim();
  if (customModel) return customModel;

  const activeModel = localStorage.getItem(`songdocent_ai_model_${provider}`)?.trim();
  return activeModel && getAiModelSelection(provider, activeModel) === CUSTOM_AI_MODEL_VALUE
    ? activeModel
    : "";
}

export function saveCustomAiModel(provider: CloudAiProvider, model: string) {
  if (typeof window === "undefined") return;
  const normalizedModel = model.trim();
  if (!normalizedModel) return;
  localStorage.setItem(`songdocent_ai_custom_model_${provider}`, normalizedModel);
}

export function normalizeAiProvider(value: string | null | undefined): AiProvider {
  return AI_PROVIDERS.includes(value as AiProvider) ? (value as AiProvider) : "gemini";
}

export function isLocalAiProvider(provider: AiProvider) {
  return provider === "ollama" || provider === "lmstudio";
}

export function usesAiBaseUrl(provider: AiProvider) {
  return isLocalAiProvider(provider) || provider === "openai_compatible";
}

export function normalizeLyricsSource(value: string | null | undefined): LyricsSource {
  return LYRICS_SOURCES.includes(value as LyricsSource) ? (value as LyricsSource) : "spotify";
}

export function normalizeSettingsSection(value: string | null | undefined): SettingsSection {
  return SETTINGS_SECTIONS.includes(value as SettingsSection)
    ? (value as SettingsSection)
    : "ai";
}

export function isSettingsOperationCurrent(
  operation: SettingsOperationToken,
  current: SettingsOperationState,
): boolean {
  return (
    current.open &&
    operation.generation === current.generation &&
    operation.operationId === current.operationId
  );
}

export function getProviderApiKeyDisplayValue(
  provider: AiProvider,
  status: SecretStatus,
): string {
  if (provider === "openai") return status.openaiApiKey ? "********" : "";
  if (provider === "gemini") return status.geminiApiKey ? "********" : "";
  if (provider === "claude") return status.claudeApiKey ? "********" : "";
  if (provider === "openai_compatible") return status.openaiCompatibleApiKey ? "********" : "";
  return "";
}

export function getStoredLyricsSource(): LyricsSource {
  if (typeof window === "undefined") return "spotify";
  return normalizeLyricsSource(localStorage.getItem("songdocent_lyrics_source"));
}

export function saveLyricsSource(source: LyricsSource) {
  if (typeof window === "undefined") return;
  localStorage.setItem("songdocent_lyrics_source", normalizeLyricsSource(source));
  window.dispatchEvent(new Event("songdocent-settings-changed"));
}

export function getStoredTranslationConfig(): TranslationConfig {
  if (typeof window === "undefined") {
    return { provider: "gemini", model: DEFAULT_AI_MODELS.gemini };
  }

  const provider = normalizeAiProvider(localStorage.getItem("songdocent_ai_provider"));
  return configForProvider(provider);
}

export function saveTranslationConfig(config: TranslationConfig) {
  if (typeof window === "undefined") return;
  if (config.apiReasoning !== undefined) writeApiReasoning(config.provider, config.model, config.apiReasoning);
  localStorage.setItem("songdocent_ai_provider", config.provider);
  localStorage.setItem(`songdocent_ai_last_provider_${aiConnectionMode(config.provider)}`, config.provider);
  if (isCliAiProvider(config.provider) && config.cliOptions) {
    localStorage.setItem(`songdocent_ai_cli_path_${config.provider}`, config.cliOptions.executablePath?.trim() || "");
    localStorage.setItem(`songdocent_ai_cli_reasoning_${config.provider}`, config.cliOptions.reasoning?.trim() || "");
  }
  localStorage.setItem(
    `songdocent_ai_model_${config.provider}`,
    config.model.trim() || DEFAULT_AI_MODELS[config.provider],
  );
  if (usesAiBaseUrl(config.provider)) {
    localStorage.setItem(
      `songdocent_ai_base_url_${config.provider}`,
      config.baseUrl?.trim() || DEFAULT_LOCAL_AI_BASE_URLS[config.provider] || "",
    );
  }
  window.dispatchEvent(new Event("songdocent-settings-changed"));
}

function normalizeNumberSetting(
  value: number,
  fallback: number,
  min: number,
  max: number,
) {
  if (!Number.isFinite(value)) return fallback;
  return Math.round(Math.min(Math.max(value, min), max));
}

function normalizeTranslationChunkMode(
  value: string | null | undefined,
): TranslationChunkMode {
  return TRANSLATION_CHUNK_MODES.includes(value as TranslationChunkMode)
    ? (value as TranslationChunkMode)
    : DEFAULT_TRANSLATION_CHUNK_MODE;
}

export function normalizeTranslationChunkConfig(
  config: Partial<TranslationChunkConfig>,
): TranslationChunkConfig {
  return {
    mode: normalizeTranslationChunkMode(config.mode),
    threshold: normalizeNumberSetting(
      Number(config.threshold),
      DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
      MIN_TRANSLATION_CHUNK_THRESHOLD,
      MAX_TRANSLATION_CHUNK_THRESHOLD,
    ),
    chunkSize: normalizeNumberSetting(
      Number(config.chunkSize),
      DEFAULT_TRANSLATION_CHUNK_SIZE,
      MIN_TRANSLATION_CHUNK_SIZE,
      MAX_TRANSLATION_CHUNK_SIZE,
    ),
  };
}

export function getStoredTranslationChunkConfig(): TranslationChunkConfig {
  if (typeof window === "undefined") {
    return {
      mode: DEFAULT_TRANSLATION_CHUNK_MODE,
      threshold: DEFAULT_TRANSLATION_CHUNK_THRESHOLD,
      chunkSize: DEFAULT_TRANSLATION_CHUNK_SIZE,
    };
  }
  const storedMode = localStorage.getItem("songdocent_translation_chunk_mode");
  const storedThreshold = localStorage.getItem("songdocent_translation_chunk_threshold");
  const storedChunkSize = localStorage.getItem("songdocent_translation_chunk_size");

  return normalizeTranslationChunkConfig({
    mode: storedMode === null ? undefined : normalizeTranslationChunkMode(storedMode),
    threshold: storedThreshold === null ? undefined : Number(storedThreshold),
    chunkSize: storedChunkSize === null ? undefined : Number(storedChunkSize),
  });
}

export function saveTranslationChunkConfig(config: TranslationChunkConfig) {
  if (typeof window === "undefined") return;
  const normalized = normalizeTranslationChunkConfig(config);
  localStorage.setItem("songdocent_translation_chunk_mode", normalized.mode);
  localStorage.setItem(
    "songdocent_translation_chunk_threshold",
    String(normalized.threshold),
  );
  localStorage.setItem(
    "songdocent_translation_chunk_size",
    String(normalized.chunkSize),
  );
  window.dispatchEvent(new Event("songdocent-settings-changed"));
}

export function secretKindForProvider(provider: AiProvider) {
  if (provider === "openai") return "openai_api_key";
  if (provider === "gemini") return "gemini_api_key";
  if (provider === "claude") return "claude_api_key";
  if (provider === "openai_compatible") return "openai_compatible_api_key";
  return null;
}

export type GroundingSearchMode = "translation" | "annotation" | "off";
export const DEFAULT_GROUNDING_SEARCH_MODE: GroundingSearchMode = "off";
export function normalizeGroundingSearchMode(value: string | null | undefined): GroundingSearchMode {
  return value === "translation" || value === "annotation" || value === "off" ? value : DEFAULT_GROUNDING_SEARCH_MODE;
}
export function getStoredGroundingSearchMode(): GroundingSearchMode {
  return normalizeGroundingSearchMode(typeof window === "undefined" ? null : localStorage.getItem("songdocent_grounding_search_mode"));
}
export function supportsGroundingSearch(provider: AiProvider, model: string): boolean {
  if (isCliAiProvider(provider)) return true;
  if (!isCloudAiProvider(provider)) return false;
  const normalized = model.trim().replace(/^models\//, "");
  const discovered = getStoredCloudModelCatalog(provider)?.models.find(({ id }) => id === normalized)?.searchSupported;
  if (typeof discovered === "boolean") return discovered;
  return groundingModels[provider].some((id) => normalized === id || (
    normalized.startsWith(`${id}-`) && /^\d{8}$|^\d{4}-\d{2}-\d{2}$/.test(normalized.slice(id.length + 1))
  ));
}
export function getEffectiveGroundingSearchMode(provider: AiProvider, model = DEFAULT_AI_MODELS[provider]): GroundingSearchMode {
  return supportsGroundingSearch(provider, model) ? getStoredGroundingSearchMode() : "off";
}
export function saveGroundingSearchMode(mode: GroundingSearchMode) {
  if (typeof window === "undefined") return;
  localStorage.setItem("songdocent_grounding_search_mode", normalizeGroundingSearchMode(mode));
  window.dispatchEvent(new Event("songdocent-grounding-search-changed"));
}


export type CloudModelCatalog = {
  provider: CloudAiProvider;
  models: AiModelOption[];
  fetchedAt: number;
};
export const CLOUD_MODEL_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cloudCatalogKey = (provider: CloudAiProvider) => `songdocent_cloud_models_v1_${provider}`;

export function getStoredCloudModelCatalog(provider: CloudAiProvider): CloudModelCatalog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cloudCatalogKey(provider));
    if (!raw) return null;
    const catalog = JSON.parse(raw) as CloudModelCatalog;
    if (!isCloudModelCatalog(catalog, provider)) return null;
    return catalog;
  } catch { return null; }
}

export function isCloudModelCatalog(value: unknown, provider: CloudAiProvider): value is CloudModelCatalog {
  if (!value || typeof value !== "object") return false;
  const catalog = value as CloudModelCatalog;
  return catalog.provider === provider && Number.isFinite(catalog.fetchedAt)
    && Array.isArray(catalog.models) && catalog.models.length > 0
    && catalog.models.every((model) => model && typeof model.id === "string" && !!model.id.trim()
      && typeof model.label === "string" && typeof model.description === "string"
      && (model.searchSupported == null || typeof model.searchSupported === "boolean")
      && (model.structuredOutputSupported == null || typeof model.structuredOutputSupported === "boolean"));
}

function geminiModelOrder(model: AiModelOption) {
  const id = normalizedApiModel(model.id);
  const latestTier = ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-pro-latest"].indexOf(id);
  if (latestTier >= 0) return { group: 0, version: "", tier: latestTier, preview: 0, id };
  const standard = /^gemini-(\d+(?:\.\d+)*?)-(flash-lite|flash|pro)(?:-(?:preview|exp|latest|\d+))*$/.exec(id);
  if (standard) {
    return {
      group: 1,
      version: standard[1],
      tier: ["flash-lite", "flash", "pro"].indexOf(standard[2]),
      preview: /-(preview|exp)(?:-|$)/.test(id) ? 1 : 0,
      id,
    };
  }
  const group = id.startsWith("gemini-") ? 2 : id.startsWith("gemma-") ? 3 : 4;
  return { group, version: "", tier: 0, preview: 0, id };
}

export function cloudModelOptions(catalog: CloudModelCatalog): readonly AiModelOption[] {
  const options = catalog.models.map((model) => ({ ...model,
    description: CLOUD_AI_MODEL_OPTIONS[catalog.provider].find(({ id }) => id === model.id)?.description || model.description,
  }));
  if (catalog.provider === "gemini") {
    options.sort((a, b) => {
      const left = geminiModelOrder(a);
      const right = geminiModelOrder(b);
      return left.group - right.group
        || right.version.localeCompare(left.version, "en", { numeric: true })
        || left.tier - right.tier
        || left.preview - right.preview
        || left.id.localeCompare(right.id, "en", { numeric: true });
    });
  }
  return options;
}

export function saveCloudModelCatalog(catalog: CloudModelCatalog) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(cloudCatalogKey(catalog.provider), JSON.stringify(catalog)); } catch { /* Keep the live list even if storage is full. */ }
}

export function getCloudAiModelOptions(provider: CloudAiProvider): readonly AiModelOption[] {
  const cached = getStoredCloudModelCatalog(provider);
  if (!cached) return cloudModelOptions({ provider, models: [...CLOUD_AI_MODEL_OPTIONS[provider]], fetchedAt: 0 });
  // Keep editorial descriptions only for models whose identity is known.
  return cloudModelOptions(cached);
}
