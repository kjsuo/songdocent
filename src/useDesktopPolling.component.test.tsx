// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { useDesktopPolling, type LyricsPayload } from "./useDesktopPolling";
import { saveTranslationConfig } from "./settings";

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(), reportError: vi.fn(), clearError: vi.fn(),
  listeners: new Map<string, (event: { payload: any }) => void>(),
}));
vi.mock("@tauri-apps/api/core", () => ({ invoke: mocks.invoke }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name, listener) => {
    mocks.listeners.set(name, listener);
    return () => mocks.listeners.delete(name);
  }),
}));
vi.mock("./AppErrorProvider", () => ({ useAppError: () => ({ reportError: mocks.reportError, clearError: mocks.clearError }) }));

const original: LyricsPayload = { has_translation: false, lines: [
  { index: 0, start_ms: 0, end_ms: 1000, timestamp: "0:00", text: "Source" },
  { index: 1, start_ms: 1000, end_ms: 2000, timestamp: "0:01", text: "Second" },
] };
const translated: LyricsPayload = { ...original, has_translation: true,
  lines: original.lines!.map((line) => ({ ...line, ko: "Translation", annotation: "Automatic note" })) };
const annotated: LyricsPayload = { ...original, lines: [
  { ...original.lines![0], annotation: "Manual note" },
  original.lines![1],
] };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.stubGlobal("localStorage", window.localStorage);
  localStorage.clear(); mocks.invoke.mockReset(); mocks.reportError.mockReset(); mocks.listeners.clear();
  Object.assign(window, { __TAURI_INTERNALS__: {} });
  mocks.invoke.mockImplementation(async (command, args) => {
    if (command === "get_current_track") return { id: "track", source: "spotify", title: "Title", artist: "Artist", isPlaying: false };
    if (command === "get_spotify_lyrics") return original;
    if (command === "apply_translation_cache") return args.payload;
    return null;
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("CLI options and request IDs reach both operations; settings cancel them and discard late results", async () => {
  saveTranslationConfig({ provider: "opencode_cli", model: "vendor/model", cliOptions: { executablePath: "/도구 폴더/opencode", reasoning: "high" } });
  const translation = deferred<LyricsPayload>();
  const annotation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "translate_lyrics" ? translation.promise
    : command === "annotate_lyrics_selection" ? annotation.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let translating!: Promise<void>;
  let annotating!: Promise<boolean>;
  act(() => { translating = result.current.translateLyrics(); annotating = result.current.annotateLyricsSelection("0", "Source"); });
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("translate_lyrics", expect.anything()));
  const calls = mocks.invoke.mock.calls.filter(([command]) => ["translate_lyrics", "annotate_lyrics_selection"].includes(command));
  for (const [, args] of calls) expect(args).toMatchObject({ provider: "opencode_cli", model: "vendor/model", requestId: expect.any(String), cliOptions: { executablePath: "/도구 폴더/opencode", reasoning: "high" } });
  act(() => mocks.listeners.get("songdocent-ai-stage")!({ payload: { requestId: calls[0][1].requestId, stage: "searching" } }));
  expect(result.current.aiStage).toBe("searching");
  act(() => saveTranslationConfig({ provider: "codex_cli", model: "__cli_default__" }));
  for (const [, args] of calls) expect(mocks.invoke).toHaveBeenCalledWith("cancel_cli_ai_request", { requestId: args.requestId });
  await act(async () => { translation.resolve(translated); annotation.resolve(annotated); await translating; expect(await annotating).toBe(false); });
  expect(result.current.lyrics?.lines?.[0].ko).toBeUndefined();
  expect(result.current.lyrics?.lines?.[0].annotation).toBeUndefined();
  expect(mocks.invoke.mock.calls.filter(([command]) => command === "save_translation_cache")).toHaveLength(0);
});

test("unmounting cancels a CLI annotation request", async () => {
  saveTranslationConfig({ provider: "codex_cli", model: "__cli_default__" });
  const annotation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "annotate_lyrics_selection" ? annotation.promise : baseline(command, args));
  const { result, unmount } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.annotateLyricsSelection("0", "Source"); });
  const args = mocks.invoke.mock.calls.find(([command]) => command === "annotate_lyrics_selection")![1];
  unmount();
  expect(mocks.invoke).toHaveBeenCalledWith("cancel_cli_ai_request", { requestId: args.requestId });
  await act(async () => { annotation.resolve(annotated); expect(await pending).toBe(false); });
});

test("a late annotation preserves completed translation and other lines in state and cache", async () => {
  const annotation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "annotate_lyrics_selection" ? annotation.promise
    : command === "translate_lyrics" ? Promise.resolve(translated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.annotateLyricsSelection("0", "Source"); });
  await act(async () => { await result.current.translateLyrics(); });
  await act(async () => { annotation.resolve(annotated); expect(await pending).toBe(true); });
  expect(result.current.lyrics?.has_translation).toBe(true);
  expect(result.current.lyrics?.lines?.[0]).toMatchObject({ ko: "Translation", annotation: "Manual note" });
  expect(result.current.lyrics?.lines?.[1]).toMatchObject({ ko: "Translation", annotation: "Automatic note" });
  expect(mocks.invoke).toHaveBeenLastCalledWith("save_translation_cache", expect.objectContaining({ payload: result.current.lyrics }));
});

