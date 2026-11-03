import catalog from "./translationLanguages.json" with { type: "json" };

export type TranslationLanguage = { code: string; name: string };
export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = catalog;
const byCode = new Map(catalog.map((language) => [language.code.toLowerCase(), language]));

// Script aliases resolve to the existing Chinese cache codes rather than duplicate choices.
const LANGUAGE_ALIASES: Record<string, string> = {
  zh: "zh-cn",
  "zh-hans": "zh-cn",
  "zh-hant": "zh-tw",
  "sr-cyrl": "sr",
  no: "nb",
  tl: "fil",
};

// Keep existing codes (including zh-CN / pt-BR) so saved translations retain their cache keys.
export function resolveTranslationLanguage(value: string | null | undefined): string {
  const parts = (value || "").trim().replace(/_/g, "-").toLowerCase().split("-");
  while (parts.length) {
    const key = parts.join("-");
    const match = byCode.get(LANGUAGE_ALIASES[key] || key);
    if (match) return match.code;
    parts.pop();
  }
  return "en";
}

export function initialTranslationLanguage(): string {
  const detected = typeof navigator === "undefined" ? undefined : navigator.language;
  try { return resolveTranslationLanguage(localStorage.getItem("targetLang") || detected); }
  catch { return resolveTranslationLanguage(detected); }
}

function displayName(code: string, locale: string, fallback: string): string {
  try {
    const name = new Intl.DisplayNames([locale, "en"], { type: "language", fallback: "none" }).of(code);
    return name || fallback;
  } catch {
    return fallback;
  }
}

export function translationLanguageLabel(code: string, locale = "en") {
  const name = byCode.get(code.toLowerCase())?.name || code;
  return {
    nativeName: displayName(code, code, name),
    localizedName: displayName(code, locale, name),
    name,
  };
}

export function translationLanguageOptions(locale: string) {
  return TRANSLATION_LANGUAGES.map(({ code }) => {
    const { nativeName, localizedName, name } = translationLanguageLabel(code, locale);
    return {
      code,
      label: nativeName === localizedName ? nativeName : `${nativeName} — ${localizedName}`,
      searchText: `${code} ${name} ${nativeName} ${localizedName}`.normalize("NFKD").toLocaleLowerCase(locale),
    };
  }).sort((a, b) => a.label.localeCompare(b.label, locale));
}

export function filterTranslationLanguages(options: ReturnType<typeof translationLanguageOptions>, query: string) {
  const terms = query.trim().normalize("NFKD").toLowerCase().split(/\s+/).filter(Boolean);
  return options.filter(({ searchText }) => terms.every((term) => searchText.includes(term)));
}
