// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppUpdatesProvider, useAppUpdates } from "./appUpdates";
const mocks = vi.hoisted(() => ({ invoke: vi.fn(), check: vi.fn(), relaunch: vi.fn() }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke, isTauri: () => true }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check: mocks.check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: mocks.relaunch }));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((done) => { resolve = done; }); return { promise, resolve }; }
function update() { return { version: "0.2.0", body: "Release notes", download: vi.fn().mockResolvedValue(undefined), install: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined) }; }
async function setup() {
  const hook = renderHook(() => useAppUpdates(), { wrapper: AppUpdatesProvider });
  await waitFor(() => expect(hook.result.current.phase).toBe("idle"));
  return hook;
}
beforeEach(() => { vi.resetAllMocks(); mocks.invoke.mockResolvedValue({ configured: true, version: "0.1.0" }); mocks.relaunch.mockResolvedValue(undefined); });
afterEach(() => cleanup());
test("checks never install automatically, and installation waits for explicit restart", async () => {
  const next = update(); mocks.check.mockResolvedValue(next); const { result } = await setup();
  await act(async () => { await result.current.checkNow(); });
  expect(result.current.nextVersion).toBe("0.2.0"); expect(next.download).not.toHaveBeenCalled();
  await act(async () => { await result.current.install(); });
  expect(result.current.phase).toBe("installed"); expect(mocks.relaunch).not.toHaveBeenCalled();
  await act(async () => { await result.current.restart(); }); expect(mocks.relaunch).toHaveBeenCalledOnce();
});
test("rechecks active work after downloading and resumes without downloading twice", async () => {
  const pending = deferred<void>(); const next = update(); next.download.mockReturnValue(pending.promise); mocks.check.mockResolvedValue(next);
  const { result } = await setup(); await act(async () => { await result.current.checkNow(); });
  let install!: Promise<void>; act(() => { install = result.current.install(); });
  act(() => result.current.setCanInstall(false));
  await act(async () => { pending.resolve(); await install; });
  expect(result.current.phase).toBe("ready"); expect(next.install).not.toHaveBeenCalled();
  act(() => result.current.setCanInstall(true)); await act(async () => { await result.current.install(); });
  expect(next.download).toHaveBeenCalledOnce(); expect(next.install).toHaveBeenCalledOnce();
});
test("failed installation and restart can both be retried", async () => {
  const next = update(); next.install.mockRejectedValueOnce(new Error("failed")); mocks.check.mockResolvedValue(next);
  const { result } = await setup(); await act(async () => { await result.current.checkNow(); await result.current.install(); });
  expect(result.current.errorStage).toBe("install");
  await act(async () => { await result.current.install(); }); expect(next.download).toHaveBeenCalledOnce();
  mocks.relaunch.mockRejectedValueOnce(new Error("failed")); await act(async () => { await result.current.restart(); });
  expect(result.current.errorStage).toBe("restart"); await act(async () => { await result.current.restart(); }); expect(mocks.relaunch).toHaveBeenCalledTimes(2);
});
test("late update results are released after unmount", async () => {
  const pending = deferred<ReturnType<typeof update>>(); mocks.check.mockReturnValue(pending.promise); const next = update();
  const { result, unmount } = await setup(); let check!: Promise<void>; act(() => { check = result.current.checkNow(); }); unmount();
  await act(async () => { pending.resolve(next); await check; }); expect(next.close).toHaveBeenCalledOnce();
});
test("serializes checks and refuses installation during active work", async () => {
  const pending = deferred<ReturnType<typeof update>>(); mocks.check.mockReturnValue(pending.promise); const next = update(); const { result } = await setup();
  let check!: Promise<void>; act(() => { check = result.current.checkNow(); }); await act(async () => { await result.current.checkNow(); }); expect(mocks.check).toHaveBeenCalledOnce();
  await act(async () => { pending.resolve(next); await check; }); act(() => result.current.setCanInstall(false));
  await act(async () => { await result.current.install(); }); expect(next.download).not.toHaveBeenCalled();
});
test("unconfigured development builds do not request updates", async () => {
  mocks.invoke.mockResolvedValue({ configured: false, version: "0.1.0" }); const { result } = renderHook(() => useAppUpdates(), { wrapper: AppUpdatesProvider });
  await act(async () => {}); await act(async () => { await result.current.checkNow(); }); expect(mocks.check).not.toHaveBeenCalled(); expect(result.current.phase).toBe("unavailable");
});
