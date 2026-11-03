// @vitest-environment jsdom

import React, { forwardRef, useState, type ComponentPropsWithoutRef } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SettingsModal } from "./SettingsModal";
import type { LangCode } from "./i18n";
import {
  isProviderExpired,
  markProviderExpired,
} from "./providerConnection";
import type { SecretStatus, SettingsSection } from "./settings";

const mocks = vi.hoisted(() => ({
  clearError: vi.fn(),
  reportError: vi.fn(),
  getSecretStatus: vi.fn(),
  saveSecret: vi.fn(),
  clearSecret: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => true,
}));

vi.mock("./AppErrorProvider", () => ({
  useAppError: () => ({
    clearError: mocks.clearError,
    reportError: mocks.reportError,
  }),
}));

vi.mock("./setup/secretClient", () => ({
  getSecretStatus: mocks.getSecretStatus,
  saveSecret: mocks.saveSecret,
  clearSecret: mocks.clearSecret,
}));

vi.mock("framer-motion", async () => {
  const motionCache = new Map<string, React.ComponentType<Record<string, unknown>>>();
  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      const cached = motionCache.get(tag);
      if (cached) return cached;
      const Component = forwardRef<HTMLElement, ComponentPropsWithoutRef<"div"> & {
        children?: React.ReactNode;
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
      }>(({
        children,
        initial: _initial,
        animate: _animate,
        exit: _exit,
        transition: _transition,
        ...props
      }, ref) => React.createElement(tag, { ...props, ref }, children));
      motionCache.set(tag, Component as React.ComponentType<Record<string, unknown>>);
      return Component;
    },
  });
  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion,
  };
});