test("streaming and completed translation preserve a manual annotation added during translation", async () => {
  const translation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "translate_lyrics" ? translation.promise
    : command === "annotate_lyrics_selection" ? Promise.resolve(annotated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let pending!: Promise<void>;
  act(() => { pending = result.current.translateLyrics(); });
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("translate_lyrics", expect.anything()));
  await act(async () => { await result.current.annotateLyricsSelection("0", "Source"); });
  const args = mocks.invoke.mock.calls.find(([name]) => name === "translate_lyrics")![1];
  act(() => mocks.listeners.get("songdocent-translation-line")!({ payload: { request_id: args.requestId, target_lang: "ko", line: translated.lines![0] } }));
  expect(result.current.lyrics?.lines?.[0]).toMatchObject({ ko: "Translation", annotation: "Manual note" });
  await act(async () => { translation.resolve(translated); await pending; });
  expect(result.current.lyrics?.lines?.[0]).toMatchObject({ ko: "Translation", annotation: "Manual note" });
});

test("deletion invalidates pending annotation and does not restore its translation cache", async () => {
  const annotation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "apply_translation_cache" ? Promise.resolve(translated)
    : command === "annotate_lyrics_selection" ? annotation.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.has_translation).toBe(true));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.annotateLyricsSelection("0", "Source"); });
  await act(async () => { await result.current.deleteTranslation(); });
  await act(async () => { annotation.resolve(translated); expect(await pending).toBe(false); });
  expect(result.current.lyrics?.has_translation).toBe(false);
  expect(result.current.lyrics?.lines?.[0].ko).toBeUndefined();
  expect(result.current.annotationPendingLineId).toBeNull();
  expect(mocks.invoke.mock.calls.filter(([name]) => name === "save_translation_cache")).toHaveLength(0);
});

test("translating after a manual annotation preserves it even with automatic annotations off", async () => {
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "annotate_lyrics_selection" ? Promise.resolve(annotated)
    : command === "translate_lyrics" ? Promise.resolve(translated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "off", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  await act(async () => { await result.current.annotateLyricsSelection("0", "Source"); });
  await act(async () => { await result.current.translateLyrics(); });
  expect(result.current.lyrics?.lines?.[0]).toMatchObject({ ko: "Translation", annotation: "Manual note" });
});

test("a track change discards an earlier pending annotation", async () => {
  const annotation = deferred<LyricsPayload>();
  let trackId = "track";
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "get_current_track"
    ? Promise.resolve({ id: trackId, source: "spotify", title: "Title", artist: "Artist", isPlaying: false })
    : command === "annotate_lyrics_selection" ? annotation.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let pending!: Promise<boolean>;
  act(() => { pending = result.current.annotateLyricsSelection("0", "Source"); });
  trackId = "next-track";
  act(() => mocks.listeners.get("songdocent-player-changed")!({ payload: { source: "spotify" } }));
  await waitFor(() => expect(result.current.track?.id).toBe("next-track"));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  await act(async () => { annotation.resolve(annotated); expect(await pending).toBe(false); });
  expect(result.current.lyrics?.lines?.[0].annotation).toBeUndefined();
});

test("deletion invalidates pending translation and ignores subsequent stream events", async () => {
  const translation = deferred<LyricsPayload>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "translate_lyrics" ? translation.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let pending!: Promise<void>;
  act(() => { pending = result.current.translateLyrics(); });
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("translate_lyrics", expect.anything()));
  const args = mocks.invoke.mock.calls.find(([name]) => name === "translate_lyrics")![1];
  await act(async () => { await result.current.deleteTranslation(); });
  act(() => mocks.listeners.get("songdocent-translation-line")!({ payload: { request_id: args.requestId, line: translated.lines![0] } }));
  await act(async () => { translation.resolve(translated); await pending; });
  expect(result.current.lyrics?.lines?.[0].ko).toBeUndefined();
  expect(result.current.translationPending).toBe(false);
});

test("cache deletion waits for an already running save and wins last", async () => {
  const save = deferred<void>();
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "translate_lyrics" ? Promise.resolve(translated)
    : command === "save_translation_cache" ? save.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  let translating!: Promise<void>;
  act(() => { translating = result.current.translateLyrics(); });
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("save_translation_cache", expect.anything()));
  let deleting!: Promise<void>;
  act(() => { deleting = result.current.deleteTranslation(); });
  expect(mocks.invoke.mock.calls.filter(([name]) => name === "clear_translation_cache")).toHaveLength(0);
  await act(async () => { save.resolve(); await Promise.all([translating, deleting]); });
  expect(mocks.invoke).toHaveBeenLastCalledWith("clear_translation_cache", { trackId: "track", targetLang: "ko" });
  expect(result.current.lyrics?.has_translation).toBe(false);
});

