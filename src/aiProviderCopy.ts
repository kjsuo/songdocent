import { dictionary, type LangCode } from "./i18n";
import { AI_PROVIDER_LABELS, type AiProvider } from "./settings";

export function aiProviderLabel(provider: AiProvider, lang: LangCode): string {
  const copy = dictionary[lang];
  if (provider === "ollama") return `Ollama (${copy.local})`;
  if (provider === "lmstudio") return `LM Studio (${copy.local})`;
  if (provider === "openai_compatible") return copy.openaiCompatible;
  return AI_PROVIDER_LABELS[provider];
}
