import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { normalizeAppError } from "./appError";
import {
  createLatestTaskRunner,
  isSamePositionTrack,
  isSelectedPlayerEvent,
  PLAYER_FALLBACK_POLL_INTERVAL_MS,
  PLAYER_POSITION_POLL_INTERVAL_MS,
  withPlaybackState,
} from "./playbackState";
import {
  isCliAiProvider,
  getEffectiveGroundingSearchMode,
  getStoredLyricsSource,
  getStoredTranslationChunkConfig,
  getStoredTranslationConfig,
  type LyricsSource,
} from "./settings";
import { useAppError } from "./AppErrorProvider";
import {
  isCredentialOperationCurrent,
  shouldFetchCredentialBackedLyrics,
  type CredentialOperation,
  type CredentialOperationContext,
} from "./setup/setupState";
import {
  clearProviderExpired,
  markProviderExpired,
  providerCooldownMsForErrorCode,
} from "./providerConnection";
import { lyricLineId, mergeSelectedAnnotation, mergeTranslatedLyrics, mergeTranslationLine } from "./lyricsUpdates";

export type TrackInfo = {
  id: string;
  source: "spotify" | "apple_music";
  title: string;
  artist: string;
  album?: string;
  albumArt?: string;
  durationMs: number;
  isPlaying: boolean;
  genre?: string;
};

export type LyricLine = {
  index: number;
  start_ms: number;
  end_ms: number;
  timestamp: string;
  text?: string;
  en?: string;
  ko?: string;
  [key: string]: unknown;
};

export type LyricsPayload = {
  search_mode?: string;
  song_url?: string;
  lines?: LyricLine[];
  title?: string;
  artist?: string;
  artist_id?: string;
  genre?: string;
  genre_hint?: string;
  genre_source?: string;
  genre_confidence?: number;
  matched_title?: string;
  matched_artist?: string;
  matched_album?: string;
  has_synced_lyrics?: boolean;
  has_unsynced_lyrics?: boolean;
  has_translation?: boolean;
  target_lang?: string;
};

type CurrentTrack = {
  source: "spotify" | "apple_music";
  id?: string;
  title: string;
  artist: string;
  album?: string;
  durationMs?: number;
  positionMs?: number;
  isPlaying: boolean;
  artworkUrl?: string;
  artworkData?: string;
  genre?: string;
};

type TauriWindow = Window & { __TAURI_INTERNALS__?: unknown };
export type AnnotationDensity = "off" | "low" | "medium" | "high";

type TranslationLineEvent = {
  request_id?: string;
  target_lang?: string;
  line?: LyricLine;
};

type PlayerChangedEvent = {
  source?: string;
};

type PlayerPosition = {
  id?: string;
  positionMs: number;
  isPlaying: boolean;
};

type ItunesGenreMetadata = {
  genre: string;
  genre_hint: string;
  genre_source: string;
  genre_confidence: number;
  matched_title?: string;
  matched_artist?: string;
  matched_album?: string;
};

type CredentialOperationKind = "lyrics" | "translation" | "annotation";
type CredentialContextIdentity = Omit<CredentialOperationContext, "epoch">;

const preferredItunesCountry = () => {
  if (typeof navigator === "undefined") return "JP";
  const locale = navigator.language || "";
  const region = locale.split(/[-_]/)[1]?.trim().toUpperCase();
  return region && /^[A-Z]{2}$/.test(region) ? region : "JP";
};

