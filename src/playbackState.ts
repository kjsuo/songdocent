export type PlayerSource = "spotify" | "apple_music";

export const PLAYER_FALLBACK_POLL_INTERVAL_MS = 10_000;
export const PLAYER_POSITION_POLL_INTERVAL_MS = 1_000;

export function isSamePositionTrack(loadedTrackId: string, positionTrackId?: string) {
  return !positionTrackId || positionTrackId === loadedTrackId;
}

export function isSelectedPlayerEvent(
  selectedSource: PlayerSource,
  eventSource: unknown,
) {
  return eventSource === selectedSource;
}

type AsyncTask = () => void | Promise<void>;

export function createLatestTaskRunner() {
  let latestTask: AsyncTask | null = null;
  let activeRun: Promise<void> | null = null;

  const drain = async () => {
    while (latestTask) {
      const task = latestTask;
      latestTask = null;
      await task();
    }
  };

  const run = (task: AsyncTask): Promise<void> => {
    latestTask = task;
    if (!activeRun) {
      activeRun = drain().finally(() => {
        activeRun = null;
        if (latestTask) return run(latestTask);
      });
    }
    return activeRun;
  };

  return { run };
}

export function withPlaybackState<T extends { isPlaying: boolean }>(
  track: T | null,
  isPlaying: boolean,
): T | null {
  if (!track || track.isPlaying === isPlaying) return track;
  return { ...track, isPlaying };
}
