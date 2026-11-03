// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { WaitingForMusic } from "./WaitingForMusic";

const mocks = vi.hoisted(() => ({ openUrl: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: mocks.openUrl }));
vi.mock("./platform/runtimePlatform", () => ({ DESKTOP_PLATFORM: "macos" }));
beforeEach(() => { mocks.openUrl.mockReset(); });
afterEach(cleanup);

test("shows only the selected service action and updates when the provider changes", () => {
  const view = render(<WaitingForMusic lang="ko" source="spotify" />);
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Spotify 열기" })).toBeTruthy();
  view.rerender(<WaitingForMusic lang="ko" source="apple_music" />);
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.getByRole("link", { name: "Apple Music 열기" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Spotify 열기" })).toBeNull();
});

test.each([
  ["spotify", "Spotify 열기", "spotify:"],
  ["apple_music", "Apple Music 열기", "music://"],
] as const)("opens the %s app using its native scheme", async (source, label, scheme) => {
  mocks.openUrl.mockResolvedValue(undefined);
  render(<WaitingForMusic lang="ko" source={source} />);
  fireEvent.click(screen.getByRole("link", { name: label }));
  await waitFor(() => expect(mocks.openUrl).toHaveBeenCalledWith(scheme));
});

test("shows a useful message when the selected music app cannot open", async () => {
  mocks.openUrl.mockRejectedValue(new Error("missing application"));
  render(<WaitingForMusic lang="ko" source="spotify" />);
  fireEvent.click(screen.getByRole("link", { name: "Spotify 열기" }));
  expect((await screen.findByRole("alert")).textContent).toContain("음악 앱에서 직접 재생");
});
