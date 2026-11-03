import { isTauri } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LangCode } from "./i18n";
import {
  cancelProviderConnection,
  clearProviderExpired,
  connectionNeedsPolling,
  getProviderConnectionStatus,
  startProviderConnection,
  type ProviderConnectionStatus,
  type SessionProvider,
} from "./providerConnection";

type UseProviderConnectionOptions = {
  language?: LangCode;
  onConnected?: (provider: SessionProvider) => void | Promise<void>;
  pollIntervalMs?: number;
};

function redactedFailure(
  provider: SessionProvider,
  code: string,
): ProviderConnectionStatus {
  return {
    connectionId: 0,
    provider,
    phase: "terminal_error",
    code,
  };
}

export function useProviderConnection({
  onConnected,
  language = "en",
  pollIntervalMs = 500,
}: UseProviderConnectionOptions = {}) {
  const [pendingProvider, setPendingProvider] = useState<SessionProvider | null>(null);
  const [riskModalOpen, setRiskModalOpen] = useState(false);
  const [status, setStatus] = useState<ProviderConnectionStatus | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const statusRef = useRef<ProviderConnectionStatus | null>(null);
  const connectedNotificationRef = useRef<number | null>(null);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    if (
      status?.phase !== "connected" ||
      connectedNotificationRef.current === status.connectionId
    ) {
      return;
    }
    connectedNotificationRef.current = status.connectionId;
    clearProviderExpired(status.provider);
    void onConnected?.(status.provider);
  }, [onConnected, status]);

  const beginConnection = useCallback(async (provider: SessionProvider) => {
    const generation = ++generationRef.current;
    connectedNotificationRef.current = null;
    setStatus(null);
    setIsStarting(true);
    try {
      const next = await startProviderConnection(provider, language);
      if (!mountedRef.current || generationRef.current !== generation) {
        // A cancelled start may still create a login window. Close it once its ID arrives.
        if (connectionNeedsPolling(next.phase)) {
          await cancelProviderConnection(next.connectionId).catch(() => {});
        }
        return;
      }
      setStatus(next);
    } catch {
      if (!mountedRef.current || generationRef.current !== generation) return;
      setStatus(redactedFailure(provider, "connection_start_failed"));
    } finally {
      if (mountedRef.current && generationRef.current === generation) {
        setIsStarting(false);
      }
    }
  }, [language]);

  const requestConnection = useCallback(
    async (provider: SessionProvider) => {
      if (!isTauri()) {
        setStatus(redactedFailure(provider, "desktop_only"));
        return;
      }
      setPendingProvider(provider);
      setRiskModalOpen(true);
    },
    [],
  );

  const confirmRiskAndConnect = useCallback(async () => {
    const provider = pendingProvider;
    if (!provider) return;
    setRiskModalOpen(false);
    setPendingProvider(null);
    await beginConnection(provider);
  }, [beginConnection, pendingProvider]);

  const dismissRisk = useCallback(() => {
    setRiskModalOpen(false);
    setPendingProvider(null);
  }, []);

  const cancelConnection = useCallback(async () => {
    const current = statusRef.current;
    ++generationRef.current;
    setIsStarting(false);
    setRiskModalOpen(false);
    setPendingProvider(null);
    if (current && connectionNeedsPolling(current.phase)) {
      setStatus({ ...current, phase: "cancelled", code: null });
      try {
        await cancelProviderConnection(current.connectionId);
      } catch {
        // Cancellation is best effort; stale responses are already invalidated.
      }
    } else {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!status || !connectionNeedsPolling(status.phase) || status.connectionId <= 0) return;

    const generation = generationRef.current;
    const connectionId = status.connectionId;
    let disposed = false;
    let polling = false;

    const poll = async () => {
      if (polling) return;
      polling = true;
      try {
        const next = await getProviderConnectionStatus(connectionId);
        if (
          disposed ||
          !mountedRef.current ||
          generationRef.current !== generation ||
          !next
        ) {
          return;
        }
        setStatus(next);
      } catch {
        if (!disposed && mountedRef.current && generationRef.current === generation) {
          setStatus((current) =>
            current?.connectionId === connectionId
              ? { ...current, phase: "recoverable_error", code: "status_unavailable" }
              : current,
          );
        }
      } finally {
        polling = false;
      }
    };

    void poll();
    const timer = window.setInterval(() => void poll(), pollIntervalMs);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [pollIntervalMs, status?.connectionId, status?.phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      ++generationRef.current;
      const current = statusRef.current;
      if (current && connectionNeedsPolling(current.phase)) {
        void cancelProviderConnection(current.connectionId).catch(() => undefined);
      }
    };
  }, []);

  return {
    status,
    isStarting,
    pendingProvider,
    riskModalOpen,
    requestConnection,
    confirmRiskAndConnect,
    dismissRisk,
    cancelConnection,
  };
}
