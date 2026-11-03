import { platform } from "@tauri-apps/plugin-os";
import {
  normalizeDesktopPlatform,
  type DesktopPlatform,
} from "./platformCopy.ts";

type RuntimePlatformInput = {
  tauriAvailable: boolean;
  tauriPlatform?: string;
  userAgent?: string;
};

export function resolveRuntimePlatform({
  tauriAvailable,
  tauriPlatform,
  userAgent = "",
}: RuntimePlatformInput): DesktopPlatform {
  if (tauriAvailable && tauriPlatform) {
    return normalizeDesktopPlatform(tauriPlatform);
  }
  return userAgent.toLowerCase().includes("windows") ? "windows" : "macos";
}

const tauriAvailable =
  typeof window !== "undefined" &&
  Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

export const DESKTOP_PLATFORM = resolveRuntimePlatform({
  tauriAvailable,
  tauriPlatform: tauriAvailable ? platform() : undefined,
  userAgent: typeof navigator === "undefined" ? "" : navigator.userAgent,
});
