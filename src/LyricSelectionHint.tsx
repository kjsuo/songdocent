import { useState } from "react";
import { dictionary, type LangCode } from "./i18n";

const DISMISSED_KEY = "songdocent_lyric_selection_hint_dismissed_v1";

export function LyricSelectionHint({ lang }: { lang: LangCode }) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISSED_KEY) === "true";
    } catch {
      return false;
    }
  });
  const copy = dictionary[lang];

  if (dismissed) return null;

  return (
    <aside className="absolute inset-x-6 top-20 z-30 flex flex-col items-start gap-2 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm backdrop-blur-md md:left-0 md:right-12">
      <p className="text-white/85">{copy.lyricSelectionHint}</p>
      <button
        type="button"
        className="rounded text-xs text-white/60 underline underline-offset-4 transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        onClick={() => {
          setDismissed(true);
          try {
            localStorage.setItem(DISMISSED_KEY, "true");
          } catch {
            // Still dismiss for this session if storage is unavailable.
          }
        }}
      >
        {copy.doNotShowAgain}
      </button>
    </aside>
  );
}
