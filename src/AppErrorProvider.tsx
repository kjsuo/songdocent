import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  clearCurrentError,
  mergeCurrentError,
  normalizeAppError,
  type AppErrorDomain,
  type AppErrorRetryAction,
  type CurrentAppError,
} from "./appError";

type ReportOptions = {
  retry?: AppErrorRetryAction;
};

type AppErrorContextValue = {
  currentError: CurrentAppError | null;
  reportError: (error: unknown, options?: ReportOptions) => void;
  clearError: (domain?: AppErrorDomain) => void;
  dismissError: () => void;
};

const AppErrorContext = createContext<AppErrorContextValue | null>(null);

export function AppErrorProvider({ children }: { children: ReactNode }) {
  const [currentError, setCurrentError] = useState<CurrentAppError | null>(null);
  const loggedErrorKeyRef = useRef<string | null>(null);

  const reportError = useCallback((value: unknown, options?: ReportOptions) => {
    const nextError = normalizeAppError(value);
    const errorKey = `${nextError.domain}:${nextError.code}`;
    if (loggedErrorKeyRef.current !== errorKey) {
      loggedErrorKeyRef.current = errorKey;
      console.error(`[SongDocent:${nextError.code}]`, nextError.technicalMessage);
    }
    setCurrentError((current) => mergeCurrentError(current, nextError, options?.retry));
  }, []);

  const clearError = useCallback((domain?: AppErrorDomain) => {
    setCurrentError((current) => {
      if (!current) return null;
      if (clearCurrentError(current.error, domain)) return current;
      loggedErrorKeyRef.current = null;
      return null;
    });
  }, []);

  const dismissError = useCallback(() => {
    loggedErrorKeyRef.current = null;
    setCurrentError(null);
  }, []);

  const value = useMemo(
    () => ({ currentError, reportError, clearError, dismissError }),
    [clearError, currentError, dismissError, reportError],
  );

  return <AppErrorContext.Provider value={value}>{children}</AppErrorContext.Provider>;
}

export function useAppError() {
  const context = useContext(AppErrorContext);
  if (!context) throw new Error("useAppError must be used inside AppErrorProvider");
  return context;
}
