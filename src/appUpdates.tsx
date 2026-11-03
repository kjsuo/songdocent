import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { version as developmentVersion } from "../package.json";

export type UpdatePhase = "unavailable" | "idle" | "checking" | "current" | "available" | "downloading" | "ready" | "installing" | "installed" | "error";
type Configuration = { configured: boolean; version: string };
type UpdateState = {
  phase: UpdatePhase; version: string; nextVersion?: string; notes?: string;
  progress: number | null; errorStage?: "check" | "install" | "restart";
};
type UpdateContextValue = UpdateState & {
  busy: boolean; canInstall: boolean; checkNow: () => Promise<void>;
  install: () => Promise<void>; restart: () => Promise<void>; setCanInstall: (allowed: boolean) => void;
};
const initial: UpdateState = { phase: "unavailable", version: developmentVersion, progress: null };
const noop = async () => {};
const fallback: UpdateContextValue = { ...initial, busy: false, canInstall: true, checkNow: noop, install: noop, restart: noop, setCanInstall: () => {} };
const UpdatesContext = createContext<UpdateContextValue | null>(null);

export function AppUpdatesProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UpdateState>(initial);
  const [canInstall, setCanInstallState] = useState(true);
  const canInstallRef = useRef(true);
  const updateRef = useRef<Update | null>(null);
  const downloadedRef = useRef(false);
  const installedRef = useRef(false);
  const configuredRef = useRef(false);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const setCanInstall = useCallback((allowed: boolean) => {
    canInstallRef.current = allowed;
    setCanInstallState(allowed);
  }, []);

  const checkNow = useCallback(async () => {
    if (!configuredRef.current || runningRef.current || installedRef.current) return;
    runningRef.current = true;
    const generation = generationRef.current;
    setState((current) => ({ ...current, phase: "checking", errorStage: undefined }));
    try {
      const next = await check({ timeout: 30_000 });
      if (generation !== generationRef.current) { await next?.close(); return; }
      await updateRef.current?.close();
      updateRef.current = next;
      downloadedRef.current = false;
      setState((current) => ({ ...current, phase: next ? "available" : "current", nextVersion: next?.version, notes: next?.body, progress: null }));
    } catch {
      if (generation === generationRef.current) setState((current) => ({ ...current, phase: "error", errorStage: "check" }));
    } finally {
      runningRef.current = false;
    }
  }, []);

  const restart = useCallback(async () => {
    if (!installedRef.current || runningRef.current || !canInstallRef.current) return;
    runningRef.current = true;
    try { await relaunch(); }
    catch { setState((current) => ({ ...current, phase: "error", errorStage: "restart" })); }
    finally { runningRef.current = false; }
  }, []);

  const install = useCallback(async () => {
    const update = updateRef.current;
    if (!update || runningRef.current || installedRef.current || !canInstallRef.current) return;
    runningRef.current = true;
    try {
      if (!downloadedRef.current) {
        setState((current) => ({ ...current, phase: "downloading", progress: null, errorStage: undefined }));
        let downloaded = 0;
        let total: number | undefined;
        await update.download((event) => {
          if (event.event === "Started") { total = event.data.contentLength; downloaded = 0; }
          if (event.event === "Progress") downloaded += event.data.chunkLength;
          setState((current) => ({ ...current, progress: total ? Math.min(100, Math.round(downloaded / total * 100)) : null }));
        }, { timeout: 120_000 });
        downloadedRef.current = true;
      }
      // A translation may have started while the download was in flight.
      if (!canInstallRef.current) { setState((current) => ({ ...current, phase: "ready", progress: 100 })); return; }
      setState((current) => ({ ...current, phase: "installing", progress: 100 }));
      // Windows exits here and its installer restarts the app. macOS stays open.
      await update.install();
      installedRef.current = true;
      setState((current) => ({ ...current, phase: "installed" }));
      await update.close();
      updateRef.current = null;
    } catch {
      setState((current) => ({ ...current, phase: "error", errorStage: installedRef.current ? "restart" : "install" }));
    } finally { runningRef.current = false; }
  }, []);

  useEffect(() => {
    const generation = ++generationRef.current;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isTauri()) void invoke<Configuration>("get_update_configuration").then((config) => {
      if (generation !== generationRef.current) return;
      configuredRef.current = Boolean(config?.configured);
      setState((current) => ({ ...current, version: config?.version ?? developmentVersion, phase: config?.configured ? "idle" : "unavailable" }));
      if (config?.configured) timer = setTimeout(() => void checkNow(), 3000);
    }).catch(() => {});
    return () => {
      ++generationRef.current;
      configuredRef.current = false;
      clearTimeout(timer);
      const update = updateRef.current;
      updateRef.current = null;
      void update?.close().catch(() => {});
    };
  }, [checkNow]);

  const value = useMemo(() => ({ ...state, canInstall, busy: ["checking", "downloading", "installing"].includes(state.phase), checkNow, install, restart, setCanInstall }), [state, canInstall, checkNow, install, restart, setCanInstall]);
  return <UpdatesContext.Provider value={value}>{children}</UpdatesContext.Provider>;
}

// Settings can also render independently in frontend previews and component tests.
export function useAppUpdates() { return useContext(UpdatesContext) ?? fallback; }
