import { useAppUpdates } from "./appUpdates";
import { UPDATE_COPY } from "./updateCopy";
import type { LangCode } from "./i18n";

export function UpdateSettings({ lang, compact = false }: { lang: LangCode; compact?: boolean }) {
  const updates = useAppUpdates();
  const copy = UPDATE_COPY[lang];
  const installing = updates.phase === "downloading" || updates.phase === "installing";
  const installed = updates.phase === "installed" || updates.errorStage === "restart";
  const available = Boolean(updates.nextVersion) && updates.errorStage !== "check";
  if (compact && !available && !installed && !installing) return null;
  const message = updates.phase === "unavailable" ? copy.unavailable
    : updates.phase === "checking" ? copy.checking
    : updates.phase === "current" ? copy.current
    : updates.phase === "downloading" ? copy.downloading
    : updates.phase === "installing" ? copy.installing
    : updates.phase === "error" ? (updates.errorStage === "restart" ? copy.restartFailed : updates.errorStage === "install" ? copy.installFailed : copy.checkFailed)
    : installed ? copy.installed
    : available ? copy.available.replace("{version}", updates.nextVersion ?? "")
    : copy.idle;
  return <section className={compact ? "app-update-notice" : "settings-updates"} aria-label={copy.title}>
    {!compact && <h2>SongDocent {updates.version}</h2>}
    <p role="status" aria-live="polite">{message}</p>
    {installing && <progress max={100} value={updates.progress ?? undefined} aria-label={copy.progress} />}
    {!compact && available && updates.notes && <pre className="update-release-notes">{updates.notes}</pre>}
    {(available || installed) && !updates.canInstall && <p className="settings-helper">{copy.wait}</p>}
    <div className="update-actions">
      {installed ? <button type="button" disabled={updates.busy || !updates.canInstall} onClick={() => void updates.restart()}>{copy.restart}</button>
        : available ? <button type="button" disabled={updates.busy || !updates.canInstall} onClick={() => void updates.install()}>{updates.errorStage === "install" ? copy.retryInstall : copy.install}</button>
        : <button type="button" disabled={updates.busy || updates.phase === "unavailable"} onClick={() => void updates.checkNow()}>{copy.check}</button>}
      {!compact && available && !installed && <button type="button" disabled={updates.busy} onClick={() => void updates.checkNow()}>{copy.checkAgain}</button>}
    </div>
  </section>;
}
