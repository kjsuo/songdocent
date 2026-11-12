import { useAppUpdates } from "./appUpdates";
import { UpdateSettings } from "./UpdateSettings";
import { useMemo, useRef, useEffect, useLayoutEffect, useState, type MouseEvent } from "react";
import { Play, Pause, SkipBack, SkipForward, Globe, ChevronDown, Settings as SettingsIcon, Trash2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useDesktopPolling, type AnnotationDensity } from "./useDesktopPolling";
import { next, pause, play, prev, seek } from "./playerControls";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { LangCode, dictionary, mapNavigatorLanguage } from "./i18n";
import { initialTranslationLanguage } from "./translationLanguages";
import { TranslationIcon } from "./TranslationIcon";
import { WaitingForMusic } from "./WaitingForMusic";
import { AmllBackground } from "./AmllBackground";
import { AmllLyrics, type AmllLine } from "./AmllLyrics";
import { LyricSelectionHint } from "./LyricSelectionHint";
import { getTranslationActionMode } from "./translationAction";
import { type SettingsSection } from "./settings";
import { SettingsModal } from "./SettingsModal";
import { AppErrorNotice } from "./AppErrorNotice";
import { useAppError } from "./AppErrorProvider";
import { formatAnnotationLineBreaks, htmlLangForText, lineBreakClassForLang } from "./textBreaks";
import { buildLyricsView, getLyricAnchorRatio } from "./lyricsView";
import { readLyricAnnotationSelection, shouldShowLyricAnnotation, type LyricAnnotationSelection } from "./lyricSelection";
import { DESKTOP_PLATFORM } from "./platform/runtimePlatform";
import { SetupWizard, type SetupWizardMode } from "./setup/SetupWizard";
import {
  acceptKeychainPrimer,
  canUseCredentials,
  getSetupCompletionDisposition,
  getSetupDisposition,
  isKeychainPrimerAccepted,
  saveSetupDisposition,
  type SetupDisposition,
} from "./setup/setupState";

const ANNOTATION_DENSITIES: AnnotationDensity[] = ["off", "low", "medium", "high"];
const ANNOTATION_DENSITY_LABEL_KEYS: Record<AnnotationDensity, keyof typeof dictionary["en"]> = {
  off: "behindTheLineOff",
  low: "behindTheLineLow",
  medium: "behindTheLineMedium",
  high: "behindTheLineHigh",
};

const normalizeAnnotationDensity = (value: string | null): AnnotationDensity =>
  ANNOTATION_DENSITIES.includes(value as AnnotationDensity) ? (value as AnnotationDensity) : "medium";

const PLACEHOLDER_ANNOTATIONS = new Set([
  "annotation",
  "null",
  "none",
  "na",
  "notapplicable",
  "noannotation",
  "noannotationneeded",
  "notneeded",
  "behindtheline",
  "expertnote",
  "없음",
  "해당없음",
  "주석없음",
  "설명없음",
  "なし",
  "該当なし",
  "注釈なし",
]);

