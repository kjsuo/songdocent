import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntimePlatform } from "./runtimePlatform.ts";

test("uses Tauri compile-time platform inside the desktop runtime", () => {
  assert.equal(
    resolveRuntimePlatform({
      tauriAvailable: true,
      tauriPlatform: "windows",
      userAgent: "Mozilla/5.0 (Macintosh)",
    }),
    "windows",
  );
});

test("uses the browser user agent without calling Tauri APIs in preview", () => {
  assert.equal(
    resolveRuntimePlatform({
      tauriAvailable: false,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    }),
    "windows",
  );
  assert.equal(
    resolveRuntimePlatform({
      tauriAvailable: false,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    }),
    "macos",
  );
});
