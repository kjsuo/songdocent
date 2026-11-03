import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { motion } from "framer-motion";
import { useState, type MouseEvent } from "react";
import { dictionary, type LangCode } from "./i18n";
import { OFFICIAL_SETUP_DESTINATIONS } from "./setup/guideLinks";
import { type LyricsSource } from "./settings";
import { DESKTOP_PLATFORM } from "./platform/runtimePlatform";

export function WaitingForMusic({ lang, source }: { lang: LangCode; source: LyricsSource }) {
  const copy = dictionary[lang];
  const spotify = source === "spotify";
  const serviceUrl = spotify ? OFFICIAL_SETUP_DESTINATIONS.spotifyWeb : OFFICIAL_SETUP_DESTINATIONS.appleMusicWeb;
  const [openFailed, setOpenFailed] = useState(false);

  const openService = async (event: MouseEvent<HTMLAnchorElement>, url: string) => {
    if (!isTauri()) return;
    event.preventDefault();
    setOpenFailed(false);
    try {
      await openUrl(spotify ? "spotify:" : DESKTOP_PLATFORM === "macos" ? "music://" : url);
    } catch {
      setOpenFailed(true);
    }
  };

  return (
    <motion.main
      className="music-waiting"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      aria-labelledby="music-waiting-title"
    >
      <div className="music-waiting-content">
        <div className="music-waiting-art" aria-hidden="true">
          <div className="music-waiting-halo" />
          <svg className="music-waiting-songdocent" viewBox="0 0 240 200" fill="none">
            <defs>
              <linearGradient id="waiting-songdocent-edge" x1="42" y1="30" x2="210" y2="175" gradientUnits="userSpaceOnUse">
                <stop stopColor="#c8c2ff" />
                <stop offset="0.5" stopColor="#c6f5ee" />
                <stop offset="1" stopColor="#e9c3e5" />
              </linearGradient>
              <linearGradient id="waiting-songdocent-face" x1="120" y1="30" x2="120" y2="175" gradientUnits="userSpaceOnUse">
                <stop stopColor="#e2dbff" stopOpacity="0.13" />
                <stop offset="1" stopColor="#d5f7ee" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d="M120 27 39 164 183 175Z" fill="url(#waiting-songdocent-face)" />
            <path d="m120 27 81 137-18 11Z" fill="#cbbaff" fillOpacity="0.035" />
            <path d="m120 27-81 137 144 11 18-11-81-137Z M120 27l63 148 M39 164h162" stroke="url(#waiting-songdocent-edge)" strokeOpacity="0.7" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 id="music-waiting-title">{copy.waitingForMusicTitle}</h1>
        <p className="music-waiting-description">{copy.waitingForMusicBody}</p>
        <div className="music-waiting-actions">
          <a href={serviceUrl} target="_blank" rel="noreferrer" onClick={(event) => void openService(event, serviceUrl)}>{spotify ? copy.openSpotify : copy.openAppleMusic}</a>
        </div>
        {openFailed ? <p className="music-waiting-error" role="alert">{copy.musicServiceOpenFailed}</p> : null}
      </div>
    </motion.main>
  );
}
