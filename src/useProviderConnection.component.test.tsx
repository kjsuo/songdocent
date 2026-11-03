// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useProviderConnection } from "./useProviderConnection";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ isTauri: () => true, invoke }));

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue({ connectionId: 1, provider: "spotify", phase: "connected", code: null });
});

test("uses the current UI language when opening a provider connection", async () => {
  const { result, rerender } = renderHook(
    ({ language }) => useProviderConnection({ language }),
    { initialProps: { language: "en" as "en" | "ko" } },
  );
  rerender({ language: "ko" });
  await act(async () => { await result.current.requestConnection("spotify"); });
  await act(async () => { await result.current.confirmRiskAndConnect(); });
  await waitFor(() => expect(invoke).toHaveBeenCalledWith("start_provider_connection", {
    provider: "spotify",
    language: "ko",
  }));
});