const EMPTY_STATUS: SecretStatus = {
  spotifySpDc: false,
  appleMusicMediaUserToken: false,
  openaiApiKey: false,
  geminiApiKey: false,
  claudeApiKey: false,
  openaiCompatibleApiKey: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function SettingsHarness({
  initialOpen = true,
  initialPrimerAccepted = false,
  initialSection = "ai",
  onPrimerAccepted,
}: {
  initialOpen?: boolean;
  initialPrimerAccepted?: boolean;
  initialSection?: SettingsSection;
  onPrimerAccepted?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [primerAccepted, setPrimerAccepted] = useState(initialPrimerAccepted);
  const [uiLang, setUiLang] = useState<LangCode>("en");
  const [targetLang, setTargetLang] = useState<string>("en");

  return (
    <>
      <button data-testid="settings-opener" onClick={() => setOpen(true)}>
        Open settings
      </button>
      <SettingsModal
        open={open}
        initialSection={initialSection}
        onClose={() => setOpen(false)}
        onOpenSetupGuide={() => undefined}
        primerAccepted={primerAccepted}
        onPrimerAccepted={() => {
          onPrimerAccepted?.();
          setPrimerAccepted(true);
        }}
        uiLang={uiLang}
        targetLang={targetLang}
        setUiLang={setUiLang}
        setTargetLang={setTargetLang}
      />
    </>
  );
}

const getGeminiInput = () => screen.getByLabelText(/Gemini API Key/) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.getSecretStatus.mockResolvedValue(EMPTY_STATUS);
  mocks.saveSecret.mockResolvedValue(undefined);
  mocks.clearSecret.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe("Settings Keychain orchestration", () => {
  test("connects, refreshes, and disconnects a lyrics provider without profile data", async () => {
    const user = userEvent.setup();
    const connected = deferred<{
      connectionId: number;
      provider: "spotify";
      phase: "connected";
      code: null;
    }>();
    markProviderExpired("spotify");
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true })
      .mockResolvedValueOnce(EMPTY_STATUS);
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({
          connectionId: 21,
          provider: "spotify",
          phase: "waiting_for_login",
          code: null,
        });
      }
      if (command === "get_provider_connection_status") return connected.promise;
      return Promise.resolve(undefined);
    });
    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    expect(screen.queryByText("Unofficial connection")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Sign in with Spotify" }));
    expect(mocks.invoke).not.toHaveBeenCalledWith("start_provider_connection", expect.anything());
    const riskDialog = await screen.findByRole("dialog", {
      name: /Understand the risk before connecting Spotify/,
    });
    await user.click(within(riskDialog).getByRole("button", {
      name: "I understand the risk and connect",
    }));
    expect(await screen.findByText("Finish signing in in the opened window. It closes automatically when you’re done.")).toBeTruthy();

    connected.resolve({ connectionId: 21, provider: "spotify", phase: "connected", code: null });
    expect(await screen.findByText("Lyrics connected.")).toBeTruthy();
    await waitFor(() => expect(isProviderExpired("spotify")).toBe(false));
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("button", { name: "Sign in again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeTruthy();
    expect(screen.queryByText(/email|avatar|account name/i)).toBeNull();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(mocks.clearSecret).toHaveBeenCalledWith("spotify_sp_dc"));
    expect(isProviderExpired("spotify")).toBe(false);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("button", { name: "Sign in with Spotify" })).toBeTruthy();
  });

  test("starts first login only after storage consent and risk confirmation, and can cancel it", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockImplementation((command: string) => command === "start_provider_connection"
      ? Promise.resolve({ connectionId: 55, provider: "spotify", phase: "waiting_for_login", code: null })
      : new Promise(() => {}));
    render(<SettingsHarness initialSection="lyrics" />);
    await user.click(screen.getByRole("button", { name: "Sign in with Spotify" }));
    expect(await screen.findByRole("dialog", { name: "Keep credentials in macOS Keychain" })).toBeTruthy();
    expect(mocks.getSecretStatus).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalledWith("start_provider_connection", expect.anything());
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const risk = await screen.findByRole("dialog", { name: /Understand the risk before connecting Spotify/ });
    expect(mocks.invoke).not.toHaveBeenCalledWith("start_provider_connection", expect.anything());
    await user.click(within(risk).getByRole("button", { name: "I understand the risk and connect" }));
    expect(await screen.findByText("Finish signing in in the opened window. It closes automatically when you’re done.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("cancel_provider_connection", { connectionId: 55 }));
    expect(screen.getByRole("button", { name: "Sign in with Spotify" })).toBeTruthy();
  });

  test("closes a login window when its start finishes after the user cancelled", async () => {
    const user = userEvent.setup();
    const start = deferred<{ connectionId: number; provider: "spotify"; phase: "waiting_for_login"; code: null }>();
    mocks.invoke.mockImplementation((command: string) => command === "start_provider_connection"
      ? start.promise : Promise.resolve(undefined));
    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Sign in with Spotify" }));
    const risk = await screen.findByRole("dialog", { name: /Understand the risk before connecting Spotify/ });
    await user.click(within(risk).getByRole("button", { name: "I understand the risk and connect" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    start.resolve({ connectionId: 56, provider: "spotify", phase: "waiting_for_login", code: null });
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("cancel_provider_connection", { connectionId: 56 }));
    expect(screen.getByRole("button", { name: "Sign in with Spotify" })).toBeTruthy();
  });

  test("shows expired lyrics sessions and clears expiry on disconnect", async () => {
    const user = userEvent.setup();
    markProviderExpired("spotify");
    mocks.getSecretStatus
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true })
      .mockResolvedValueOnce(EMPTY_STATUS);

    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Your login expired. Sign in again.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign in again" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Disconnect" }));
    await waitFor(() => expect(mocks.clearSecret).toHaveBeenCalledWith("spotify_sp_dc"));
    expect(isProviderExpired("spotify")).toBe(false);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
  });

  test("explains the next step and hides manual connection information by default", async () => {
    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("button", { name: "Sign in with Spotify" })).toBeTruthy();
    expect(screen.getByText("Sign in to Spotify to get lyrics.")).toBeTruthy();
    expect(screen.getByText("Having trouble signing in?").closest("details")?.open).toBe(false);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("selects broad translation languages while retaining the eight app languages", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialSection="language" initialPrimerAccepted />);
    const appLanguage = await screen.findByRole("combobox", { name: "App Language" });
    expect(within(appLanguage).getAllByRole("option")).toHaveLength(8);
    const search = screen.getByRole("searchbox", { name: "Search languages" });
    await user.type(search, "Swahili");
    const target = screen.getByRole("combobox", { name: "Translate Lyrics To" }) as HTMLSelectElement;
    await user.click(screen.getByRole("button", { name: /Kiswahili/ }));
    expect(target.value).toBe("sw");
    expect((appLanguage as HTMLSelectElement).value).toBe("en");
  });

  test("supports arrow, Home and End navigation with one tab stop", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());
    const ai = screen.getByRole("tab", { name: /^AI$/ });
    ai.focus();
    await user.keyboard("{ArrowDown}");
    const lyrics = screen.getByRole("tab", { name: /^Lyrics$/ });
    expect(document.activeElement).toBe(lyrics);
    expect(lyrics.getAttribute("aria-selected")).toBe("true");
    expect(ai.tabIndex).toBe(-1);
    await user.keyboard("{End}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Updates" }));
    await user.keyboard("{Home}");
    expect(document.activeElement).toBe(ai);
    expect(screen.getByRole("tabpanel", { name: "AI" }).getAttribute("aria-labelledby")).toBe(ai.id);
  });

  test("offers key issuance without automatic saving guidance next to the AI inputs", async () => {
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());
    expect(screen.getByRole("link", { name: /Get an API key/ }).getAttribute("href"))
      .toBe("https://aistudio.google.com/apikey");
    expect(screen.queryByText(/Selections save automatically/)).toBeNull();
    expect(screen.getByRole("option", { name: /^Custom$/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Gemini 3.5 Flash" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Gemini 3.1 Flash-Lite" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Gemini 3.1 Pro Preview" })).toBeTruthy();
  });

  test.each([
    { provider: "gemini", ids: ["gemini-flash-lite-latest", "gemini-flash-latest", "gemini-pro-latest"] },
    { provider: "openai", ids: ["gpt-9.1-luna", "gpt-9.1-terra", "gpt-9.1-sol"] },
    { provider: "claude", ids: ["claude-haiku-9-5", "claude-sonnet-9-5", "claude-opus-9-5"] },
  ])("shows family guidance for discovered $provider models without changing the selection", async ({ provider, ids }) => {
    localStorage.setItem("songdocent_ai_provider", provider);
    localStorage.setItem(`songdocent_ai_model_${provider}`, ids[1]);
    localStorage.setItem(`songdocent_cloud_models_v1_${provider}`, JSON.stringify({
      provider,
      fetchedAt: Date.now(),
      models: [...ids, "unknown-model"].map((id) => ({ id, label: id, description: "Outdated guidance" })),
    }));
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());
    expect(screen.getByRole("option", { name: `${ids[0]} · Fast · recommended for lyric translation` })).toBeTruthy();
    const selected = screen.getByRole("option", { name: `${ids[1]} · Balance of speed and quality` });
    expect(selected.getAttribute("value")).toBe(ids[1]);
    expect(selected.closest("select")?.value).toBe(ids[1]);
    expect(screen.getByRole("option", { name: `${ids[2]} · For complex tasks · takes longer` })).toBeTruthy();
    expect(screen.getByRole("option", { name: "unknown-model" }).textContent).toBe("unknown-model");
  });

  test("saves API reasoning per model and restores it across model and provider changes", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());
    const reasoning = () => screen.getByRole<HTMLSelectElement>("combobox", { name: "Reasoning" });
    const model = () => screen.getByRole("combobox", { name: /^Model/ });
    await user.selectOptions(reasoning(), "minimal");
    expect(localStorage.getItem("songdocent_ai_api_reasoning_gemini_gemini-3.5-flash")).toBe("minimal");
    await user.selectOptions(model(), "gemini-3.1-pro-preview");
    expect(reasoning().querySelector('option[value="minimal"]')).toBeNull();
    await user.selectOptions(reasoning(), "high");
    await user.selectOptions(model(), "gemini-3.5-flash");
    expect(reasoning().value).toBe("minimal");
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    await user.selectOptions(reasoning(), "none");
    expect(localStorage.getItem("songdocent_ai_api_reasoning_openai_gpt-5.4-mini")).toBe("none");
    await user.click(screen.getByRole("button", { name: "Gemini" }));
    expect(reasoning().value).toBe("minimal");
    await user.selectOptions(reasoning(), "");
    expect(localStorage.getItem("songdocent_ai_api_reasoning_gemini_gemini-3.5-flash")).toBe("");
  });

  test("unverified API models show only a disabled default reasoning choice", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());
    await user.selectOptions(screen.getByRole("combobox", { name: /^Model/ }), "__custom__");
    const reasoning = screen.getByRole("combobox", { name: "Reasoning" });
    expect(reasoning.hasAttribute("disabled")).toBe(true);
    expect(reasoning.querySelectorAll("option")).toHaveLength(1);
    expect(screen.getByText("Reasoning levels are unavailable or not yet verified for this model.")).toBeTruthy();
  });

  test("configures and tests an OpenAI-compatible provider", async () => {
    const user = userEvent.setup();
    mocks.invoke.mockResolvedValue({ ok: true, message: "Connection successful.", models: ["vendor-model"] });
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "OpenAI compatible" }));
    const baseUrl = screen.getByLabelText(/^Base URL/) as HTMLInputElement;
    const model = screen.getByLabelText(/^Model/) as HTMLInputElement;
    await user.type(baseUrl, "https://api.example.com/v1");
    await user.tab();
    await user.type(model, "vendor-model");
    await user.tab();
    expect(screen.getByLabelText(/^API Key \(optional\)/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("test_openai_compatible_connection", {
      provider: "openai_compatible",
      baseUrl: "https://api.example.com/v1",
      model: "vendor-model",
    }));
  });

  test("keeps chunking simple by default and saves advanced mode and size changes", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    const chunkingSwitch = screen.getByRole("switch", { name: "Split long lyrics automatically" });
    expect(chunkingSwitch.getAttribute("aria-checked"))
      .toBe("true");
    expect(screen.getByText("For 80+ lines, translate in groups of up to 25.")).toBeTruthy();
    const advanced = screen.getByText("Advanced settings").closest("details") as HTMLDetailsElement;
    expect(advanced.open).toBe(false);
    await user.click(screen.getByText("Advanced settings"));
    expect(advanced.open).toBe(true);

    const thresholdInput = screen.getByLabelText(/Split from how many lines/) as HTMLInputElement;
    const chunkSizeInput = screen.getByLabelText(/Lines per group/) as HTMLInputElement;

    expect(thresholdInput.value).toBe("80");
    expect(chunkSizeInput.value).toBe("25");

    fireEvent.change(thresholdInput, { target: { value: "100" } });
    fireEvent.change(chunkSizeInput, { target: { value: "30" } });
    expect(screen.getByText("For 100+ lines, translate in groups of up to 30.")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: /Always split short lyrics too/ }));

    expect(localStorage.getItem("songdocent_translation_chunk_mode")).toBe("always");
    expect(localStorage.getItem("songdocent_translation_chunk_threshold")).toBe("100");
    expect(localStorage.getItem("songdocent_translation_chunk_size")).toBe("30");
    expect(screen.queryByLabelText(/Split from how many lines/)).toBeNull();
    expect(screen.getByText("Translate in groups of up to 30, regardless of lyric length.")).toBeTruthy();

    await user.click(chunkingSwitch);
    expect(localStorage.getItem("songdocent_translation_chunk_mode")).toBe("off");
    expect(screen.getByText("Translate all lyrics in one request.")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /Always split short lyrics too/ })).toBeNull();
    expect(screen.queryByLabelText(/Lines per group/)).toBeNull();

    await user.click(chunkingSwitch);
    expect(localStorage.getItem("songdocent_translation_chunk_mode")).toBe("auto");
    expect(screen.getByText("For 100+ lines, translate in groups of up to 30.")).toBeTruthy();
  });

  test("shows the risk dialog again before reconnecting from Settings", async () => {
    const user = userEvent.setup();
    localStorage.setItem("songdocent_provider_risk_ack_v1_spotify", "1");
    markProviderExpired("spotify");
    mocks.getSecretStatus.mockResolvedValue({ ...EMPTY_STATUS, spotifySpDc: true });
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({
          connectionId: 44,
          provider: "spotify",
          phase: "waiting_for_login",
          code: null,
        });
      }
      return Promise.resolve(undefined);
    });

    render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Sign in again" }));
    expect(mocks.invoke).not.toHaveBeenCalledWith(
      "start_provider_connection",
      expect.anything(),
    );
    const riskDialog = await screen.findByRole("dialog", {
      name: /Understand the risk before connecting Spotify/,
    });

    await user.click(within(riskDialog).getByRole("button", {
      name: "I understand the risk and connect",
    }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "start_provider_connection",
      { provider: "spotify", language: "en" },
    ));
  });

  test("queues before consent, saves once after Continue, and Cancel performs no secret command", async () => {
    const order: string[] = [];
    mocks.saveSecret.mockImplementation(async () => {
      order.push("set");
    });
    const user = userEvent.setup();
    const { unmount } = render(
      <SettingsHarness onPrimerAccepted={() => order.push("consent")} />,
    );

    const input = getGeminiInput();
    fireEvent.change(input, { target: { value: "gemini-secret" } });
    fireEvent.blur(input);

    expect(await screen.findByRole("dialog", { name: "Keep credentials in macOS Keychain" })).toBeTruthy();
    expect(mocks.getSecretStatus).not.toHaveBeenCalled();
    expect(mocks.saveSecret).not.toHaveBeenCalled();
    expect(mocks.clearSecret).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledTimes(1));
    expect(order.slice(0, 2)).toEqual(["consent", "set"]);

    unmount();
    vi.clearAllMocks();
    mocks.getSecretStatus.mockResolvedValue(EMPTY_STATUS);
    render(<SettingsHarness />);
    const cancelledInput = getGeminiInput();
    fireEvent.change(cancelledInput, { target: { value: "keep-this-draft" } });
    fireEvent.blur(cancelledInput);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(cancelledInput.value).toBe("keep-this-draft");
    expect(mocks.getSecretStatus).not.toHaveBeenCalled();
    expect(mocks.saveSecret).not.toHaveBeenCalled();
    expect(mocks.clearSecret).not.toHaveBeenCalled();
  });

  test("preserves a failed mutation error while a successful status refresh reconciles fields", async () => {
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(getGeminiInput().disabled).toBe(false));
    mocks.clearError.mockClear();
    mocks.reportError.mockClear();
    mocks.saveSecret.mockRejectedValueOnce(new Error("save denied"));

    const input = getGeminiInput();
    fireEvent.change(input, { target: { value: "rejected-secret" } });
    fireEvent.blur(input);

    await waitFor(() => expect(mocks.reportError).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
    expect(mocks.clearError).not.toHaveBeenCalled();
    expect(getGeminiInput().value).toBe("");
    await waitFor(() => {
      expect(document.querySelector(".settings-window")?.getAttribute("data-save-feedback"))
        .toBe("Could not save changes. Try again.");
    });
  });

  test("an old status promise cannot overwrite a closed and reopened generation", async () => {
    const firstStatus = deferred<SecretStatus>();
    const reopenedStatus = deferred<SecretStatus>();
    mocks.getSecretStatus
      .mockImplementationOnce(() => firstStatus.promise)
      .mockImplementationOnce(() => reopenedStatus.promise);
    const user = userEvent.setup();
    render(<SettingsHarness initialOpen={false} initialPrimerAccepted />);

    await user.click(screen.getByTestId("settings-opener"));
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Close settings" }));
    await user.click(screen.getByTestId("settings-opener"));
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));

    reopenedStatus.resolve(EMPTY_STATUS);
    await waitFor(() => expect(getGeminiInput().disabled).toBe(false));
    firstStatus.resolve({ ...EMPTY_STATUS, geminiApiKey: true });
    await act(async () => firstStatus.promise);

    expect(getGeminiInput().value).toBe("");
    expect(getGeminiInput().disabled).toBe(false);
  });

  test("a Gemini save result never masks the current unsaved OpenAI field", async () => {
    const save = deferred<void>();
    mocks.saveSecret.mockImplementationOnce(() => save.promise);
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, geminiApiKey: true });
    const user = userEvent.setup();
    render(<SettingsHarness initialPrimerAccepted />);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    mocks.clearError.mockClear();

    const geminiInput = getGeminiInput();
    fireEvent.change(geminiInput, { target: { value: "gemini-secret" } });
    fireEvent.blur(geminiInput);
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    mocks.clearError.mockClear();
    save.resolve();

    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
    const openAiInput = screen.getByLabelText(/OpenAI API Key/) as HTMLInputElement;
    await waitFor(() => expect(openAiInput.disabled).toBe(false));
    expect(openAiInput.value).toBe("");
    expect(mocks.clearError).toHaveBeenCalledTimes(1);
  });

  test("ignores a rejected local test after the provider changes", async () => {
    const connection = deferred<{ ok: boolean; message: string; models: string[] }>();
    localStorage.setItem("songdocent_ai_provider", "gemini");
    mocks.invoke.mockImplementationOnce(() => connection.promise);
    const user = userEvent.setup();
    render(<SettingsHarness />);

    await user.click(screen.getByRole("tab", { name: "Local models" }));
    await user.click(screen.getByRole("button", { name: "Ollama (local)" }));
    mocks.reportError.mockClear();
    await user.click(screen.getByRole("button", { name: "Test Connection" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "LM Studio (local)" }));
    connection.reject(new Error("obsolete provider failure"));
    await act(async () => {
      try {
        await connection.promise;
      } catch {
        // The component owns the rejection.
      }
    });

    expect(mocks.reportError).not.toHaveBeenCalled();
  });

  test("owns outer modal focus and inert state while the nested primer owns its dialog", async () => {
    const user = userEvent.setup();
    render(<SettingsHarness initialOpen={false} />);
    const opener = screen.getByTestId("settings-opener") as HTMLButtonElement;

    await user.click(opener);
    const close = await screen.findByRole("button", { name: "Close settings" });
    await waitFor(() => expect(document.activeElement).toBe(close));
    expect(opener.inert).toBe(true);
    expect(opener.getAttribute("aria-hidden")).toBe("true");

    const input = getGeminiInput();
    fireEvent.change(input, { target: { value: "editable-draft" } });
    fireEvent.blur(input);
    const primer = await screen.findByRole("dialog", {
      name: "Keep credentials in macOS Keychain",
    });
    const settingsDialog = document.querySelector(".settings-window") as HTMLElement;
    expect(settingsDialog.hasAttribute("inert")).toBe(true);
    expect(settingsDialog.getAttribute("aria-hidden")).toBe("true");
    expect(primer.hasAttribute("inert")).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Continue" }));
    });

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(document.activeElement).toBe(input));
    expect(settingsDialog.hasAttribute("inert")).toBe(false);
    expect(settingsDialog.getAttribute("aria-hidden")).toBeNull();
    expect(input.value).toBe("editable-draft");

    await user.click(close);
    await waitFor(() => expect(document.activeElement).toBe(opener));
    expect(opener.inert).not.toBe(true);
    expect(opener.getAttribute("aria-hidden")).toBeNull();
  });
});

 test("search grounding persists three modes and is unavailable for local providers", async () => {
  const user = userEvent.setup();
  render(<SettingsHarness initialPrimerAccepted />);
  const search = await screen.findByRole("combobox", { name: "Web search grounding" });
  expect((search as HTMLSelectElement).value).toBe("off");
  await user.selectOptions(search, "translation");
  expect(localStorage.getItem("songdocent_grounding_search_mode")).toBe("translation");
  await user.selectOptions(search, "off");
  expect(localStorage.getItem("songdocent_grounding_search_mode")).toBe("off");
  await user.click(screen.getByRole("tab", { name: "Local models" }));
  await user.click(screen.getByRole("button", { name: /Ollama/ }));
  expect(screen.queryByRole("combobox", { name: "Web search grounding" })).toBeNull();
  await user.click(screen.getByRole("tab", { name: "API key" }));
  await user.click(screen.getByRole("button", { name: /^OpenAI$/ }));
  expect(screen.getByRole("combobox", { name: "Web search grounding" })).toBeTruthy();
  await user.selectOptions(screen.getByRole("combobox", { name: /^Model/ }), "__custom__");
  const custom = screen.getByPlaceholderText("model-id");
  await user.clear(custom);
  await user.type(custom, "gpt-4.1-nano");
  expect(screen.queryByRole("combobox", { name: "Web search grounding" })).toBeNull();
  await user.clear(custom);
  await user.type(custom, "gpt-5.4-mini-2026-03-17");
  expect(screen.getByRole("combobox", { name: "Web search grounding" })).toBeTruthy();
 });

test.each([
  ["timed_out", null, "The connection timed out."],
  ["terminal_error", "credential_store_denied", "SongDocent could not save the session in secure storage."],
  ["recoverable_error", "credential_invalid", "The captured session is invalid."],
  ["terminal_error", "navigation_blocked", "The sign-in page was blocked for safety."],
])("lyrics settings explain connection failure %s/%s", async (phase, code, message) => {
  const user = userEvent.setup();
  mocks.invoke.mockImplementation(async (command) => command === "start_provider_connection"
    ? { connectionId: 1, provider: "spotify", phase, code } : null);
  render(<SettingsHarness initialPrimerAccepted initialSection="lyrics" />);
  const button = await screen.findByRole("button", { name: "Sign in with Spotify" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  await user.click(button);
  await user.click(screen.getByRole("button", { name: "I understand the risk and connect" }));
  expect(await screen.findByText(message as string)).toBeTruthy();
});
