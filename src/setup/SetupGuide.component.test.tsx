// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SetupGuide } from "./SetupGuide";
import { SETUP_COPY } from "./setupContent";

const mocks = vi.hoisted(() => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: mocks.openUrl,
}));

afterEach(() => {
  cleanup();
  mocks.openUrl.mockReset();
});

describe("SetupGuide official links", () => {
  test("keeps the official link and instructions without rendering screenshots", () => {
    const { container } = render(
      <SetupGuide guideId="spotifyChrome" copy={SETUP_COPY.en} />,
    );

    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(
      screen.getByRole("button", {
        name: "Open official page: https://open.spotify.com/",
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Open Spotify Web Player and sign in to the account you want to use.",
      ),
    ).toBeTruthy();
    const instructions = container.querySelector("ol");
    expect(instructions).not.toBeNull();
    expect(instructions?.nextElementSibling).toBeNull();
  });

  test("opens an exposed destination through the system opener", async () => {
    mocks.openUrl.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<SetupGuide guideId="spotifyChrome" copy={SETUP_COPY.en} />);

    const button = screen.getByRole("button", {
      name: "Open official page: https://open.spotify.com/",
    });
    expect(button.hasAttribute("disabled")).toBe(false);

    await user.click(button);

    expect(mocks.openUrl).toHaveBeenCalledTimes(1);
    expect(mocks.openUrl).toHaveBeenCalledWith("https://open.spotify.com/");
  });

  test("shows localized static feedback when the system opener rejects", async () => {
    mocks.openUrl.mockRejectedValue(new Error("private system error"));
    const user = userEvent.setup();
    const { container } = render(
      <SetupGuide guideId="openAiApiKey" copy={SETUP_COPY.ko} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "공식 페이지 열기: https://platform.openai.com/api-keys",
      }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(
        "공식 페이지를 열 수 없어요. 잠시 후 다시 시도해 주세요.",
      );
    });
    expect(container.textContent).not.toContain("private system error");
  });

  test("changing guides cancels stale opener feedback", async () => {
    let rejectOpen: ((reason?: unknown) => void) | undefined;
    mocks.openUrl.mockImplementation(
      () =>
        new Promise<void>((_resolve, reject) => {
          rejectOpen = reject;
        }),
    );
    const user = userEvent.setup();
    const { rerender } = render(
      <SetupGuide guideId="spotifyChrome" copy={SETUP_COPY.en} />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Open official page: https://open.spotify.com/",
      }),
    );
    rerender(<SetupGuide guideId="appleMusicChrome" copy={SETUP_COPY.en} />);

    const appleButton = screen.getByRole("button", {
      name: "Open official page: https://music.apple.com/",
    });
    expect(appleButton.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      rejectOpen?.(new Error("stale private system error"));
      await Promise.resolve();
    });
    expect(screen.queryByRole("status")).toBeNull();
  });
});
