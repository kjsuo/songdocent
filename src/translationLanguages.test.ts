import { describe, expect, test } from "vitest";
import { filterTranslationLanguages, resolveTranslationLanguage, TRANSLATION_LANGUAGES, translationLanguageOptions } from "./translationLanguages";

describe("translation language selection", () => {
  test("retains saved legacy codes and detects broad system languages and scripts", () => {
    for (const code of ["pt-BR", "zh-CN", "zh-TW", "sr-Latn", "ar", "hi", "sw", "yue"]) {
      expect(resolveTranslationLanguage(code.toUpperCase())).toBe(code);
    }
    expect(resolveTranslationLanguage("th-TH")).toBe("th");
    expect(resolveTranslationLanguage("zh-Hant-HK")).toBe("zh-TW");
    expect(resolveTranslationLanguage("sr_Latn_RS")).toBe("sr-Latn");
    expect(resolveTranslationLanguage("not-a-language")).toBe("en");
    expect(resolveTranslationLanguage("zh-Hans-SG")).toBe("zh-CN");
    expect(resolveTranslationLanguage("sr-Cyrl-RS")).toBe("sr");
    expect(resolveTranslationLanguage("no-NO")).toBe("nb");
    expect(resolveTranslationLanguage("tl-PH")).toBe("fil");
    expect(resolveTranslationLanguage("akk")).toBe("en");
  });

  test("every selectable language survives restoration without becoming a UI language", () => {
    expect(TRANSLATION_LANGUAGES.length).toBe(100);
    expect(new Set(TRANSLATION_LANGUAGES.map(({ code }) => code.toLowerCase())).size).toBe(TRANSLATION_LANGUAGES.length);
    for (const { code } of TRANSLATION_LANGUAGES) expect(resolveTranslationLanguage(code)).toBe(code);
  });

  test("finds languages by localized, English, native names and codes", () => {
    const options = translationLanguageOptions("ko");
    for (const query of ["태국어", "Thai", "ไทย", "th"]) {
      expect(filterTranslationLanguages(options, query).some(({ code }) => code === "th")).toBe(true);
    }
    expect(filterTranslationLanguages(options, "sr latn").some(({ code }) => code === "sr-Latn")).toBe(true);
    expect(filterTranslationLanguages(options, "zzzzzzzz")).toHaveLength(0);
  });
});