const normalizeDisplayAnnotation = (value: unknown) => {
  if (typeof value !== "string") return "";
  const unquoted = value.trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  const body = unquoted
    .replace(/^\s*(expert\s*note|behind\s*the\s*line|annotation)\s*[:\-—]\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const compact = body.toLowerCase().replace(/[\s_\-:/.]+/g, "");
  const isDiagnosticSlug = compact.startsWith("contentisnotempty") || compact.includes("butidisnot");
  return body && !PLACEHOLDER_ANNOTATIONS.has(compact) && !isDiagnosticSlug ? body : "";
};

type PlayerAppProps = {
  credentialsEnabled: boolean;
  primerAccepted: boolean;
  onPrimerAccepted: () => void;
  onOpenSetupGuide: () => void;
};

function PlayerApp({
  credentialsEnabled,
  primerAccepted,
  onPrimerAccepted,
  onOpenSetupGuide,
}: PlayerAppProps) {
  const { reportError, clearError } = useAppError();

  const [uiLang, setUiLang] = useState<LangCode>(() => {
    const detected = mapNavigatorLanguage(typeof navigator === "undefined" ? undefined : navigator.language);
    try {
      const stored = localStorage.getItem("uiLang");
      return stored && Object.hasOwn(dictionary, stored) ? stored as LangCode : detected;
    } catch { return detected; }
  });
  const [targetLang, setTargetLang] = useState<string>(initialTranslationLanguage);
  const [annotationDensity, setAnnotationDensity] = useState<AnnotationDensity>("medium");
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("ai");
  const [isMobile, setIsMobile] = useState(false);
  const isJa = uiLang === "ja";

  const t = (key: keyof typeof dictionary["en"]) =>
    dictionary[uiLang]?.[key] ?? dictionary.en[key] ?? key;

  const openSettings = (section: SettingsSection) => {
    setSettingsSection(section);
    setIsSettingsModalOpen(true);
  };



  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedAnnotationDensity = localStorage.getItem("annotationDensity");
    setAnnotationDensity(normalizeAnnotationDensity(storedAnnotationDensity));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("uiLang", uiLang);
  }, [uiLang]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("targetLang", targetLang);
  }, [targetLang]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("annotationDensity", annotationDensity);
  }, [annotationDensity]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleHeaderDragStart = (event: MouseEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest(".no-drag, button, a, input, select, textarea")) return;
    if (!("__TAURI_INTERNALS__" in window)) return;

    event.preventDefault();
    void getCurrentWindow().startDragging().catch(console.error);
  };

  const {
    playerSource,
    track,
    lyrics,
    lyricsNotFound,
    estimatedMs: hookEstimatedMs, // activeIndex는 훅에서 안 씀
    syncPosition,
    syncPlaybackState,
    translationPending,
    aiStage,
    annotationPendingLineId,
    clearAnnotationError,
    translateLyrics,
    annotateLyricsSelection,
    deleteTranslation,
  } = useDesktopPolling(targetLang, annotationDensity, credentialsEnabled);
  const translationLabel = translationPending
    ? aiStage === "searching"
      ? t("searching")
      : t("translating")
    : t("translate");
  const updates = useAppUpdates();
  useLayoutEffect(() => {
    updates.setCanInstall(!translationPending && !annotationPendingLineId);
    return () => updates.setCanInstall(true);
  }, [translationPending, annotationPendingLineId, updates.setCanInstall]);
  const updateInstalling = updates.phase === "downloading" || updates.phase === "installing";
  const lines = lyrics?.lines ?? [];
  const lyricItems = useMemo(() => buildLyricsView(lines), [lines]);
  const isSynced = lyrics?.has_synced_lyrics !== false;
  const translationKey = targetLang.toLowerCase();
  const hasCurrentTranslation = lyrics?.has_translation === true;
  const translationActionMode = getTranslationActionMode({
    hasCurrentTranslation,
    translationPending,
  });

  const [lyricSelection, setLyricSelection] = useState<LyricAnnotationSelection | null>(null);
  const [requestedAnnotationLines, setRequestedAnnotationLines] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    setRequestedAnnotationLines(new Set());
    setLyricSelection(null);
  }, [track?.id, targetLang, playerSource]);
  const lyricAnchorRatio = getLyricAnchorRatio(isMobile);

  const lastTrackIdRef = useRef<string | undefined>(track?.id);
  const trackChangeTimeRef = useRef<number>(0);
  // 1. 트랙 변경 감지
  useEffect(() => {
    if (track?.id !== lastTrackIdRef.current) {
      lastTrackIdRef.current = track?.id;
      trackChangeTimeRef.current = Date.now();
      // 트랙 변경 시 훅 내부 시간도 0으로 리셋 (중요)
      syncPosition(0);
      setLyricSelection(null);
    }
  }, [track?.id, syncPosition]);

  // 2. [시간 보정] 화면 우측 하단에 표시되는 '그 시간' 계산
  const correctedMs = useMemo(() => {
    if (!track || !track.isPlaying) return hookEstimatedMs;

    const timeSinceChange = Date.now() - trackChangeTimeRef.current;

    // 곡 초반 3초 동안은, 실제 흐른 시간보다 API 시간이 더 크면 '튀었다'고 보고 실제 시간 사용
    if (timeSinceChange < 3000) {
      return Math.min(hookEstimatedMs, timeSinceChange);
    }

    return hookEstimatedMs;
  }, [hookEstimatedMs, track]);

  const reducedMotion = useReducedMotion() === true;
  const amllLines = useMemo<AmllLine[]>(() => isSynced ? lyricItems.map((item, index) => {
    const { line, displayText, sectionBreakCount, sourceIndex } = item;
    const startTime = Math.max(0, line.start_ms);
    const endTime = Math.max(startTime, line.end_ms > startTime
      ? line.end_ms
      : lyricItems[index + 1]?.line.start_ms ?? track?.durationMs ?? startTime);
    const translation = line[translationKey];
    return {
      id: String(line.index ?? sourceIndex),
      sectionBreakCount,
      lyric: {
        startTime, endTime,
        words: [{ word: displayText, startTime, endTime }],
        translatedLyric: typeof translation === "string" ? translation : "",
        romanLyric: "",
        isBG: false,
        isDuet: false,
      },
    };
  }) : [], [isSynced, lyricItems, track?.durationMs, translationKey]);

  const lyricAnnotations = useMemo(() => new Map(lyricItems.flatMap(({ line, sourceIndex }) => {
    const id = String(line.index ?? sourceIndex);
    if (!shouldShowLyricAnnotation(annotationDensity !== "off", requestedAnnotationLines.has(id))) return [];
    const annotation = normalizeDisplayAnnotation(line.annotation);
    if (!annotation) return [];
    return [[id, (
      <p lang={htmlLangForText(targetLang)} dir="auto"
        className={`lyric-annotation text-start break-keep ${lineBreakClassForLang(targetLang)}`}>
        {formatAnnotationLineBreaks(annotation, targetLang)}
      </p>
    )] as const];
  })), [lyricItems, annotationDensity, requestedAnnotationLines, targetLang]);

  const captureLyricSelection = () => {
    const selection = readLyricAnnotationSelection(window.getSelection(), window.innerWidth);
    if (selection) {
      clearAnnotationError();
    }
    setLyricSelection(selection);
  };

  const requestSelectionAnnotation = async () => {
    if (updateInstalling) return;
    if (!lyricSelection || annotationPendingLineId) return;
    const completed = await annotateLyricsSelection(
      lyricSelection.lineId,
      lyricSelection.selectedText,
    );
    if (!completed) return;
    setRequestedAnnotationLines((previous) => new Set([...previous, lyricSelection.lineId]));
    setLyricSelection(null);
    window.getSelection()?.removeAllRanges();
  };

  async function runPlayerCommand(
    command: () => Promise<void>,
    onSuccess?: () => void,
  ) {
    try {
      await command();
      onSuccess?.();
      clearError("player");
    } catch (error) {
      reportError(error, {
        retry: () => runPlayerCommand(command, onSuccess),
      });
    }
  }

  const handleLyricClick = async (startTimeMs: number) => {
    if (!isSynced) return;
    if (window.getSelection()?.toString().trim()) return;
    syncPosition(startTimeMs);
    await runPlayerCommand(() => seek(startTimeMs, playerSource));
  };

  const handlePlayPause = async () => {
    if (!track) return;
    if (track.isPlaying) {
      await runPlayerCommand(() => pause(playerSource), () => syncPlaybackState(false));
    } else {
      await runPlayerCommand(() => play(playerSource), () => syncPlaybackState(true));
    }
  };
  const handleNext = async () => {
    await runPlayerCommand(() => next(playerSource));
  };
  const handlePrev = async () => {
    if (!track) return;
    if (Math.floor(correctedMs / 1000) < 3) {
      await runPlayerCommand(() => prev(playerSource));
    } else {
      syncPosition(0);
      await runPlayerCommand(() => seek(0, playerSource));
    }
  };

  const progressPercent = track?.durationMs
    ? Math.min(100, Math.max(0, (correctedMs / track.durationMs) * 100))
    : 0;
  const handleProgressSeek = (event: MouseEvent<HTMLDivElement>) => {
    if (!track) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const percentage = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const targetMs = Math.floor(track.durationMs * percentage);

    syncPosition(targetMs);
    void runPlayerCommand(() => seek(targetMs, playerSource));
  };

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white font-sans touch-none selection:bg-white/20">

      <UpdateSettings lang={uiLang} compact />
      {/* 1. Background (Atmosphere) */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        {track?.albumArt ? (
          <AmllBackground src={track.albumArt} reducedMotion={reducedMotion} />
        ) : (
          <div className="h-full w-full bg-neutral-900" />
        )}
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex h-full flex-col md:flex-row p-0 items-center">

        {/* A. Floating Header */}
        <header
          className="top-header-bar absolute top-0 left-0 right-0 z-50 pointer-events-auto"
          onMouseDown={handleHeaderDragStart}
        >
          <div
            className="top-header-logo-link pointer-events-auto no-drag cursor-pointer"
            onClick={() => window.location.reload()}
          >
            <img src="/songdocent-wordmark.svg" alt="SongDocent" className="top-header-logo w-auto object-contain drop-shadow-md opacity-90 hover:opacity-100 transition-opacity" />
          </div>

          <div
            data-tauri-drag-region
            className="top-header-drag-zone h-full min-w-8 flex-1"
          />

          <div className="top-header-actions pointer-events-auto no-drag flex items-center text-white/45 hover:text-white/80 transition-colors duration-300">
            {track ? <><div className="behind-line-control">
              <span>{t("behindTheLine")}:</span>
              <div className="behind-line-select-wrap">
                <select
                  value={annotationDensity}
                  onChange={(event) => setAnnotationDensity(normalizeAnnotationDensity(event.target.value))}
                  aria-label={t("behindTheLine")}
                  className="behind-line-select"
                >
                  {ANNOTATION_DENSITIES.map((density) => (
                    <option key={density} value={density} className="bg-neutral-900 text-white">
                      {t(ANNOTATION_DENSITY_LABEL_KEYS[density])}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} className="behind-line-chevron" />
              </div>

              <div className="w-px h-3 bg-white/20 mx-0.5" />

              {translationActionMode !== "delete" ? (
                <button
                  onClick={() => translateLyrics()}
                  disabled={!credentialsEnabled || !track?.id || translationPending || updateInstalling}
                  className="flex items-center gap-1 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40 ml-1 mr-1 whitespace-nowrap"
                  title={translationLabel}
                >
                  {translationActionMode === "loading" ? (
                    <div className="h-3 w-3 rounded-full border-[1.5px] border-white/30 border-t-white animate-spin" />
                  ) : (
                    <TranslationIcon size={12} className="opacity-80 hover:opacity-100 transition-opacity" />
                  )}
                  <span className="opacity-90" aria-live="polite">{translationLabel}</span>
                </button>
              ) : (
                <button
                  onClick={() => deleteTranslation()}
                  disabled={!track?.id || translationPending || updateInstalling}
                  className="flex items-center gap-1 hover:text-red-400 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ml-1 mr-1 whitespace-nowrap"
                  title={t("clearTranslationCache")}
                >
                  <Trash2 size={12} className="opacity-80 hover:opacity-100 transition-opacity" />
                  <span className="opacity-90">{t("deleteTranslation")}</span>
                </button>
              )}
            </div>
            <div className="top-header-divider w-px bg-white/10" />
            </> : null}
            <button
              onClick={() => openSettings("language")}
              className="flex items-center gap-2 text-xs font-medium hover:text-white transition-colors"
            >
              <Globe size={14} />
              <span>{uiLang.toUpperCase()}</span>
            </button>
            <div className="top-header-divider w-px bg-white/10" />
            <button
              onClick={() => openSettings("ai")}
              className="flex items-center gap-2 text-xs font-medium hover:text-white transition-colors"
              title={t("settings")}
            >
              <SettingsIcon size={14} />
            </button>

          </div>
        </header>

        {!track ? <WaitingForMusic lang={uiLang} source={playerSource} /> : <>
        {/* B. Left Glass Panel (PC Only) - 1/2 Width Centered */}
        <div className="hidden md:flex w-1/2 h-full items-center justify-center relative shrink-0">
          <AnimatePresence mode="wait">
            <motion.div
              className="player-panel flex flex-col h-fit relative"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, ease: "circOut" }}
            >
              <div className="relative aspect-square w-full rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)] group">
                {track?.albumArt ? (
                  <img src={track.albumArt} alt={t("albumArtwork")} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                )}

              </div>

              <div className="player-track-copy space-y-1 text-center md:text-left">
                <div>
                  <h2 className="player-track-title text-white line-clamp-2 pb-1">
                    {track?.title || t("noTrack")}
                  </h2>
                  <p className="player-track-artist line-clamp-1 pb-1">
                    {track?.artist || t("unknownArtist")}
                  </p>
                </div>
              </div>

              <div className="player-transport relative flex flex-col">
                <div
                  className="group/timeline relative h-3 cursor-pointer"
                  onClick={handleProgressSeek}
                  aria-label={t("seekTrack")}
                  role="slider"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progressPercent)}
                >
                  <div
                    className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-white/18 transition-[height] group-hover/timeline:h-3"
                  >
                    <div
                      className="h-full bg-white/80 transition-colors group-hover/timeline:bg-white"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-8">
                  <button
                    onClick={handlePrev}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                    title={t("previous")}
                    aria-label={t("previous")}
                  >
                    <SkipBack size={24} fill="currentColor" />
                  </button>
                  <button
                    onClick={handlePlayPause}
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    title={track?.isPlaying ? t("pause") : t("play")}
                    aria-label={track?.isPlaying ? t("pause") : t("play")}
                  >
                    {track?.isPlaying ? (
                      <Pause size={24} fill="currentColor" />
                    ) : (
                      <Play size={24} fill="currentColor" className="ml-0.5" />
                    )}
                  </button>
                  <button
                    onClick={handleNext}
                    className="flex h-11 w-11 items-center justify-center rounded-full text-white/55 transition-all hover:bg-white/10 hover:text-white active:scale-95"
                    title={t("next")}
                    aria-label={t("next")}
                  >
                    <SkipForward size={24} fill="currentColor" />
                  </button>
                </div>
              </div>

              {!isSynced && lyricItems.length > 0 && (
                <div className="mt-4 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs font-medium text-center">
                  {t("unsynced")}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div
          className="w-full md:w-1/2 h-full relative flex flex-col"
        >
          {lyricItems.length > 0 && <LyricSelectionHint lang={uiLang} />}
          {/* Top Fade Gradient */}
          <div
            className="absolute top-0 left-0 right-0 h-35 bg-gradient-to-b from-black to-transparent z-20 pointer-events-none backdrop-blur-[2px] md:hidden"
            style={{ maskImage: "linear-gradient(to bottom, black, transparent)", WebkitMaskImage: "linear-gradient(to bottom, black, transparent)" }}
          />           {/* Bottom Fade Gradient */}
          <div
            className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent z-40 pointer-events-none backdrop-blur-[2px] md:hidden"
            style={{ maskImage: "linear-gradient(to top, black, transparent)", WebkitMaskImage: "linear-gradient(to top, black, transparent)" }}
          />
          {amllLines.length > 0 ? (
            <AmllLyrics
              key={`${playerSource}:${track?.id ?? ""}`}
              lines={amllLines}
              time={correctedMs}
              playing={track?.isPlaying === true}
              selectionPaused={lyricSelection !== null}
              reducedMotion={reducedMotion}
              anchor={lyricAnchorRatio}
              translationLanguage={htmlLangForText(targetLang)}
              annotations={lyricAnnotations}
              onSeek={handleLyricClick}
              onSelect={captureLyricSelection}
              onBrowse={() => setLyricSelection(null)}
            />
          ) : (
            <div
              className="lyric-scroll-container flex-1 overflow-y-auto no-scrollbar relative -ml-8 pl-8 z-10 mobile-lyrics-mask"
              onMouseUp={captureLyricSelection}
              style={{
                maskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 100%)",
                WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 25%, black 100%)",
              }}
            >
              <div
                className="lyric-stack flex flex-col items-start px-6 md:pl-0 md:pr-12 max-w-5xl mx-auto md:mx-0 text-left relative"
                style={{
                  paddingTop: `${lyricAnchorRatio * 100}dvh`,
                  paddingBottom: `${(1 - lyricAnchorRatio) * 100}dvh`,
                }}
              >
                {/* 모바일 상단 정보 블록: 스크롤과 함께 자연스럽게 위로 사라짐 */}
                <div className="md:hidden w-full flex flex-col items-center text-center gap-4 mb-6">
                  {track?.albumArt && (
                    <div className="w-[46vw] max-w-[220px] aspect-square rounded-[1.5rem] overflow-hidden shadow-[0_10px_35px_rgba(0,0,0,0.55)]">
                      <img src={track.albumArt} className="w-full h-full object-cover" alt={t("albumArtwork")} />
                    </div>
                  )}
                  <div className="space-y-1 px-4">
                    <h2 className="text-2xl font-bold leading-tight drop-shadow-md line-clamp-2 text-white">{track?.title || t("noTrack")}</h2>
                    <p className="text-lg text-white/60 drop-shadow-sm break-words">{track?.artist || t("unknownArtist")}</p>
                  </div>
                </div>
                {lyricItems.length > 0 ? (
                  lyricItems.map(({ line, sourceIndex, displayText, sectionBreakCount }, index) => {
                    const translation = line[translationKey];
                    const id = String(line.index ?? sourceIndex);
                    return (
                      <div key={id} data-lyric-line-id={id} className="w-full py-2"
                        style={sectionBreakCount ? { marginTop: `${(index === 0 ? 0 : 2) + sectionBreakCount * 3}rem` } : undefined}>
                        <p data-annotation-selectable="true" className={`lyric-original break-keep text-pretty text-white/90 ${isJa ? "lyrics-ja" : ""}`}>
                          {displayText}
                        </p>
                        {typeof translation === "string" && translation && (
                          <p data-annotation-selectable="true" lang={htmlLangForText(targetLang)} dir="auto"
                            className="lyric-translation font-kor break-keep text-balance text-white/90">
                            {translation}
                          </p>
                        )}
                        {lyricAnnotations.get(id)}
                      </div>
                    );
                  })
                ) : lyricsNotFound ? (
                  <p role="status" className="text-base text-white/65 md:hidden">{t("lyricsNotFound")}</p>
                ) : null}
              </div>
            </div>
          )}

          {lyricSelection && (
            <div
              className="fixed z-[90] -translate-x-1/2 -translate-y-full"
              style={{ left: lyricSelection.left, top: lyricSelection.top }}
            >
              <motion.button
                type="button"
                className="lyric-annotation-action"
                initial={reducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.12 }}
                disabled={annotationPendingLineId !== null || updateInstalling}
                aria-busy={annotationPendingLineId === lyricSelection.lineId}
                aria-label={t(annotationPendingLineId === lyricSelection.lineId ? "explainingLyricSelection" : "explainLyricSelection")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  void requestSelectionAnnotation();
                }}
              >
                <span aria-hidden="true">{t("explainLyricSelection")}</span>
                <span aria-hidden="true">{t("explainingLyricSelection")}</span>
              </motion.button>
            </div>
          )}

          {lyricItems.length === 0 && (
            <div className={`absolute inset-0 items-center justify-center z-0 pointer-events-none px-6 text-center ${lyricsNotFound ? "hidden md:flex" : "flex"}`}>
              {lyricsNotFound ? (
                <p role="status" className="text-base text-white/65">{t("lyricsNotFound")}</p>
              ) : (
                <LoadingDots />
              )}
            </div>
          )}

          {/* Mobile Bottom Spacer for Floating Player */}
          <div className="hidden md:hidden md:h-24 shrink-0" />
        </div>

        {/* D. Floating Player Bar */}
        <div className="absolute bottom-6 left-4 right-4 z-50 pointer-events-none md:hidden">
          {/* Mobile Translation Button (Above Player Bar) */}
          <div className="absolute bottom-[130%] right-6 z-50 md:hidden pointer-events-auto flex items-center gap-2">
            {translationActionMode === "delete" ? (
              <button
                onClick={() => deleteTranslation()}
                disabled={!track?.id || updateInstalling}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/35 text-white/70 backdrop-blur-md transition-all hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                title={t("clearTranslationCache")}
                aria-label={t("clearTranslationCache")}
              >
                <Trash2 size={16} />
              </button>
            ) : null}
            <button
              onClick={() => translateLyrics()}
              disabled={!credentialsEnabled || !track?.id || translationPending || updateInstalling}
              className="rainbow-card px-4 py-2 rounded-full hover:bg-white/10 transition-all text-white disabled:opacity-40 disabled:cursor-not-allowed group flex items-center gap-1"
              title={translationLabel}
            >
              {translationActionMode === "loading" ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <TranslationIcon size={18} className="opacity-70 group-hover:opacity-100 transition-opacity translate-y-0.5" />
              )}
              <span className="text-sm font-bold tracking-wide opacity-90 group-hover:opacity-100" aria-live="polite">{translationLabel}</span>
            </button>
          </div>

          <div className="glass-card relative rounded-[2.5rem] md:rounded-full transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group/player md:w-[500px] flex flex-col md:justify-center h-22 md:h-20 overflow-hidden pointer-events-auto md:translate-y-[120%] md:opacity-0 md:group-hover/player-hover:translate-y-[-3rem] md:group-hover/player-hover:opacity-100">

            {/* [Fix] Chrome Backdrop Blur Layer: Separated for better compatibility */}
            <div className="absolute inset-0 -z-10 bg-black/20 backdrop-blur-[13px]" style={{ WebkitBackdropFilter: "blur(13px)" }} />

            {/* Progress Bar */}
            {/* Mobile: Absolute Bottom. PC: Absolute Top Edge */}
            <div
              className="
                    absolute top-0 left-0 right-0 h-1.5 
                    md:top-0 md:left-0 md:right-0 md:h-1 md:w-full md:rounded-none
                    bg-white/20 cursor-pointer group hover:h-3 md:hover:h-1.5 transition-all overflow-hidden z-10
                 "
              onClick={handleProgressSeek}
            >
              <div
                className="h-full bg-white/50 md:bg-white/90 group-hover:bg-white/70 transition-colors relative"
                style={{ width: `${progressPercent}%` }}
              >
              </div>
            </div>

            <div className="flex flex-row items-center justify-between md:justify-center p-5 pb-7 md:p-0 gap-4">

              {/* Info Section (Left) - Hidden on PC */}
              <div className="flex items-center gap-4 flex-1 min-w-0 md:hidden">
                {track?.albumArt && (
                  <div className="relative w-12 h-12 md:w-14 md:h-14 rounded-2xl overflow-hidden shrink-0 shadow-lg border border-white/5">
                    <img src={track.albumArt} alt={t("albumArtwork")} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col overflow-hidden justify-center w-full">
                  <MarqueeText
                    text={track?.title || t("noTrack")}
                    className="text-sm md:text-base font-bold text-white mb-0.5"
                  />
                  <MarqueeText
                    text={track?.artist || t("unknownArtist")}
                    className="text-xs md:text-sm text-white/50 font-medium"
                  />
                </div>
              </div>

              {/* Controls (Right/Center) */}
              <div className="flex items-center gap-3 md:gap-10 shrink-0">
                <button onClick={handlePrev} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all active:scale-95">
                  <SkipBack size={24} fill="currentColor" className="md:w-6 md:h-6" />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="flex items-center justify-center w-12 h-12 md:w-14 md:h-14 rounded-full bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 transition-all"
                >
                  {track?.isPlaying ? (
                    <Pause size={22} fill="currentColor" className="md:w-6 md:h-6" />
                  ) : (
                    <Play size={22} fill="currentColor" className="md:w-6 md:h-6 ml-0.5" />
                  )}
                </button>
                <button onClick={handleNext} className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all active:scale-95">
                  <SkipForward size={24} fill="currentColor" className="md:w-6 md:h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        </>}
      </div>

      <SettingsModal
        open={isSettingsModalOpen}
        initialSection={settingsSection}
        onClose={() => setIsSettingsModalOpen(false)}
        onOpenSetupGuide={onOpenSetupGuide}
        primerAccepted={primerAccepted}
        onPrimerAccepted={onPrimerAccepted}
        uiLang={uiLang}
        targetLang={targetLang}
        setUiLang={setUiLang}
        setTargetLang={setTargetLang}
        platform={DESKTOP_PLATFORM}
      />
      <AppErrorNotice
        lang={uiLang}
        onOpenSettings={openSettings}
        platform={DESKTOP_PLATFORM}
      />
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5 opacity-60">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="h-2 w-2 rounded-full bg-white"
          animate={{
            y: [-3, 3, -3],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldMarquee, setShouldMarquee] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.offsetWidth;
        // 약간의 오차(1px)를 두어 불필요한 마퀴 방지, 하지만 길면 확실히 마퀴
        setShouldMarquee(textWidth > containerWidth);
      }
    };

    // 초기 체크
    checkOverflow();

    // 폰트 로딩 완료 후 재체크 (중요)
    document.fonts.ready.then(checkOverflow);

    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full overflow-hidden whitespace-nowrap ${className}`}
    >
      {/* 텍스트 너비 측정용 보이지 않는 span */}
      <span
        ref={textRef}
        className="absolute top-0 left-0 opacity-0 pointer-events-none whitespace-nowrap"
        aria-hidden="true"
      >
        {text}
      </span>

      {shouldMarquee ? (
        <div className="animate-marquee flex items-center w-max">
          <span className="shrink-0 pr-8">{text}</span>
          <span className="shrink-0 pr-8">{text}</span>
        </div>
      ) : (
        <div className="truncate">{text}</div>
      )}
    </div>
  );
}

export default function StartupGate() {
  const [initialSetup] = useState(() => ({
    disposition: getSetupDisposition(),
    primerAccepted: isKeychainPrimerAccepted(),
  }));
  const [disposition, setDisposition] = useState<SetupDisposition>(
    initialSetup.disposition,
  );
  const [primerAccepted, setPrimerAccepted] = useState(
    initialSetup.primerAccepted,
  );
  const [guideOpen, setGuideOpen] = useState(
    initialSetup.disposition === "pending",
  );
  const [guideMode, setGuideMode] = useState<SetupWizardMode>("first-run");

  const reopenSetupGuide = () => {
    setGuideMode("reentry");
    setGuideOpen(true);
  };

  const handlePrimerAccepted = () => {
    acceptKeychainPrimer();
    setPrimerAccepted(canUseCredentials({ primerAccepted: true }));
  };

  const handleComplete = () => {
    const nextDisposition = getSetupCompletionDisposition({
      mode: guideMode,
      disposition,
    });
    if (nextDisposition !== disposition) {
      saveSetupDisposition(nextDisposition);
      setDisposition(nextDisposition);
    }
    setGuideOpen(false);
  };

  const handleSkip = () => {
    saveSetupDisposition("skipped");
    setDisposition("skipped");
    setGuideOpen(false);
  };

  const handleClose = () => {
    setGuideOpen(false);
  };

  if (guideOpen) {
    return (
      <SetupWizard
        mode={guideMode}
        primerAccepted={primerAccepted}
        onPrimerAccepted={handlePrimerAccepted}
        onComplete={handleComplete}
        onSkip={handleSkip}
        onClose={handleClose}
        platform={DESKTOP_PLATFORM}
      />
    );
  }

  return (
    <PlayerApp
      credentialsEnabled={canUseCredentials({ primerAccepted })}
      primerAccepted={primerAccepted}
      onPrimerAccepted={handlePrimerAccepted}
      onOpenSetupGuide={reopenSetupGuide}
      key={disposition}
    />
  );
}
