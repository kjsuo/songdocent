// @vitest-environment jsdom

import { StrictMode, useState } from "react";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { SetupWizard, type SetupWizardMode } from "./SetupWizard";
import { SETUP_COPY } from "./setupContent";
import type { SecretStatus } from "../settings";
import type { DesktopPlatform } from "../platform/platformCopy";

const mocks = vi.hoisted(() => ({
  getSecretStatus: vi.fn(),
  isDesktopRuntime: vi.fn(),
  saveSecret: vi.fn(),
  validateCredential: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mocks.invoke,
  isTauri: () => true,
}));

vi.mock("./secretClient", () => ({
  getSecretStatus: mocks.getSecretStatus,
  isDesktopRuntime: mocks.isDesktopRuntime,
  saveSecret: mocks.saveSecret,
  validateCredential: mocks.validateCredential,
}));

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

function WizardHarness({
  initialPrimerAccepted = false,
  mode = "first-run",
  onComplete = vi.fn(),
  onSkip = vi.fn(),
  onClose = vi.fn(),
  platform = "macos",
}: {
  initialPrimerAccepted?: boolean;
  mode?: SetupWizardMode;
  onComplete?: () => void;
  onSkip?: () => void;
  onClose?: () => void;
  platform?: DesktopPlatform;
}) {
  const [primerAccepted, setPrimerAccepted] = useState(initialPrimerAccepted);

  return (
    <SetupWizard
      mode={mode}
      primerAccepted={primerAccepted}
      onPrimerAccepted={() => setPrimerAccepted(true)}
      onComplete={onComplete}
      onSkip={onSkip}
      onClose={onClose}
      platform={platform}
    />
  );
}

async function reachLyrics(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(mocks.getSecretStatus).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Choose a lyrics provider" });
}

async function reachAiWithSavedSpotify(
  user: ReturnType<typeof userEvent.setup>,
  status: SecretStatus = { ...EMPTY_STATUS, spotifySpDc: true },
) {
  mocks.getSecretStatus.mockResolvedValue(status);
  await reachLyrics(user);
  await waitFor(() =>
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
  );
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Choose an AI provider" });
}

async function confirmSpotifyRisk(user: ReturnType<typeof userEvent.setup>) {
  const riskDialog = await screen.findByRole("dialog", {
    name: /Understand the risk before connecting Spotify/,
  });
  await user.click(within(riskDialog).getByRole("button", {
    name: "I understand the risk and connect",
  }));
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  mocks.isDesktopRuntime.mockReturnValue(true);
  mocks.getSecretStatus.mockResolvedValue(EMPTY_STATUS);
  mocks.saveSecret.mockResolvedValue(undefined);
  mocks.invoke.mockResolvedValue(null);
});

afterEach(() => cleanup());

