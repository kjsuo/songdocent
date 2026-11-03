// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useCloudModels } from "./useCloudModels";
import { CLOUD_MODEL_CACHE_TTL_MS, saveCloudModelCatalog, supportsGroundingSearch, type AiProvider, type CloudModelCatalog } from "./settings";
const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: () => true }));
const catalog = (provider: "gemini" | "claude", fetchedAt = Date.now()): CloudModelCatalog => ({
  provider, fetchedAt, models: [{ id: `${provider}-new-model`, label: "New model", description: "", searchSupported: null }],
});
beforeEach(() => { localStorage.clear(); mocks.invoke.mockReset(); });
afterEach(cleanup);
test("fresh cache skips automatic fetch; manual refresh discovers models and capabilities", async () => {
  saveCloudModelCatalog(catalog("gemini"));
  const updated = catalog("gemini"); updated.models[0].searchSupported = true;
  mocks.invoke.mockResolvedValue(updated);
  const { result } = renderHook(() => useCloudModels("gemini", true));
  expect(result.current.options[0].id).toBe("gemini-new-model");
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(supportsGroundingSearch("gemini", "gemini-new-model")).toBe(false);
  act(() => result.current.refresh());
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(mocks.invoke).toHaveBeenCalledWith("list_cloud_ai_models", { provider: "gemini" });
  expect(supportsGroundingSearch("gemini", "gemini-new-model")).toBe(true);
});
test("failed stale refresh preserves saved models", async () => {
  saveCloudModelCatalog(catalog("gemini", Date.now() - CLOUD_MODEL_CACHE_TTL_MS));
  mocks.invoke.mockRejectedValue(new Error("offline"));
  const { result } = renderHook(() => useCloudModels("gemini", true));
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.options[0].id).toBe("gemini-new-model");
});
test("provider switch ignores earlier provider response", async () => {
  let resolve!: (value: CloudModelCatalog) => void;
  mocks.invoke.mockImplementation(() => new Promise<CloudModelCatalog>((done) => { resolve = done; }));
  saveCloudModelCatalog(catalog("claude"));
  const { result, rerender } = renderHook(({ provider }: { provider: AiProvider }) => useCloudModels(provider, true), { initialProps: { provider: "gemini" as AiProvider } });
  rerender({ provider: "claude" });
  await act(async () => resolve(catalog("gemini")));
  expect(result.current.options[0].id).toBe("claude-new-model");
  expect(localStorage.getItem("songdocent_cloud_models_v1_gemini")).toBeNull();
});
test("missing key does not request models", () => {
  const { result } = renderHook(() => useCloudModels("gemini", false));
  act(() => result.current.refresh());
  expect(mocks.invoke).not.toHaveBeenCalled();
  expect(result.current.options.length).toBeGreaterThan(0);
});
test("malformed response retains fallback list", async () => {
  mocks.invoke.mockResolvedValue({ ...catalog("gemini"), models: [{ id: "broken" }] });
  const { result } = renderHook(() => useCloudModels("gemini", true));
  await waitFor(() => expect(result.current.failed).toBe(true));
  expect(result.current.options.some(({ id }) => id === "broken")).toBe(false);
});
