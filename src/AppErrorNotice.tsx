import { RotateCcw, Settings, TriangleAlert, X } from "lucide-react";
import type { LangCode } from "./i18n";
import { getErrorPresentation } from "./appError";
import { useAppError } from "./AppErrorProvider";
import type { DesktopPlatform } from "./platform/platformCopy";
import type { SettingsSection } from "./settings";

const ACTION_LABELS: Record<LangCode, Record<string, string>> = {
  en: { retry: "Try again", settings: "Open settings", close: "Close error" },
  ko: { retry: "다시 시도", settings: "설정 열기", close: "오류 닫기" },
  ja: { retry: "もう一度試す", settings: "設定を開く", close: "エラーを閉じる" },
  es: { retry: "Reintentar", settings: "Abrir ajustes", close: "Cerrar error" },
  fr: { retry: "Réessayer", settings: "Ouvrir les réglages", close: "Fermer l’erreur" },
  de: { retry: "Erneut versuchen", settings: "Einstellungen öffnen", close: "Fehler schließen" },
  "pt-BR": { retry: "Tentar novamente", settings: "Abrir ajustes", close: "Fechar erro" },
  "zh-CN": { retry: "重试", settings: "打开设置", close: "关闭错误" },
};

export function AppErrorNotice({
  lang,
  onOpenSettings,
  platform = "macos",
}: {
  lang: LangCode;
  onOpenSettings: (section: SettingsSection) => void;
  platform?: DesktopPlatform;
}) {
  const { currentError, dismissError } = useAppError();
  if (!currentError) return null;

  const { error, retry } = currentError;
  const presentation = getErrorPresentation(error, lang, platform);
  const labels = ACTION_LABELS[lang];
  const canRetry = presentation.action === "retry" && retry;
  const settingsSection =
    presentation.action === "open-ai-settings"
      ? "ai"
      : presentation.action === "open-lyrics-settings"
        ? "lyrics"
        : null;

  return (
    <section className="app-error-notice" role="alert" aria-live="assertive">
      <TriangleAlert className="app-error-icon" size={20} aria-hidden="true" />
      <div className="app-error-copy">
        <strong>{presentation.title}</strong>
        <p>{presentation.message}</p>
      </div>
      <div className="app-error-actions">
        {canRetry ? (
          <button type="button" onClick={() => void retry()}>
            <RotateCcw size={13} aria-hidden="true" />
            <span>{labels.retry}</span>
          </button>
        ) : null}
        {settingsSection ? (
          <button type="button" onClick={() => onOpenSettings(settingsSection)}>
            <Settings size={13} aria-hidden="true" />
            <span>{labels.settings}</span>
          </button>
        ) : null}
        <button
          type="button"
          className="app-error-close"
          onClick={dismissError}
          aria-label={labels.close}
          title={labels.close}
        >
          <X size={15} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
