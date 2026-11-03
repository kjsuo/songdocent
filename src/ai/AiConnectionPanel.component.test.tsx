// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AiConnectionPanel } from "./AiConnectionPanel";
import {
  aiConnectionMode,
  configForProvider,
  getStoredTranslationConfig,
  saveTranslationConfig,
  storedProviderForMode,
  type AiProvider,
} from "../settings";

const mocks = vi.hoisted(() => ({ invoke: vi.fn(), ready: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => true,
}));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn().mockResolvedValue(undefined) }));
const statuses = ["codex_cli", "claude_cli", "gemini_cli", "antigravity_cli", "opencode_cli"].map(
  (provider) => ({
    provider,
    installation: "installed",
    path: `/usr/local/bin/${provider}`,
    version: "1.0.0",
  }),
);
const catalog = {
  live: true,
  models: [
    { id: "__cli_default__", label: "Default", reasoningOptions: [] },
    {
      id: "vendor/model",
      label: "Vendor model",
      reasoningOptions: ["high", "low"],
    },
  ],
};
function baseline(command: string) {
  if (command === "scan_cli_providers") return Promise.resolve(statuses);
  if (command === "list_cli_models") return Promise.resolve(catalog);
  if (command === "test_cli_connection")
    return Promise.resolve({ ok: true, searchVerified: true });
  return Promise.resolve();
}
function Harness() {
  const [provider, setProvider] = useState<AiProvider>(
    () => getStoredTranslationConfig().provider,
  );
  return (
    <AiConnectionPanel
      provider={provider}
      onProviderChange={setProvider}
      uiLang="en"
      onReadyChange={mocks.ready}
    >
      <input aria-label="API field" />
    </AiConnectionPanel>
  );
}
beforeEach(() => {
  localStorage.clear();
  mocks.invoke.mockReset().mockImplementation(baseline);
  mocks.ready.mockReset();
});
afterEach(cleanup);
test("keeps saved API settings and switches modes without automatically testing", async () => {
  localStorage.setItem("songdocent_ai_provider", "openai");
  localStorage.setItem("songdocent_ai_model_openai", "saved-api-model");
  const user = userEvent.setup();
  render(<Harness />);
  expect(mocks.invoke).not.toHaveBeenCalled();
  await user.click(screen.getByRole("tab", { name: "CLI" }));
  expect(
    await screen.findByRole("button", { name: /Codex CLI.*Installed/ }),
  ).toBeTruthy();
  expect(
    mocks.invoke.mock.calls.some(([name]) => name === "test_cli_connection"),
  ).toBe(false);
  await user.click(screen.getByRole("tab", { name: "API key" }));
  expect(getStoredTranslationConfig()).toEqual({
    provider: "openai",
    model: "saved-api-model",
  });
});
test("new users select the first compatible CLI in fixed order", async () => {
  mocks.invoke.mockImplementation((command) =>
    command === "scan_cli_providers"
      ? Promise.resolve([...statuses].reverse())
      : baseline(command),
  );
  render(<Harness />);
  await waitFor(() =>
    expect(getStoredTranslationConfig().provider).toBe("codex_cli"),
  );
  expect(
    screen.getByRole("tab", { name: "CLI" }).getAttribute("aria-selected"),
  ).toBe("true");
});
test("no installed CLI exposes installation guides and custom path without claiming a connection", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  mocks.invoke.mockImplementation((command) =>
    command === "scan_cli_providers"
      ? Promise.resolve(
          statuses.map((status) => ({ ...status, installation: "missing" })),
        )
      : baseline(command),
  );
  render(<Harness />);
  await waitFor(() =>
    expect(screen.queryByText("Checking installed CLIs…")).toBeNull(),
  );
  expect(screen.getAllByRole("link", { name: /Install/ })).toHaveLength(5);
  expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
  expect(screen.getByLabelText("Executable path")).toBeTruthy();
});
test("changes to model, reasoning, search and path invalidate connection success", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  const user = userEvent.setup();
  render(<Harness />);
  await screen.findByRole("button", { name: "Test connection" });
  await user.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Connection verified");
  await user.selectOptions(screen.getByLabelText("Model"), "vendor/model");
  expect(screen.queryByText("Connection verified")).toBeNull();
  await user.selectOptions(screen.getByLabelText("Reasoning"), "high");
  expect(getStoredTranslationConfig().cliOptions?.reasoning).toBe("high");
  await user.selectOptions(screen.getByLabelText("Web search"), "translation");
  await user.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Connection verified");
  expect(mocks.invoke).toHaveBeenCalledWith(
    "test_cli_connection",
    expect.objectContaining({
      searchMode: "translation",
      model: "vendor/model",
      cliOptions: expect.objectContaining({ reasoning: "high" }),
    }),
  );
  await user.click(screen.getByText("Advanced: executable path"));
  const path = screen.getByLabelText("Executable path");
  await user.type(path, "/Applications/도구 폴더/codex");
  await user.tab();
  expect(screen.queryByText("Connection verified")).toBeNull();
  expect(getStoredTranslationConfig().cliOptions?.executablePath).toBe(
    "/Applications/도구 폴더/codex",
  );
});
test("switching CLI cancels an old test and ignores its late success", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  let finish: (value: {
    ok: boolean;
    searchVerified: boolean;
  }) => void = () => {};
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  mocks.invoke.mockImplementation((command) =>
    command === "test_cli_connection" ? pending : baseline(command),
  );
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    await screen.findByRole("button", { name: "Test connection" }),
  );
  await user.click(
    screen.getByRole("button", { name: /Claude Code.*Installed/ }),
  );
  await act(async () => finish({ ok: true, searchVerified: false }));
  expect(screen.queryByText("Connection verified")).toBeNull();
  expect(
    mocks.invoke.mock.calls.some(
      ([command]) => command === "cancel_cli_ai_request",
    ),
  ).toBe(true);
  expect(mocks.ready).not.toHaveBeenCalledWith(true);
});
test("OpenCode requires verified search when search is enabled", async () => {
  localStorage.setItem("songdocent_ai_provider", "opencode_cli");
  localStorage.setItem("songdocent_grounding_search_mode", "annotation");
  mocks.invoke.mockImplementation((command) =>
    command === "test_cli_connection"
      ? Promise.resolve({ ok: true, searchVerified: false })
      : baseline(command),
  );
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(
    await screen.findByRole("button", { name: "Test connection" }),
  );
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(mocks.ready).not.toHaveBeenCalledWith(true);
});
test("configuration round trips preserve per-tool options and legacy API keys", () => {
  localStorage.setItem("songdocent_ai_provider", "gemini");
  localStorage.setItem("songdocent_ai_model_gemini", "existing-model");
  expect(getStoredTranslationConfig()).toEqual({
    provider: "gemini",
    model: "existing-model",
  });
  saveTranslationConfig({
    provider: "opencode_cli",
    model: "vendor/exact-model",
    cliOptions: { executablePath: "/a folder/cli", reasoning: "high" },
  });
  saveTranslationConfig({ provider: "openai", model: "api-model" });
  expect(aiConnectionMode(storedProviderForMode("cli"))).toBe("cli");
  expect(configForProvider("opencode_cli")).toEqual({
    provider: "opencode_cli",
    model: "vendor/exact-model",
    cliOptions: { executablePath: "/a folder/cli", reasoning: "high" },
  });
});