export function useDesktopPolling(
  _targetLang: string,
  annotationDensity: AnnotationDensity,
  credentialsEnabled: boolean,
) {
  const { reportError, clearError } = useAppError();
  const [playerSource, setPlayerSource] = useState<LyricsSource>(() => getStoredLyricsSource());
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [lyrics, setLyricsState] = useState<LyricsPayload | null>(null);
  const [lyricsNotFound, setLyricsNotFound] = useState(false);
  const lyricsRef = useRef<LyricsPayload | null>(null);
  const setLyrics = useCallback((update: SetStateAction<LyricsPayload | null>) => {
    const next = typeof update === "function" ? update(lyricsRef.current) : update;
    lyricsRef.current = next;
    setLyricsState(next);
  }, []);
  const manualAnnotationLineIdsRef = useRef(new Set<string>());
  const cacheQueueRef = useRef<Promise<void>>(Promise.resolve());
  const enqueueCacheOperation = useCallback((operation: () => Promise<void>) => {
    const next = cacheQueueRef.current.then(operation);
    cacheQueueRef.current = next.catch(() => undefined);
    return next;
  }, []);
  const [estimatedMs, setEstimatedMs] = useState(0);
  const [translationPending, setTranslationPending] = useState(false);
  const [annotationPendingLineId, setAnnotationPendingLineId] = useState<string | null>(null);
  const baseProgressRef = useRef(0);
  const fetchedAtRef = useRef(Date.now());
  const estimatedMsRef = useRef(0);
  const lastLyricsTrackIdRef = useRef<string | null>(null);
  const translationRequestIdRef = useRef<string | null>(null);
  const cliRequests = useRef(new Set<string>());
  const [aiStage, setAiStage] = useState<"searching" | "translating">("translating");
  const cancelCliRequests = useCallback(() => {
    for (const requestId of cliRequests.current) void invoke("cancel_cli_ai_request", { requestId }).catch(() => {});
    cliRequests.current.clear();
  }, []);
  useEffect(() => {
    if (!(window as TauriWindow).__TAURI_INTERNALS__) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void listen<{requestId:string;stage:string}>("songdocent-ai-stage", event => {
      if (cliRequests.current.has(event.payload.requestId) && (event.payload.stage === "searching" || event.payload.stage === "translating")) setAiStage(event.payload.stage);
    }).then(stop => { if(disposed) stop(); else unlisten = stop; }).catch(() => {});
    return () => { disposed = true; unlisten?.(); };
  }, []);
  const credentialContextRef = useRef<CredentialOperationContext>({
    epoch: 0,
    credentialsEnabled,
    selectedSource: playerSource,
    trackId: null,
    targetLang: _targetLang.toLowerCase(),
  });
  const latestCredentialIdentityRef = useRef<CredentialContextIdentity>({
    credentialsEnabled,
    selectedSource: playerSource,
    trackId: null,
    targetLang: _targetLang.toLowerCase(),
  });
  const credentialOperationIdsRef = useRef<Record<CredentialOperationKind, number>>({
    lyrics: 0,
    translation: 0,
    annotation: 0,
  });
  const providerCooldownUntilRef = useRef<Record<LyricsSource, number>>({
    spotify: 0,
    apple_music: 0,
  });
  const lastResetCredentialEpochRef = useRef(-1);
  const playerPollFailureCountRef = useRef(0);
  const playerRefreshRunnerRef = useRef<ReturnType<typeof createLatestTaskRunner> | null>(null);
  const positionRefreshRunnerRef = useRef<ReturnType<typeof createLatestTaskRunner> | null>(null);
  if (!playerRefreshRunnerRef.current) {
    playerRefreshRunnerRef.current = createLatestTaskRunner();
  }
  if (!positionRefreshRunnerRef.current) {
    positionRefreshRunnerRef.current = createLatestTaskRunner();
  }

  const ensureCredentialContext = useCallback((identity: CredentialContextIdentity) => {
    latestCredentialIdentityRef.current = identity;
    const current = credentialContextRef.current;
    if (
      current.credentialsEnabled === identity.credentialsEnabled &&
      current.selectedSource === identity.selectedSource &&
      current.trackId === identity.trackId &&
      current.targetLang === identity.targetLang
    ) {
      return { context: current, changed: false };
    }

    const context = { ...identity, epoch: current.epoch + 1 };
    credentialContextRef.current = context;
    cancelCliRequests();
    translationRequestIdRef.current = null;
    return { context, changed: true };
  }, [cancelCliRequests]);

  const resetCredentialContextState = useCallback(
    (context: CredentialOperationContext) => {
      if (lastResetCredentialEpochRef.current === context.epoch) return;
      lastResetCredentialEpochRef.current = context.epoch;
      lastLyricsTrackIdRef.current = null;
      cancelCliRequests();
      translationRequestIdRef.current = null;
      manualAnnotationLineIdsRef.current.clear();
      setLyrics(null);
      setLyricsNotFound(false);
      setTranslationPending(false);
      setAnnotationPendingLineId(null);
      clearError("lyrics");
      clearError("translation");
      clearError("annotation");
    },
    [clearError, setLyrics],
  );

  const beginCredentialOperation = useCallback((kind: CredentialOperationKind) => {
    const operationId = credentialOperationIdsRef.current[kind] + 1;
    credentialOperationIdsRef.current[kind] = operationId;
    return {
      context: { ...credentialContextRef.current },
      operationId,
    } satisfies CredentialOperation;
  }, []);

  const credentialOperationIsCurrent = useCallback(
    (kind: CredentialOperationKind, operation: CredentialOperation) =>
      isCredentialOperationCurrent(
        operation,
        credentialContextRef.current,
        credentialOperationIdsRef.current[kind],
      ),
    [],
  );

  ensureCredentialContext({
    credentialsEnabled,
    selectedSource: playerSource,
    trackId: track?.id ?? null,
    targetLang: _targetLang.toLowerCase(),
  });

  const syncPosition = useCallback((ms: number) => {
    const nextPosition = Math.max(0, ms);
    baseProgressRef.current = nextPosition;
    fetchedAtRef.current = Date.now();
    estimatedMsRef.current = nextPosition;
    setEstimatedMs(nextPosition);
  }, []);

  const syncPlaybackState = useCallback((isPlaying: boolean) => {
    if (isPlaying) {
      baseProgressRef.current = estimatedMsRef.current;
      fetchedAtRef.current = Date.now();
    }
    setTrack((current) => withPlaybackState(current, isPlaying));
  }, []);

  useEffect(() => {
    const handleSettingsChanged = () => {
      setPlayerSource(getStoredLyricsSource());
      credentialContextRef.current = { ...credentialContextRef.current, epoch: credentialContextRef.current.epoch + 1 };
      cancelCliRequests();
      translationRequestIdRef.current = null;
      manualAnnotationLineIdsRef.current.clear();
      setTranslationPending(false);
      setAnnotationPendingLineId(null);
      lastLyricsTrackIdRef.current = null;
      setLyrics(null);
    };
    window.addEventListener("songdocent-settings-changed", handleSettingsChanged);
    return () => window.removeEventListener("songdocent-settings-changed", handleSettingsChanged);
  }, [setLyrics]);

  useEffect(() => {
    const { context } = ensureCredentialContext(latestCredentialIdentityRef.current);
    resetCredentialContextState(context);
  }, [
    _targetLang,
    credentialsEnabled,
    ensureCredentialContext,
    playerSource,
    resetCredentialContextState,
    track?.id,
  ]);

  useEffect(
    () => () => {
      const current = credentialContextRef.current;
      credentialContextRef.current = { ...current, epoch: current.epoch + 1 };
      cancelCliRequests();
      translationRequestIdRef.current = null;
      clearError("lyrics");
      clearError("translation");
      clearError("annotation");
    },
    [clearError],
  );

  useEffect(() => {
    if (!(window as TauriWindow).__TAURI_INTERNALS__) return;

    let cancelled = false;
    let unlisten: UnlistenFn | undefined;
    void listen<TranslationLineEvent>("songdocent-translation-line", (event) => {
      if (!credentialContextRef.current.credentialsEnabled) return;
      const payload = event.payload;
      if (!payload?.line || payload.request_id !== translationRequestIdRef.current) return;

      const incomingLine = payload.line;
      const incomingId = String(incomingLine.index ?? "").trim();
      if (!incomingId) return;
      const targetLang = (payload.target_lang || _targetLang).toLowerCase();

      setLyrics((current) => {
        if (!current?.lines?.length) return current;

        let changed = false;
        const lines = current.lines.map((line, position) => {
          if (lyricLineId(line, position) !== incomingId) return line;
          changed = true;
          return mergeTranslationLine(line, incomingLine,
            manualAnnotationLineIdsRef.current.has(incomingId));
        });

        if (!changed) return current;
        return {
          ...current,
          has_translation: true,
          target_lang: targetLang,
          lines,
        };
      });
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [_targetLang, credentialsEnabled, setLyrics]);

  useEffect(() => {
    let cancelled = false;
    let unlisten: UnlistenFn | undefined;

    const poll = async () => {
      if (!(window as TauriWindow).__TAURI_INTERNALS__) {
        setTrack(null);
        return;
      }

      try {
        const current = await invoke<CurrentTrack | null>("get_current_track", {
          source: playerSource,
        });
        if (cancelled) return;
        playerPollFailureCountRef.current = 0;
        clearError("player");

        if (!current) {
          const contextUpdate = ensureCredentialContext({
            credentialsEnabled,
            selectedSource: playerSource,
            trackId: null,
            targetLang: _targetLang.toLowerCase(),
          });
          if (contextUpdate.changed) {
            resetCredentialContextState(contextUpdate.context);
          }
          setTrack(null);
          setLyrics(null);
          lastLyricsTrackIdRef.current = null;
          syncPosition(0);
          return;
        }

        const positionMs = current.positionMs ?? 0;
        baseProgressRef.current = positionMs;
        fetchedAtRef.current = Date.now();
        estimatedMsRef.current = positionMs;
        setEstimatedMs(positionMs);
        const nextTrack = {
          id: current.id || `${current.source}:${current.artist}:${current.title}`,
          source: current.source,
          title: current.title,
          artist: current.artist,
          album: current.album,
          albumArt: current.artworkUrl || current.artworkData,
          durationMs: current.durationMs || 1,
          isPlaying: current.isPlaying,
          genre: current.genre,
        };
        const targetLang = _targetLang.toLowerCase();
        const contextUpdate = ensureCredentialContext({
          credentialsEnabled,
          selectedSource: playerSource,
          trackId: nextTrack.id,
          targetLang,
        });
        if (contextUpdate.changed) {
          resetCredentialContextState(contextUpdate.context);
        }
        setTrack(nextTrack);

        if (current.source !== playerSource) {
          if (lastLyricsTrackIdRef.current) {
            setLyrics(null);
            lastLyricsTrackIdRef.current = null;
          }
          return;
        }

        if (shouldFetchCredentialBackedLyrics({
          credentialsEnabled,
          selectedSource: playerSource,
          currentSource: current.source,
          trackId: current.id,
          alreadyLoadedKey: lastLyricsTrackIdRef.current,
        })) {
          if (providerCooldownUntilRef.current[current.source] > Date.now()) {
            return;
          }

          const operation = beginCredentialOperation("lyrics");
          lastLyricsTrackIdRef.current = current.id ?? null;
          clearError("lyrics");
          setLyricsNotFound(false);
          setLyrics(null);
          void (async () => {
            try {
              const payload =
                current.source === "spotify"
                  ? await invoke<LyricsPayload | null>("get_spotify_lyrics", {
                    trackId: current.id,
                    title: current.title,
                    artist: current.artist,
                  })
                  : await invoke<LyricsPayload | null>("get_apple_music_lyrics", {
                    trackId: current.id,
                    title: current.title,
                    artist: current.artist,
                    album: current.album,
                    durationMs: current.durationMs,
                    genre: current.genre,
                  });
              if (
                cancelled ||
                !credentialOperationIsCurrent("lyrics", operation)
              ) {
                return;
              }

              let nextPayload = payload;
              if (payload) {
                try {
                  nextPayload = await invoke<LyricsPayload>("apply_translation_cache", {
                    trackId: current.id,
                    targetLang,
                    payload,
                  });
                } catch (cacheError) {
                  if (credentialOperationIsCurrent("lyrics", operation)) {
                    console.error("Lyrics translation cache apply failed:", cacheError);
                    reportError(cacheError);
                  }
                }
                if (
                  cancelled ||
                  !credentialOperationIsCurrent("lyrics", operation)
                ) {
                  return;
                }
              }

              setLyrics(nextPayload);
              setLyricsNotFound(!nextPayload?.lines?.length);
              clearProviderExpired(current.source);
              providerCooldownUntilRef.current[current.source] = 0;
              clearError("lyrics");
            } catch (error) {
              if (
                !cancelled &&
                credentialOperationIsCurrent("lyrics", operation)
              ) {
                const appError = normalizeAppError(error);
                console.error(
                  `${current.source === "spotify" ? "Spotify" : "Apple Music"} lyrics fetch failed:`,
                  error,
                );
                if (appError.code === "LYRICS_NOT_FOUND") {
                  setLyricsNotFound(true);
                  clearError("lyrics");
                  return;
                }
                lastLyricsTrackIdRef.current = null;
                if (appError.code === "LYRICS_AUTH_EXPIRED") {
                  markProviderExpired(current.source);
                }
                const cooldownMs = providerCooldownMsForErrorCode(appError.code);
                if (cooldownMs > 0) {
                  providerCooldownUntilRef.current[current.source] = Date.now() + cooldownMs;
                }
                reportError(appError);
              }
            }
          })();
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Desktop player polling failed:", error);
          playerPollFailureCountRef.current += 1;
          if (playerPollFailureCountRef.current === 3) reportError(error);
          const contextUpdate = ensureCredentialContext({
            credentialsEnabled,
            selectedSource: playerSource,
            trackId: null,
            targetLang: _targetLang.toLowerCase(),
          });
          if (contextUpdate.changed) {
            resetCredentialContextState(contextUpdate.context);
          }
          setTrack(null);
        }
      }
    };

    const refresh = () => {
      void playerRefreshRunnerRef.current?.run(poll);
    };

    void listen<PlayerChangedEvent>("songdocent-player-changed", (event) => {
      if (isSelectedPlayerEvent(playerSource, event.payload?.source)) refresh();
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    refresh();
    const timer = window.setInterval(refresh, PLAYER_FALLBACK_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      unlisten?.();
    };
  }, [
    _targetLang,
    clearError,
    beginCredentialOperation,
    credentialOperationIsCurrent,
    credentialsEnabled,
    ensureCredentialContext,
    playerSource,
    reportError,
    resetCredentialContextState,
    setLyrics,
    syncPosition,
  ]);

  useEffect(() => {
    const loadedTrackId = track?.id;
    if (!loadedTrackId || !(window as TauriWindow).__TAURI_INTERNALS__) return;

    let cancelled = false;
    const pollPosition = async () => {
      try {
        const position = await invoke<PlayerPosition | null>("get_player_position", {
          source: playerSource,
          trackId: loadedTrackId,
        });
        if (
          cancelled ||
          !position ||
          !isSamePositionTrack(loadedTrackId, position.id)
        ) {
          return;
        }

        syncPosition(position.positionMs);
        setTrack((current) => {
          if (!current || current.id !== loadedTrackId) return current;
          return withPlaybackState(current, position.isPlaying);
        });
      } catch {
        // The slower full refresh owns player error reporting and recovery.
      }
    };
    const refreshPosition = () => {
      void positionRefreshRunnerRef.current?.run(pollPosition);
    };

    const timer = window.setInterval(refreshPosition, PLAYER_POSITION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [playerSource, syncPosition, track?.id]);

  useEffect(() => {
    if (!track?.isPlaying) return;
    let raf = 0;
    const tick = () => {
      const nextPosition = baseProgressRef.current + Date.now() - fetchedAtRef.current;
      estimatedMsRef.current = nextPosition;
      setEstimatedMs(nextPosition);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [track?.isPlaying]);

  const translateLyrics: () => Promise<void> = useCallback(async () => {
    const targetLang = _targetLang.toLowerCase();
    const trackId = track?.id;
    const currentContext = credentialContextRef.current;
    const sourceLyrics = lyricsRef.current;
    if (
      !currentContext.credentialsEnabled ||
      !sourceLyrics?.lines?.length ||
      !trackId ||
      currentContext.trackId !== trackId ||
      currentContext.targetLang !== targetLang ||
      currentContext.selectedSource !== playerSource
    ) {
      return;
    }

    const operation = beginCredentialOperation("translation");
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    translationRequestIdRef.current = requestId;
    setAiStage("translating");
    clearError("translation");
    setTranslationPending(true);
    try {
      const config = getStoredTranslationConfig();
      if (isCliAiProvider(config.provider)) cliRequests.current.add(requestId);
      const title = sourceLyrics.title || track?.title || "";
      const artist = sourceLyrics.artist || track?.artist || "";
      let itunesGenre: ItunesGenreMetadata | null = null;
      if (title.trim() && artist.trim()) {
        try {
          itunesGenre = await invoke<ItunesGenreMetadata | null>("resolve_itunes_genre", {
            title,
            artist,
            album: track?.album,
            durationMs: track?.durationMs,
            country: preferredItunesCountry(),
          });
        } catch (genreError) {
          if (credentialOperationIsCurrent("translation", operation)) {
            console.error("iTunes genre lookup failed:", genreError);
          }
        }
      }
      if (!credentialOperationIsCurrent("translation", operation)) return;
      const chunkConfig = getStoredTranslationChunkConfig();
      const payloadForTranslation = {
        ...sourceLyrics,
        title,
        artist,
        genre: itunesGenre?.genre,
        genre_hint: itunesGenre?.genre_hint || itunesGenre?.genre,
        genre_source: itunesGenre?.genre_source,
        genre_confidence: itunesGenre?.genre_confidence,
        matched_title: itunesGenre?.matched_title,
        matched_artist: itunesGenre?.matched_artist,
        matched_album: itunesGenre?.matched_album,
      };
      const payload = await invoke<LyricsPayload>("translate_lyrics", {
        payload: payloadForTranslation,
        targetLang,
        provider: config.provider,
        model: config.model,
        baseUrl: config.baseUrl,
        ...(config.apiReasoning ? { apiReasoning: config.apiReasoning } : {}),
        ...(config.cliOptions ? { cliOptions: config.cliOptions } : {}),
        overwrite: true,
        annotationDensity,
        searchMode: getEffectiveGroundingSearchMode(config.provider, config.model),
        requestId,
        translationChunkMode: chunkConfig.mode,
        translationChunkThreshold: chunkConfig.threshold,
        translationChunkSize: chunkConfig.chunkSize,
      });
      if (!credentialOperationIsCurrent("translation", operation)) return;
      const mergedPayload = mergeTranslatedLyrics(lyricsRef.current, payload, manualAnnotationLineIdsRef.current);
      setLyrics(mergedPayload);
      clearError("translation");
      if (credentialOperationIsCurrent("translation", operation)) {
        try {
          await enqueueCacheOperation(async () => {
            if (!credentialOperationIsCurrent("translation", operation)) return;
            await invoke("save_translation_cache", { trackId, targetLang, payload: mergedPayload });
          });
        } catch (cacheError) {
          if (credentialOperationIsCurrent("translation", operation)) {
            console.error("Lyrics translation cache save failed:", cacheError);
            reportError(cacheError);
          }
        }
      }
    } catch (error) {
      if (credentialOperationIsCurrent("translation", operation)) {
        console.error("Lyrics translation failed:", error);
        reportError(error, {
          retry: async () => {
            if (!credentialOperationIsCurrent("translation", operation)) return;
            await translateLyrics();
          },
        });
      }
    } finally {
      cliRequests.current.delete(requestId);
      if (credentialOperationIsCurrent("translation", operation)) {
        if (translationRequestIdRef.current === requestId) {
          translationRequestIdRef.current = null;
        }
        setTranslationPending(false);
      }
    }
  }, [
    _targetLang,
    annotationDensity,
    beginCredentialOperation,
    clearError,
    credentialOperationIsCurrent,
    enqueueCacheOperation,
    setLyrics,
    credentialsEnabled,
    playerSource,
    track?.album,
    track?.artist,
    track?.durationMs,
    track?.id,
    track?.title,
    reportError,
  ]);

  const deleteTranslation = useCallback(async () => {
    const targetLang = _targetLang.toLowerCase();
    const trackId = track?.id;
    credentialOperationIdsRef.current.translation += 1;
    credentialOperationIdsRef.current.annotation += 1;
    cancelCliRequests();
    translationRequestIdRef.current = null;
    manualAnnotationLineIdsRef.current.clear();
    setTranslationPending(false);
    setAnnotationPendingLineId(null);
    clearError("translation");
    clearError("annotation");
    setLyrics((current) => {
      if (!current?.lines) return current;
      return {
        ...current,
        has_translation: false,
        target_lang: targetLang,
        lines: current.lines.map((line) => {
          const nextLine = { ...line };
          delete nextLine[targetLang];
          if (targetLang === "ko") delete nextLine.ko;
          delete nextLine.annotation;
          return nextLine;
        }),
      };
    });
    if (trackId) {
      const clearCache = async () => {
        try {
          await enqueueCacheOperation(async () => {
            await invoke("clear_translation_cache", { trackId, targetLang });
          });
          clearError("storage");
        } catch (error) {
          reportError({ ...normalizeAppError(error), code: "CACHE_CLEAR_FAILED", domain: "storage", retryable: true }, { retry: clearCache });
        }
      };
      await clearCache();
    }
  }, [_targetLang, clearError, enqueueCacheOperation, reportError, setLyrics, track?.id]);

  const annotateLyricsSelection: (lineId: string, selectedText: string) => Promise<boolean> = useCallback(
    async (lineId: string, selectedText: string) => {
      const targetLang = _targetLang.toLowerCase();
      const trackId = track?.id;
      const currentContext = credentialContextRef.current;
      const sourceLyrics = lyricsRef.current;
      if (
        !currentContext.credentialsEnabled ||
        !sourceLyrics?.lines?.length ||
        !trackId ||
        currentContext.trackId !== trackId ||
        currentContext.targetLang !== targetLang ||
        currentContext.selectedSource !== playerSource
      ) {
        return false;
      }

      const operation = beginCredentialOperation("annotation");
      const config = getStoredTranslationConfig();
      const requestId = crypto.randomUUID();
      if (isCliAiProvider(config.provider)) cliRequests.current.add(requestId);
      clearError("annotation");
      setAnnotationPendingLineId(lineId);
      try {
        const payload = await invoke<LyricsPayload>("annotate_lyrics_selection", {
          payload: sourceLyrics,
          lineId,
          selectedText,
          targetLang,
          model: config.model,
          searchMode: getEffectiveGroundingSearchMode(config.provider, config.model),
          provider: config.provider,
          baseUrl: config.baseUrl,
          ...(config.apiReasoning ? { apiReasoning: config.apiReasoning } : {}),
          ...(isCliAiProvider(config.provider) ? { cliOptions: config.cliOptions, requestId } : {}),
        });
        if (!credentialOperationIsCurrent("annotation", operation)) return false;
        const currentLyrics = lyricsRef.current;
        if (!currentLyrics) return false;
        const mergedPayload = mergeSelectedAnnotation(currentLyrics, payload, lineId);
        if (mergedPayload === currentLyrics) return false;
        manualAnnotationLineIdsRef.current.add(lineId);
        setLyrics(mergedPayload);
        clearError("annotation");
        if (credentialOperationIsCurrent("annotation", operation)) {
          try {
            await enqueueCacheOperation(async () => {
              if (!credentialOperationIsCurrent("annotation", operation)) return;
              await invoke("save_translation_cache", { trackId, targetLang, payload: mergedPayload });
            });
          } catch (cacheError) {
            if (credentialOperationIsCurrent("annotation", operation)) {
              console.error("Lyrics annotation cache save failed:", cacheError);
              reportError(cacheError);
            }
          }
        }
        return credentialOperationIsCurrent("annotation", operation);
      } catch (error) {
        if (credentialOperationIsCurrent("annotation", operation)) {
          console.error("Lyrics annotation failed:", error);
          reportError(error, {
            retry: async () => {
              if (!credentialOperationIsCurrent("annotation", operation)) return;
              await annotateLyricsSelection(lineId, selectedText);
            },
          });
        }
        return false;
      } finally {
        cliRequests.current.delete(requestId);
        if (credentialOperationIsCurrent("annotation", operation)) {
          setAnnotationPendingLineId(null);
        }
      }
    },
    [
      _targetLang,
      beginCredentialOperation,
      clearError,
      credentialOperationIsCurrent,
      enqueueCacheOperation,
      setLyrics,
      credentialsEnabled,
      playerSource,
      reportError,
      track?.id,
    ],
  );
  const clearAnnotationError = useCallback(() => clearError("annotation"), [clearError]);

  return {
    playerSource,
    track,
    lyrics,
    lyricsNotFound,
    estimatedMs,
    syncPosition,
    syncPlaybackState,
    translationPending,
    aiStage,
    annotationPendingLineId,
    clearAnnotationError,
    translateLyrics,
    annotateLyricsSelection,
    deleteTranslation,
  };
}
