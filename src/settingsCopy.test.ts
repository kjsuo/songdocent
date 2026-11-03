import { describe, expect, test } from "vitest";
import { LANG_OPTIONS } from "./i18n";
import { formatSettingsCopy, settingsCopyFor } from "./settingsCopy";

describe("settings translations", () => {
  test.each(LANG_OPTIONS)("preserves dynamic values in $code", ({ code }) => {
    const copy = settingsCopyFor(code);
    expect(formatSettingsCopy(copy.login, { provider: "Spotify" })).toContain("Spotify");
    expect(formatSettingsCopy(copy.prompt, { provider: "Spotify" })).toContain("Spotify");
    expect(formatSettingsCopy(copy.clearProviderKey, { provider: "Gemini" })).toContain("Gemini");
    expect(formatSettingsCopy(copy.storedSecurely, { store: "Keychain" })).toContain("Keychain");
    expect(formatSettingsCopy(copy.savedSecurely, { store: "Keychain" })).toContain("Keychain");
    expect(formatSettingsCopy(copy.autoSummary, { threshold: 40, size: 20 })).toContain("40");
    expect(formatSettingsCopy(copy.autoSummary, { threshold: 40, size: 20 })).toContain("20");
    expect(formatSettingsCopy(copy.alwaysSummary, { size: 20 })).toContain("20");
    expect(copy.appleToken).toContain("media-user-token");
  });
});