test("selects Antigravity and tests a custom model with reasoning", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(await screen.findByRole("button", { name: /Antigravity CLI.*Installed/ }));
  await user.selectOptions(await screen.findByLabelText("Model"), "__custom__");
  await user.type(screen.getByLabelText("Model ID"), "vendor/model");
  await user.selectOptions(screen.getByLabelText("Reasoning"), "high");
  await user.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Connection verified");
  expect(mocks.invoke).toHaveBeenCalledWith("test_cli_connection", expect.objectContaining({
    provider: "antigravity_cli", model: "vendor/model",
    cliOptions: expect.objectContaining({ reasoning: "high" }),
  }));
  expect(getStoredTranslationConfig()).toEqual({
    provider: "antigravity_cli", model: "vendor/model", cliOptions: { reasoning: "high" },
  });
});

test.each([
  ["codex_cli", "npm install -g @openai/codex@latest"],
  ["claude_cli", "claude update"],
  ["gemini_cli", "npm install -g @google/gemini-cli@latest"],
  ["antigravity_cli", "agy update"],
  ["opencode_cli", "opencode upgrade"],
])("offers the update command for %s", async (provider, command) => {
  localStorage.setItem("songdocent_ai_provider", provider);
  mocks.invoke.mockImplementation((name) => name === "scan_cli_providers"
    ? Promise.resolve(statuses.map((status) => status.provider === provider ? { ...status, installation: "unsupported" } : status))
    : baseline(name));
  render(<Harness />);
  expect(await screen.findByText(command)).toBeTruthy();
  expect(screen.getByText(/Could not confirm the features SongDocent requires/)).toBeTruthy();
  expect(screen.getByText(/The latest version is not required/)).toBeTruthy();
  expect(screen.getByText(`/usr/local/bin/${provider}`)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
});

test("reports clipboard success and failure", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("denied"));
  const user = userEvent.setup();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  mocks.invoke.mockImplementation((name) => name === "scan_cli_providers"
    ? Promise.resolve(statuses.map((status) => status.provider === "codex_cli" ? { ...status, installation: "unsupported" } : status))
    : baseline(name));
  render(<Harness />);
  await user.click(await screen.findByRole("button", { name: "Copy command" }));
  expect(await screen.findByText("Copied")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Copy command" }));
  expect(await screen.findByText(/Could not copy/)).toBeTruthy();
  expect(writeText).toHaveBeenCalledWith("npm install -g @openai/codex@latest");
});