describe("SetupWizard credential and review flow", () => {
  test("CLI setup requires a current connection test and search verification without an API key", async () => {
    localStorage.setItem("songdocent_ai_provider", "codex_cli");
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "scan_cli_providers") return [{ provider: "codex_cli", installation: "installed", path: "/usr/bin/codex", version: "1.0" }];
      if (command === "list_cli_models") return { live: true, models: [] };
      if (command === "test_cli_connection") return { ok: true, searchVerified: false };
      return null;
    });
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);
    await user.click(await screen.findByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(continueButton.disabled).toBe(false));
    expect(mocks.saveSecret).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText("Web search"), "translation");
    await waitFor(() => expect(continueButton.disabled).toBe(true));
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Test connection" }).getAttribute("disabled")).toBeNull());
    expect(continueButton.disabled).toBe(true);
    mocks.invoke.mockImplementation(async (command: string) => {
      if (command === "test_cli_connection") return { ok: true, searchVerified: true };
      return null;
    });
    await user.click(screen.getByRole("button", { name: "Test connection" }));
    await waitFor(() => expect(continueButton.disabled).toBe(false));
    await user.click(continueButton);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Review and finish" });
    expect((screen.getByRole("button", { name: "Complete setup" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("connects Spotify only after the risk action and refreshes saved status", async () => {
    const user = userEvent.setup();
    const connected = deferred<{
      connectionId: number;
      provider: "spotify";
      phase: "connected";
      code: null;
    }>();
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true });
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({
          connectionId: 7,
          provider: "spotify",
          phase: "waiting_for_login",
          code: null,
        });
      }
      if (command === "get_provider_connection_status") return connected.promise;
      return Promise.resolve(undefined);
    });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.click(screen.getByRole("button", { name: "Connect Spotify" }));
    expect(mocks.invoke).not.toHaveBeenCalledWith("start_provider_connection", expect.anything());
    const riskDialog = await screen.findByRole("dialog");
    expect(within(riskDialog).queryByRole("checkbox")).toBeNull();
    await user.click(within(riskDialog).getByRole("button", {
      name: "I understand the risk and connect",
    }));

    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "start_provider_connection",
      { provider: "spotify", language: "en" },
    ));
    expect(await screen.findByText("Finish signing in in the Spotify window.")).toBeTruthy();

    connected.resolve({
      connectionId: 7,
      provider: "spotify",
      phase: "connected",
      code: null,
    });
    expect(await screen.findByText("Connected")).toBeTruthy();
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test.each([
    ["validating", null, "Checking the session securely…"],
    ["timed_out", "connection_timed_out", "The connection timed out."],
    ["recoverable_error", "credential_invalid", "The captured session is invalid."],
    ["recoverable_error", "credential_validation_unavailable", "The service could not verify the session."],
    ["terminal_error", "credential_store_denied", "SongDocent could not save the session in secure storage."],
  ] as const)("renders the %s connection result", async (phase, code, expected) => {
    const user = userEvent.setup();
    localStorage.setItem("songdocent_provider_risk_ack_v1_spotify", "1");
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({ connectionId: 8, provider: "spotify", phase, code });
      }
      return Promise.resolve(undefined);
    });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.click(screen.getByRole("button", { name: "Connect Spotify" }));
    await confirmSpotifyRisk(user);
    expect(await screen.findByText(expected)).toBeTruthy();
  });

  test("switching providers cancels only the active connection", async () => {
    const user = userEvent.setup();
    const pendingStatus = deferred<never>();
    localStorage.setItem("songdocent_provider_risk_ack_v1_spotify", "1");
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({
          connectionId: 9,
          provider: "spotify",
          phase: "waiting_for_login",
          code: null,
        });
      }
      if (command === "get_provider_connection_status") return pendingStatus.promise;
      return Promise.resolve(undefined);
    });
    render(<WizardHarness />);
    await reachLyrics(user);
    await user.click(screen.getByRole("button", { name: "Connect Spotify" }));
    await confirmSpotifyRisk(user);
    expect(await screen.findByText("Finish signing in in the Spotify window.")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Apple Music" }));
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith(
      "cancel_provider_connection",
      { connectionId: 9 },
    ));
    expect(screen.getByRole("button", { name: "Connect Apple Music" })).toBeTruthy();
    expect(screen.queryByText("Finish signing in in the Spotify window.")).toBeNull();
  });

  test("closing the provider window is a neutral cancellation", async () => {
    const user = userEvent.setup();
    const nextStatus = deferred<{
      connectionId: number;
      provider: "spotify";
      phase: "cancelled";
      code: null;
    }>();
    localStorage.setItem("songdocent_provider_risk_ack_v1_spotify", "1");
    mocks.invoke.mockImplementation((command: string) => {
      if (command === "start_provider_connection") {
        return Promise.resolve({
          connectionId: 10,
          provider: "spotify",
          phase: "waiting_for_login",
          code: null,
        });
      }
      if (command === "get_provider_connection_status") return nextStatus.promise;
      return Promise.resolve(undefined);
    });
    render(<WizardHarness />);
    await reachLyrics(user);
    await user.click(screen.getByRole("button", { name: "Connect Spotify" }));
    await confirmSpotifyRisk(user);
    expect(await screen.findByText("Finish signing in in the Spotify window.")).toBeTruthy();

    nextStatus.resolve({ connectionId: 10, provider: "spotify", phase: "cancelled", code: null });
    await waitFor(() => expect(
      screen.queryByText("Finish signing in in the Spotify window."),
    ).toBeNull());
    expect(screen.getByRole("button", { name: "Connect Spotify" })).toBeTruthy();
    expect(screen.queryByText("The service could not verify the session.")).toBeNull();
  });

  test("keeps manual cookie entry behind an advanced disclosure", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachLyrics(user);

    const summary = screen.getByText("Enter cookie manually (advanced)");
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    await user.click(summary);
    expect(details.open).toBe(true);
    expect(screen.getByLabelText("Spotify SP_DC")).toBeTruthy();
  });

  test("uses Windows credential and Chrome-only guidance on Windows", async () => {
    const user = userEvent.setup();
    render(<WizardHarness platform="windows" />);

    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", {
      name: "Keep credentials in Windows Credential Manager",
    })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: "Chrome" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Safari" })).toBeNull();
    expect(screen.getByText(/Ctrl–Shift–I/)).toBeTruthy();
    expect(screen.queryByText(/Command–Option–I/)).toBeNull();
  });

  test("exposes a dedicated noninteractive drag strip at the very top of the window", () => {
    const { container } = render(<WizardHarness />);

    const dragRegion = container.querySelector(
      ".setup-wizard-titlebar-drag-region[data-tauri-drag-region]",
    );
    expect(dragRegion).toBeTruthy();
    expect(dragRegion?.classList.contains("setup-wizard-titlebar-drag-region")).toBe(true);
    expect(dragRegion?.getAttribute("aria-hidden")).toBe("true");
    expect(dragRegion?.querySelector("button, a, input, select, textarea")).toBeNull();
  });

  test("moves focus to each entered step heading without stealing it on same-step rerenders", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);

    const welcomeHeading = screen.getByRole("heading", { name: "Welcome to SongDocent" });
    await waitFor(() => expect(document.activeElement).toBe(welcomeHeading));

    await user.click(screen.getByRole("button", { name: "Continue" }));
    const keychainHeading = screen.getByRole("heading", {
      name: "Keep credentials in macOS Keychain",
    });
    await waitFor(() => expect(document.activeElement).toBe(keychainHeading));

    const languageSelect = screen.getByLabelText("App language");
    await user.selectOptions(languageSelect, "ko");
    expect(document.activeElement).toBe(languageSelect);
  });

  test("keeps ordered semantic progress without visible current or upcoming labels", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);

    const progress = screen.getByRole("complementary", { name: "Setup progress" });
    const steps = within(progress).getAllByRole("listitem");
    expect(steps).toHaveLength(6);
    expect(steps[0].getAttribute("aria-current")).toBe("step");
    expect(within(progress).queryByText("Current")).toBeNull();
    expect(within(progress).queryByText("Upcoming")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(steps[0].getAttribute("aria-current")).toBeNull();
    expect(steps[1].getAttribute("aria-current")).toBe("step");
    expect(within(progress).queryByText("Current")).toBeNull();
    expect(within(progress).queryByText("Upcoming")).toBeNull();
  });

  test("supports keyboard-only step navigation and exposes fixed navigation around a scrolling detail region", async () => {
    const user = userEvent.setup();
    const { container } = render(<WizardHarness />);

    expect(container.querySelector(".setup-wizard-shell")).toBeTruthy();
    expect(container.querySelector('[data-fixed-region="progress"]')).toBeTruthy();
    expect(container.querySelector('[data-scroll-region="detail"]')).toBeTruthy();
    const fixedNavigation = container.querySelector('[data-fixed-region="navigation"]');
    expect(fixedNavigation).toBeTruthy();
    const header = container.querySelector(".setup-wizard-header");
    expect(header).toBeTruthy();
    expect(within(header as HTMLElement).getByRole("button", { name: "Skip setup" })).toBeTruthy();
    expect(within(fixedNavigation as HTMLElement).queryByRole("button", { name: "Skip setup" })).toBeNull();

    const continueButton = screen.getByRole("button", { name: "Continue" });
    continueButton.focus();
    await user.keyboard("{Enter}");
    const keychainHeading = screen.getByRole("heading", {
      name: "Keep credentials in macOS Keychain",
    });
    await waitFor(() => expect(document.activeElement).toBe(keychainHeading));
    expect(within(fixedNavigation as HTMLElement).getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  test("loads SecretStatus once per wizard open under StrictMode", async () => {
    const user = userEvent.setup();
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
    });
    render(
      <StrictMode>
        <WizardHarness initialPrimerAccepted />
      </StrictMode>,
    );

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
    );
  });

  test("accepts the primer before loading status and persists lyrics selection", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);

    await reachLyrics(user);

    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Apple Music" }));
    expect(localStorage.getItem("songdocent_lyrics_source")).toBe("apple_music");
    expect(screen.getByRole("heading", { name: "Find Apple Music media-user-token in Chrome" })).toBeTruthy();
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });

  test("requires verification when a new draft replaces an already saved credential", async () => {
    const user = userEvent.setup();
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
    });
    render(<WizardHarness />);

    await reachLyrics(user);
    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect(screen.getByText(SETUP_COPY.en.reviewLabels.ready)).toBeTruthy();

    await user.type(screen.getByLabelText("Spotify SP_DC"), "unverified-replacement");

    expect(screen.queryByText(SETUP_COPY.en.reviewLabels.ready)).toBeNull();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("uses provider brand backgrounds without visible selected markers", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachLyrics(user);

    const spotify = screen.getByRole("button", { name: "Spotify" }) as HTMLButtonElement;
    expect(spotify.style.backgroundColor).toBe("rgba(29, 185, 84, 0.15)");
    expect(spotify.classList.contains("text-white")).toBe(true);
    expect(spotify.classList.contains("text-black")).toBe(false);
    expect(spotify.getAttribute("aria-pressed")).toBe("true");
    expect(spotify.querySelector("svg")).toBeNull();
    expect(screen.queryByText("Selected")).toBeNull();

    const appleMusic = screen.getByRole("button", { name: "Apple Music" }) as HTMLButtonElement;
    await user.click(appleMusic);
    expect(appleMusic.style.backgroundColor).toBe("rgba(255, 78, 107, 0.15)");
    expect(appleMusic.classList.contains("text-white")).toBe(true);
    expect(appleMusic.classList.contains("text-black")).toBe(false);
    expect(appleMusic.getAttribute("aria-pressed")).toBe("true");
    expect(appleMusic.querySelector("svg")).toBeNull();
    expect(screen.queryByText("Selected")).toBeNull();
  });

  test("keeps browser tab semantics while hiding all wizard choice markers", async () => {
    const user = userEvent.setup();
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
    });
    render(<WizardHarness />);
    await reachLyrics(user);

    const chrome = screen.getByRole("button", { name: "Chrome" });
    const safari = screen.getByRole("button", { name: "Safari" });
    expect(chrome.getAttribute("aria-pressed")).toBe("true");
    expect(chrome.dataset.selected).toBe("true");
    expect(chrome.querySelector("svg")).toBeNull();
    expect(safari.getAttribute("aria-pressed")).toBe("false");
    expect(safari.dataset.selected).toBe("false");
    expect(screen.queryByText("Selected")).toBeNull();

    await user.click(safari);
    expect(chrome.getAttribute("aria-pressed")).toBe("false");
    expect(safari.getAttribute("aria-pressed")).toBe("true");
    expect(safari.querySelector("svg")).toBeNull();
    expect(screen.queryByText("Selected")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Choose an AI provider" });
    expect(screen.queryByText("Selected")).toBeNull();
  });

  test("omits the localized Korean selected marker while retaining pressed semantics", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.selectOptions(screen.getByLabelText("App language"), "ko");

    const spotify = screen.getByRole("button", { name: "Spotify" });
    const chrome = screen.getByRole("button", { name: "Chrome" });
    expect(spotify.getAttribute("aria-pressed")).toBe("true");
    expect(chrome.getAttribute("aria-pressed")).toBe("true");
    expect(spotify.querySelector("svg")).toBeNull();
    expect(chrome.querySelector("svg")).toBeNull();
    expect(screen.queryByText("선택됨")).toBeNull();
  });

  test("a late initial status load cannot overwrite a newer saved credential status", async () => {
    const initialStatus = deferred<SecretStatus>();
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.getSecretStatus
      .mockReturnValueOnce(initialStatus.promise)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    expect(await screen.findByText(SETUP_COPY.en.validation.valid)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);

    await act(async () => {
      initialStatus.resolve(EMPTY_STATUS);
      await initialStatus.promise;
    });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("keeps a post-save status refresh when the provider changes", async () => {
    const initialStatus = deferred<SecretStatus>();
    const refreshedStatus = deferred<SecretStatus>();
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.getSecretStatus
      .mockReturnValueOnce(initialStatus.promise)
      .mockReturnValueOnce(refreshedStatus.promise);
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: "Apple Music" }));

    await act(async () => {
      refreshedStatus.resolve({
        ...EMPTY_STATUS,
        spotifySpDc: true,
        appleMusicMediaUserToken: true,
      });
      await refreshedStatus.promise;
    });

    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("a late initial status failure cannot clear a newer saved credential status", async () => {
    const initialStatus = deferred<SecretStatus>();
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.getSecretStatus
      .mockReturnValueOnce(initialStatus.promise)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "new-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    expect(await screen.findByText(SETUP_COPY.en.validation.valid)).toBeTruthy();

    await act(async () => {
      initialStatus.reject(new Error("stale load failed"));
      await initialStatus.promise.catch(() => undefined);
    });
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("global Skip setup works from a credential step", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    render(<WizardHarness onSkip={onSkip} />);
    await reachLyrics(user);

    await user.click(screen.getByRole("button", { name: "Skip setup" }));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  test("Back preserves partial credential input and provider guide choices", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.click(screen.getByRole("button", { name: "Apple Music" }));
    await user.click(screen.getByRole("button", { name: "Safari" }));
    await user.type(
      screen.getByLabelText("Apple Music media-user-token"),
      "partial-token",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByRole("button", { name: "Apple Music" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Safari" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByLabelText("Apple Music media-user-token") as HTMLInputElement).value).toBe("partial-token");
  });

  test.each([
    {
      provider: "Spotify",
      input: "Spotify SP_DC",
      kind: "spotify_sp_dc",
      value: "spotify-secret",
      refreshed: { ...EMPTY_STATUS, spotifySpDc: true },
    },
    {
      provider: "Apple Music",
      input: "Apple Music media-user-token",
      kind: "apple_music_media_user_token",
      value: "apple-secret",
      refreshed: { ...EMPTY_STATUS, appleMusicMediaUserToken: true },
    },
  ])("validates and saves one $provider credential exactly once", async ({
    provider,
    input,
    kind,
    value,
    refreshed,
  }) => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockResolvedValueOnce(refreshed);
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.click(screen.getByRole("button", { name: provider }));
    await user.type(screen.getByLabelText(input), value);
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    await screen.findByText(SETUP_COPY.en.validation.valid);
    expect(mocks.validateCredential).toHaveBeenCalledWith(kind, value);
    expect(mocks.saveSecret).toHaveBeenCalledTimes(1);
    expect(mocks.saveSecret).toHaveBeenCalledWith(kind, value);
    expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("invalid validation never saves and blocks Continue with localized feedback", async () => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "invalid", code: "bad" });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "wrong-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    expect(await screen.findByText(SETUP_COPY.en.validation.invalid)).toBeTruthy();
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.getAttribute("data-status")).toBe("invalid");
    expect(status.querySelector('[data-status-icon="invalid"]')).toBeTruthy();
    expect(mocks.saveSecret).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  });

  test("prevents duplicate validation while the first request is pending", async () => {
    const pendingValidation = deferred<{ status: "invalid"; code: string }>();
    const user = userEvent.setup();
    mocks.validateCredential.mockReturnValue(pendingValidation.promise);
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "one-request");
    const validateButton = screen.getByRole("button", { name: "Verify credential" });
    validateButton.click();
    validateButton.click();
    expect(mocks.validateCredential).toHaveBeenCalledTimes(1);

    pendingValidation.resolve({ status: "invalid", code: "bad" });
    expect(await screen.findByText(SETUP_COPY.en.validation.invalid)).toBeTruthy();
  });

  test("disables lyrics provider and browser controls during credential validation", async () => {
    const pendingValidation = deferred<{ status: "invalid"; code: string }>();
    const user = userEvent.setup();
    mocks.validateCredential.mockReturnValue(pendingValidation.promise);
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "pending-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    expect((screen.getByRole("button", { name: "Spotify" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Apple Music" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Chrome" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Safari" }) as HTMLButtonElement).disabled).toBe(true);

    pendingValidation.resolve({ status: "invalid", code: "bad" });
    expect(await screen.findByText(SETUP_COPY.en.validation.invalid)).toBeTruthy();
  });

  test("unavailable validation saves only after the explicit Save Anyway action", async () => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "unavailable", code: "offline" });
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockResolvedValueOnce({ ...EMPTY_STATUS, spotifySpDc: true });
    render(<WizardHarness />);
    await reachLyrics(user);

    await user.type(screen.getByLabelText("Spotify SP_DC"), "offline-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    expect(await screen.findByText(SETUP_COPY.en.validation.unavailable)).toBeTruthy();
    expect(mocks.saveSecret).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: "Save anyway and continue" }));
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledTimes(1));
    expect(mocks.saveSecret).toHaveBeenCalledWith("spotify_sp_dc", "offline-secret");
    expect(await screen.findByText("Credential saved.")).toBeTruthy();
    const status = screen.getByRole("status");
    expect(status.getAttribute("data-status")).toBe("saved");
    expect(status.querySelector('[data-status-icon="saved"]')).toBeTruthy();
    expect(screen.queryByText(SETUP_COPY.en.validation.unavailable)).toBeNull();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("clears the secret and enables Continue when save succeeds but status refresh fails", async () => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.getSecretStatus
      .mockResolvedValueOnce(EMPTY_STATUS)
      .mockRejectedValueOnce(new Error("refresh failed"));
    render(<WizardHarness />);
    await reachLyrics(user);

    const input = screen.getByLabelText("Spotify SP_DC") as HTMLInputElement;
    await user.type(input, "must-be-cleared");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    expect(await screen.findByText(SETUP_COPY.en.validation.valid)).toBeTruthy();
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2));
    expect(input.value).toBe("");
    expect(screen.queryByText(SETUP_COPY.en.validation.cancelled)).toBeNull();
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("uses connection tabs above provider details and preserves the credential flow", async () => {
    const user = userEvent.setup();
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);
    const tabs = screen.getByRole("tablist", { name: "Connection method" });
    const provider = screen.getByRole("button", { name: "Gemini" });
    const guide = screen.getByRole("heading", { name: "Create a Gemini API key" });
    expect(tabs.compareDocumentPosition(provider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(provider.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("AI model")).toBeTruthy();
    expect(screen.getByLabelText("Gemini API key")).toBeTruthy();
  });

  test("preserves local configuration and can switch to API without skipping setup", async () => {
    const onSkip = vi.fn();
    const user = userEvent.setup();
    localStorage.setItem("songdocent_ai_provider", "ollama");
    localStorage.setItem("songdocent_ai_model_ollama", "local-model");
    render(<WizardHarness onSkip={onSkip} />);
    await reachAiWithSavedSpotify(user);
    expect(screen.getByRole("tab", { name: "Local models" }).getAttribute("aria-selected")).toBe("true");
    expect((screen.getByLabelText("Model") as HTMLInputElement).value).toBe("local-model");
    await user.click(screen.getByRole("tab", { name: "API key" }));
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    await user.selectOptions(screen.getByLabelText("AI model"), "gpt-5.5");
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("openai");
    expect(localStorage.getItem("songdocent_ai_model_openai")).toBe("gpt-5.5");
    await user.click(screen.getByRole("tab", { name: "Local models" }));
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("ollama");
    await user.click(screen.getByRole("tab", { name: "API key" }));
    expect((screen.getByLabelText("AI model") as HTMLSelectElement).value).toBe("gpt-5.5");
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("openai");
    expect(localStorage.getItem("songdocent_ai_model_openai")).toBe("gpt-5.5");
    expect(onSkip).not.toHaveBeenCalled();
  });

  test("reentry local model selection keeps the wizard open", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<WizardHarness mode="reentry" onClose={onClose} />);
    await reachAiWithSavedSpotify(user);
    await user.click(screen.getByRole("tab", { name: "Local models" }));
    expect(screen.getByRole("button", { name: "Test connection" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  test("uses a curated fallback when switching to a provider with a custom saved model", async () => {
    const user = userEvent.setup();
    localStorage.setItem("songdocent_ai_provider", "ollama");
    localStorage.setItem("songdocent_ai_model_openai", "custom-openai-model");
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);
    await user.click(screen.getByRole("tab", { name: "API key" }));
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    expect((screen.getByLabelText("AI model") as HTMLSelectElement).value).toBe("gpt-5.4-mini");
    expect(localStorage.getItem("songdocent_ai_model_openai")).toBe("gpt-5.4-mini");
  });

  test("disables AI provider and model controls while a key save is pending", async () => {
    const pendingSave = deferred<void>();
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.saveSecret.mockReturnValue(pendingSave.promise);
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);

    await user.type(screen.getByLabelText("Gemini API key"), "pending-key");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledTimes(1));

    expect((screen.getByRole("button", { name: "Gemini" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "OpenAI" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("AI model") as HTMLSelectElement).disabled).toBe(true);

    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
      geminiApiKey: true,
    });
    pendingSave.resolve();
    expect(await screen.findByText(SETUP_COPY.en.validation.valid)).toBeTruthy();
  });

  test("keeps a local config until the user explicitly switches to API", async () => {
    const user = userEvent.setup();
    localStorage.setItem("songdocent_ai_provider", "ollama");
    localStorage.setItem("songdocent_ai_model_ollama", "local-model");
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user, {
      ...EMPTY_STATUS,
      spotifySpDc: true,
      geminiApiKey: true,
    });

    expect(localStorage.getItem("songdocent_ai_provider")).toBe("ollama");
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("tab", { name: "API key" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("heading", { name: "Choose a translation language" })).toBeTruthy();
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("gemini");
    expect(localStorage.getItem("songdocent_ai_model_gemini")).toBe("gemini-3.5-flash");
  });

  test("persists the displayed Gemini config as soon as its key is saved", async () => {
    const user = userEvent.setup();
    localStorage.setItem("songdocent_ai_provider", "lmstudio");
    localStorage.setItem("songdocent_ai_model_lmstudio", "local-model");
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("lmstudio");
    await user.click(screen.getByRole("tab", { name: "API key" }));
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
      geminiApiKey: true,
    });

    await user.type(screen.getByLabelText("Gemini API key"), "gemini-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));
    expect(await screen.findByText(SETUP_COPY.en.validation.valid)).toBeTruthy();

    expect(localStorage.getItem("songdocent_ai_provider")).toBe("gemini");
    expect(localStorage.getItem("songdocent_ai_model_gemini")).toBe("gemini-3.5-flash");
  });

  test("selects Claude and validates its own API key", async () => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user);

    await user.click(screen.getByRole("button", { name: "Claude" }));
    expect(screen.getByRole("heading", { name: "Create a Claude API key" })).toBeTruthy();
    expect((screen.getByLabelText("AI model") as HTMLSelectElement).value).toBe("claude-sonnet-5-5");
    await user.type(screen.getByLabelText("Claude API key"), "claude-secret");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    await waitFor(() => expect(mocks.validateCredential).toHaveBeenCalledWith("claude_api_key", "claude-secret"));
    await waitFor(() => expect(mocks.saveSecret).toHaveBeenCalledWith("claude_api_key", "claude-secret"));
    expect(localStorage.getItem("songdocent_ai_provider")).toBe("claude");
  });

  test("restores a broad translation target without changing the app language", async () => {
    const user = userEvent.setup();
    localStorage.setItem("targetLang", "th");
    mocks.getSecretStatus.mockResolvedValue({ ...EMPTY_STATUS, spotifySpDc: true, geminiApiKey: true });
    render(<WizardHarness />);
    await reachAiWithSavedSpotify(user, { ...EMPTY_STATUS, spotifySpDc: true, geminiApiKey: true });
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const select = screen.getByLabelText("Translation target") as HTMLSelectElement;
    expect(select.value).toBe("th");
    expect(localStorage.getItem("uiLang")).toBe("en");
    await user.type(screen.getByRole("searchbox", { name: "Search languages" }), "Hindi");
    await user.click(screen.getByRole("button", { name: /हिन्दी/ }));
    expect(localStorage.getItem("targetLang")).toBe("hi");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("हिन्दी")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Complete setup" }) as HTMLButtonElement).disabled).toBe(false);
  });

  test("persists target language, reviews configured choices, and completes", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      appleMusicMediaUserToken: true,
      openaiApiKey: true,
    });
    render(<WizardHarness onComplete={onComplete} />);
    await reachLyrics(user);
    await waitFor(() => expect(mocks.getSecretStatus).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Apple Music" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "OpenAI" }));
    await user.selectOptions(screen.getByLabelText("AI model"), "gpt-5.5");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.selectOptions(screen.getByLabelText("Translation target"), "ja");
    expect(localStorage.getItem("targetLang")).toBe("ja");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    const review = screen.getByRole("heading", { name: "Review and finish" }).parentElement!;
    expect(within(review).getByText("Apple Music")).toBeTruthy();
    expect(within(review).getByText(/OpenAI.*GPT-5.5/)).toBeTruthy();
    expect(within(review).getByText("日本語")).toBeTruthy();
    expect(within(review).getAllByText("Ready")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Complete setup" }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  test("pre-existing SecretStatus enables Continue without exposing a mask or secret length", async () => {
    const user = userEvent.setup();
    mocks.getSecretStatus.mockResolvedValue({
      ...EMPTY_STATUS,
      spotifySpDc: true,
    });
    const { container } = render(<WizardHarness />);
    await reachLyrics(user);

    await waitFor(() =>
      expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(false),
    );
    expect((screen.getByLabelText("Spotify SP_DC") as HTMLInputElement).value).toBe("");
    expect(container.textContent).not.toContain("********");
    expect(container.textContent).not.toContain("spotify-secret");
  });

  test("a rejected Keychain save keeps the input editable and shows localized retry feedback", async () => {
    const user = userEvent.setup();
    mocks.validateCredential.mockResolvedValue({ status: "valid", code: "ok" });
    mocks.saveSecret.mockRejectedValue(new Error("user cancelled"));
    render(<WizardHarness />);
    await reachLyrics(user);

    const input = screen.getByLabelText("Spotify SP_DC");
    await user.type(input, "keep-editable");
    await user.click(screen.getByRole("button", { name: "Verify credential" }));

    expect(await screen.findByText(SETUP_COPY.en.validation.cancelled)).toBeTruthy();
    expect(screen.getByText(SETUP_COPY.en.validation.retry)).toBeTruthy();
    expect((input as HTMLInputElement).value).toBe("keep-editable");
    expect((input as HTMLInputElement).disabled).toBe(false);
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

test("credential store load failure is visible and retry recovers the stored status", async () => {
  const user = userEvent.setup();
  mocks.getSecretStatus.mockRejectedValueOnce({ code: "SETTINGS_LOAD_FAILED", domain: "settings", retryable: true, technicalMessage: "read denied" });
  render(<WizardHarness />);
  await reachLyrics(user);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", expect.stringContaining("Keychain"));
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(mocks.getSecretStatus).toHaveBeenCalledTimes(2);
});
