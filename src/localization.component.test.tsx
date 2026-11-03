// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { dictionary, LANG_OPTIONS } from "./i18n";
import { aiCopy } from "./ai/aiCopy";
import { settingsCopyFor } from "./settingsCopy";
import { UPDATE_COPY } from "./updateCopy";
import { UpdateSettings } from "./UpdateSettings";

const updates = vi.hoisted(() => ({
  phase: "available",
  version: "0.1.0",
  nextVersion: "9.8.7",
  progress: null,
  errorStage: undefined,
  busy: false,
  canInstall: true,
  restart: vi.fn(),
  install: vi.fn(),
  checkNow: vi.fn(),
}));
vi.mock("./appUpdates", () => ({ useAppUpdates: () => updates }));
afterEach(cleanup);

const installLabels = {
  en: "Install update", ko: "업데이트 설치", ja: "アップデートをインストール",
  es: "Instalar actualización", fr: "Installer la mise à jour", de: "Update installieren",
  "pt-BR": "Instalar atualização", "zh-CN": "安装更新",
};

test.each(LANG_OPTIONS)("shows a translated update action and preserves its version in $code", ({ code }) => {
  const { rerender } = render(<UpdateSettings lang={code} />);
  expect(screen.getByRole("button", { name: installLabels[code] })).toBeTruthy();
  expect(screen.getByRole("status").textContent).toContain("9.8.7");
  if (code !== "en") {
    expect(screen.getByRole("status").textContent).not.toContain("is available");
    rerender(<UpdateSettings lang="en" />);
    expect(screen.getByRole("button", { name: "Install update" })).toBeTruthy();
  }
});

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{\w+\}/g)].map(([token]) => token).sort();
}

test.each(LANG_OPTIONS)("preserves interpolation tokens and nonempty copy in $code", ({ code }) => {
  const catalogs = [
    [dictionary.en, dictionary[code]],
    [aiCopy.en, aiCopy[code]],
    [settingsCopyFor("en"), settingsCopyFor(code)],
    [UPDATE_COPY.en, UPDATE_COPY[code]],
  ];
  for (const [english, localized] of catalogs) {
    for (const [key, value] of Object.entries(localized)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(placeholders(value), key).toEqual(placeholders(Object.entries(english).find(([candidate]) => candidate === key)?.[1] ?? ""));
      if (code !== "ko") expect(value, key).not.toMatch(/[가-힣]/);
    }
  }
});