test("verification failure offers version check and recovers after recheck", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  let scans = 0;
  mocks.invoke.mockImplementation((name) => name === "scan_cli_providers"
    ? Promise.resolve(++scans === 1 ? statuses.map((status) => status.provider === "codex_cli" ? { ...status, installation: "check_failed", message: "CLI_TIMEOUT: secret diagnostic", version: null, path: null } : status) : statuses)
    : baseline(name));
  const user = userEvent.setup();
  render(<Harness />);
  expect(await screen.findByText("codex --version")).toBeTruthy();
  expect(screen.getByText(/The CLI timed out/)).toBeTruthy();
  expect(screen.queryByText(/Update the CLI/)).toBeNull();
  expect(screen.queryByText(/secret diagnostic/)).toBeNull();
  await user.click(screen.getByRole("button", { name: "Recheck" }));
  expect(await screen.findByRole("button", { name: "Test connection" })).toBeTruthy();
  expect(scans).toBe(2);
});

test("returning from the official guide scans only once", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  mocks.invoke.mockImplementation((name) => name === "scan_cli_providers"
    ? Promise.resolve(statuses.map((status) => status.provider === "codex_cli" ? { ...status, installation: "unsupported" } : status))
    : baseline(name));
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(await screen.findByRole("link", { name: /Official guide/ }));
  act(() => { window.dispatchEvent(new Event("focus")); document.dispatchEvent(new Event("visibilitychange")); });
  await waitFor(() => expect(mocks.invoke.mock.calls.filter(([name]) => name === "scan_cli_providers")).toHaveLength(2));
  expect(mocks.invoke.mock.calls.filter(([name]) => name === "test_cli_connection")).toHaveLength(0);
});


test("recheck invalidates a successful connection when required features disappear", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  let scans = 0;
  mocks.invoke.mockImplementation((name) => name === "scan_cli_providers"
    ? Promise.resolve(++scans === 1 ? statuses : statuses.map((status) => status.provider === "codex_cli" ? { ...status, installation: "unsupported", missingFeatures: ["--output-schema"] } : status))
    : baseline(name));
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(await screen.findByRole("button", { name: "Test connection" }));
  await waitFor(() => expect(mocks.ready).toHaveBeenLastCalledWith(true));
  await user.click(screen.getByRole("button", { name: "Rescan" }));
  expect(await screen.findByText("npm install -g @openai/codex@latest")).toBeTruthy();
  await waitFor(() => expect(mocks.ready).toHaveBeenLastCalledWith(false));
  expect(screen.queryByRole("button", { name: "Test connection" })).toBeNull();
});