test.each(["ollama", "lmstudio"])("selection annotation uses the selected %s model and endpoint", async (provider) => {
  localStorage.setItem("songdocent_ai_provider", provider);
  localStorage.setItem(`songdocent_ai_model_${provider}`, "local-model");
  localStorage.setItem(`songdocent_ai_base_url_${provider}`, "http://localhost:9999");
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "annotate_lyrics_selection" ? Promise.resolve(annotated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  await act(async () => { await result.current.annotateLyricsSelection("0", "Source"); });
  expect(mocks.invoke).toHaveBeenCalledWith("annotate_lyrics_selection", expect.objectContaining({ provider, model: "local-model", baseUrl: "http://localhost:9999", searchMode: "off" }));
});

test.each([null, { lines: [] }])("an empty lyrics result is distinguished from loading (%j)", async (payload) => {
  const baseline = mocks.invoke.getMockImplementation()!;
  const response = deferred<LyricsPayload | null>();
  mocks.invoke.mockImplementation((command, args) => command === "get_spotify_lyrics" ? response.promise : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith("get_spotify_lyrics", expect.anything()));
  expect(result.current.lyricsNotFound).toBe(false);
  await act(async () => response.resolve(payload));
  await waitFor(() => expect(result.current.lyricsNotFound).toBe(true));
  expect(mocks.reportError).not.toHaveBeenCalled();
});

test("a provider's not-found error shows the empty state instead of a generic alert", async () => {
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "get_spotify_lyrics"
    ? Promise.reject({ code: "LYRICS_NOT_FOUND", domain: "lyrics", retryable: false, technicalMessage: "catalog song not found" })
    : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyricsNotFound).toBe(true));
  expect(mocks.reportError).not.toHaveBeenCalled();
});

test("cache read failure reports an error while preserving source lyrics", async () => {
  const error = { code: "CACHE_READ_FAILED", domain: "storage", retryable: true, technicalMessage: "read denied" };
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "apply_translation_cache" ? Promise.reject(error) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  expect(mocks.reportError).toHaveBeenCalledWith(error);
});

test("cache write failure reports lost persistence without losing the translated result", async () => {
  const error = { code: "CACHE_WRITE_FAILED", domain: "storage", retryable: true, technicalMessage: "disk full" };
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "save_translation_cache" ? Promise.reject(error)
    : command === "translate_lyrics" ? Promise.resolve(translated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  await act(async () => { await result.current.translateLyrics(); });
  expect(result.current.lyrics?.has_translation).toBe(true);
  expect(mocks.reportError).toHaveBeenCalledWith(error);
});

test("failed cache deletion provides a retry that clears the saved copy", async () => {
  const baseline = mocks.invoke.getMockImplementation()!;
  const clear = vi.fn().mockRejectedValueOnce(new Error("disk denied")).mockResolvedValue(undefined);
  mocks.invoke.mockImplementation((command, args) => command === "clear_translation_cache" ? clear()
    : command === "apply_translation_cache" ? Promise.resolve(translated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.has_translation).toBe(true));
  await act(async () => { await result.current.deleteTranslation(); });
  expect(result.current.lyrics?.has_translation).toBe(false);
  expect(mocks.reportError).toHaveBeenCalledWith(expect.objectContaining({ code: "CACHE_CLEAR_FAILED" }), { retry: expect.any(Function) });
  const retry = mocks.reportError.mock.calls.at(-1)![1].retry;
  await act(async () => { await retry(); });
  expect(clear).toHaveBeenCalledTimes(2);
  expect(mocks.clearError).toHaveBeenCalledWith("storage");
});


test.each([
  { provider: "gemini", model: "gemini-3.1-flash-lite", apiReasoning: "minimal" },
  { provider: "openai", model: "gpt-6-luna", apiReasoning: "low" },
  { provider: "claude", model: "claude-haiku-5-5", apiReasoning: "high" },
] satisfies Parameters<typeof saveTranslationConfig>[0][])("$provider API reasoning reaches translation and selected annotations", async (config) => {
  saveTranslationConfig(config);
  const baseline = mocks.invoke.getMockImplementation()!;
  mocks.invoke.mockImplementation((command, args) => command === "translate_lyrics" ? Promise.resolve(translated)
    : command === "annotate_lyrics_selection" ? Promise.resolve(annotated) : baseline(command, args));
  const { result } = renderHook(() => useDesktopPolling("ko", "medium", true));
  await waitFor(() => expect(result.current.lyrics?.lines).toHaveLength(2));
  await act(async () => { await result.current.translateLyrics(); });
  await act(async () => { await result.current.annotateLyricsSelection("0", "Source"); });
  for (const command of ["translate_lyrics", "annotate_lyrics_selection"]) {
    expect(mocks.invoke).toHaveBeenCalledWith(command, expect.objectContaining(config));
  }
});
