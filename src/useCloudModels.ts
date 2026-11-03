import { useCallback, useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import {
  CLOUD_MODEL_CACHE_TTL_MS,
  cloudModelOptions,
  isCloudModelCatalog,
  getCloudAiModelOptions,
  getStoredCloudModelCatalog,
  isCloudAiProvider,
  saveCloudModelCatalog,
  type AiProvider,
  type AiModelOption,
  type CloudAiProvider,
  type CloudModelCatalog,
} from "./settings";

export function useCloudModels(provider: AiProvider, keyReady: boolean) {
  const [state, setState] = useState<{ provider: AiProvider; options: readonly AiModelOption[]; loading: boolean; failed: boolean }>(() => ({
    provider, options: isCloudAiProvider(provider) ? getCloudAiModelOptions(provider) : [], loading: false, failed: false,
  }));
  const requestId = useRef(0);

  const refresh = useCallback(async (currentProvider: CloudAiProvider) => {
    const request = ++requestId.current;
    setState((previous) => ({ ...previous, loading: true, failed: false }));
    try {
      const catalog = await invoke<CloudModelCatalog>("list_cloud_ai_models", { provider: currentProvider });
      if (request !== requestId.current) return;
      if (!isCloudModelCatalog(catalog, currentProvider)) throw new Error("Invalid model catalog");
      saveCloudModelCatalog(catalog);
      setState({ provider: currentProvider, options: cloudModelOptions(catalog), loading: false, failed: false });
    } catch {
      if (request !== requestId.current) return;
      setState((previous) => ({ ...previous, loading: false, failed: true }));
    }
  }, []);

  useEffect(() => {
    requestId.current += 1;
    setState({ provider, options: isCloudAiProvider(provider) ? getCloudAiModelOptions(provider) : [], loading: false, failed: false });
    if (isCloudAiProvider(provider) && keyReady && isTauri()) {
      const cached = getStoredCloudModelCatalog(provider);
      const age = cached ? Date.now() - cached.fetchedAt : Infinity;
      if (age < 0 || age >= CLOUD_MODEL_CACHE_TTL_MS) void refresh(provider);
    }
    return () => { requestId.current += 1; };
  }, [provider, keyReady, refresh]);

  const options = state.provider === provider ? state.options : isCloudAiProvider(provider) ? getCloudAiModelOptions(provider) : [];
  return {
    options,
    loading: state.provider === provider && state.loading,
    failed: state.provider === provider && state.failed,
    refresh: () => { if (isCloudAiProvider(provider) && keyReady && isTauri()) void refresh(provider); },
  };
}