test("updates CLI errors and reasoning labels when the interface language changes", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  mocks.invoke.mockImplementation((command) =>
    command === "test_cli_connection"
      ? Promise.reject("CLI_AUTH_REQUIRED")
      : baseline(command),
  );
  const user = userEvent.setup();
  const panel = (uiLang: "en" | "es") => (
    <AiConnectionPanel provider="codex_cli" onProviderChange={() => {}} uiLang={uiLang} />
  );
  const view = render(panel("en"));
  await user.click(await screen.findByRole("button", { name: "Test connection" }));
  await screen.findByText("Sign in with this CLI in your terminal, then test again.");
  await user.selectOptions(screen.getByLabelText("Model"), "vendor/model");
  expect(screen.getByRole("option", { name: "High" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Test connection" }));
  await screen.findByText("Sign in with this CLI in your terminal, then test again.");
  view.rerender(panel("es"));
  expect(screen.getByRole("option", { name: "Alto" })).toBeTruthy();
  expect(screen.getByText("Inicie sesión con esta CLI en su terminal y luego pruebe nuevamente.")).toBeTruthy();
});


test("keeps model refresh beneath the selector without a CLI catalog heading", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  const user = userEvent.setup();
  render(<Harness />);
  await screen.findByRole("option", { name: "Vendor model" });
  expect(screen.queryByText("Models reported by CLI")).toBeNull();
  const modelField = screen.getByLabelText("Model").closest(".ai-model-field");
  expect(modelField?.contains(screen.getByRole("button", { name: "Refresh" }))).toBe(true);
  await user.click(screen.getByRole("button", { name: "Refresh" }));
  await waitFor(() => expect(mocks.invoke.mock.calls.filter(([name]) => name === "list_cli_models")).toHaveLength(2));
});

test.each([
  "CLI_AUTH_REQUIRED: sign in again",
  { code: "CLI_AUTH_REQUIRED", technicalMessage: "authentication expired" },
])("shows login recovery only after an authentication error %j", async (error) => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  let attempts = 0;
  mocks.invoke.mockImplementation((command) =>
    command === "test_cli_connection" && attempts++ === 0
      ? Promise.reject(error)
      : baseline(command),
  );
  const user = userEvent.setup();
  render(<Harness />);
  const testButton = await screen.findByRole("button", { name: "Test connection" });
  expect(screen.queryByText("codex login")).toBeNull();
  expect(screen.queryByRole("link", { name: /Sign-in guide/ })).toBeNull();
  await user.click(testButton);
  expect(await screen.findByText("codex login")).toBeTruthy();
  expect(screen.getByRole("link", { name: /Sign-in guide/ })).toBeTruthy();
  await user.click(testButton);
  await screen.findByText("Connection verified");
  expect(screen.queryByText("codex login")).toBeNull();
});

test("does not show login recovery for unrelated connection errors", async () => {
  localStorage.setItem("songdocent_ai_provider", "codex_cli");
  mocks.invoke.mockImplementation((command) =>
    command === "test_cli_connection"
      ? Promise.reject({ code: "CLI_RATE_LIMITED", technicalMessage: "try later" })
      : baseline(command),
  );
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(await screen.findByRole("button", { name: "Test connection" }));
  await screen.findByRole("alert");
  expect(screen.queryByText("codex login")).toBeNull();
  expect(screen.queryByRole("link", { name: /Sign-in guide/ })).toBeNull();
});


test.each([
  { provider: "codex_cli", ids: ["gpt-9.1-luna", "gpt-9.1-terra", "gpt-9.1-sol"] },
  { provider: "claude_cli", ids: ["haiku", "sonnet", "opus"] },
  { provider: "gemini_cli", ids: ["flash-lite", "flash", "pro"] },
  { provider: "antigravity_cli", ids: ["gemini-3.5-flash-lite", "gemini-3.8-flash-low", "claude-opus-9-5-thinking"] },
  { provider: "opencode_cli", ids: ["openai/gpt-9.1-luna", "google/gemini-9.1-flash", "anthropic/claude-opus-9-5"] },
])("$provider decorates only offered models and preserves the selected model ID", async ({ provider, ids }) => {
  localStorage.setItem("songdocent_ai_provider", provider);
  localStorage.setItem(`songdocent_ai_model_${provider}`, ids[1]);
  mocks.invoke.mockImplementation((command) => command === "list_cli_models"
    ? Promise.resolve({ live: true, models: [...ids, "unknown-model"].map((id) => ({ id, label: id, reasoningOptions: [] })) })
    : baseline(command));
  const user = userEvent.setup();
  render(<Harness />);
  expect(await screen.findByRole("option", { name: `${ids[0]} · Fast · recommended for lyric translation` })).toBeTruthy();
  expect(screen.getByRole("option", { name: `${ids[1]} · Balance of speed and quality` })).toBeTruthy();
  expect(screen.getByRole("option", { name: `${ids[2]} · For complex tasks · takes longer` })).toBeTruthy();
  expect(screen.getByRole("option", { name: "unknown-model" })).toBeTruthy();
  const model = screen.getByRole<HTMLSelectElement>("combobox", { name: "Model" });
  expect(model.value).toBe(ids[1]);
  expect(model.options).toHaveLength(6);
  expect(screen.getByRole("option", { name: "CLI default · Follows CLI settings" })).toBeTruthy();
  await user.selectOptions(model, ids[0]);
  expect(getStoredTranslationConfig().model).toBe(ids[0]);
  expect(mocks.invoke.mock.calls.some(([command]) => command === "test_cli_connection")).toBe(false);
});
