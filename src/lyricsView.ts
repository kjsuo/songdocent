import type { LyricLine } from "./useDesktopPolling";

export type LyricsViewItem = {
  line: LyricLine;
  sourceIndex: number;
  displayText: string;
  sectionBreakCount: number;
};

const displayTextForLine = (line: LyricLine) => {
  for (const value of [line.text, line.en]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
};

export const buildLyricsView = (lines: LyricLine[]): LyricsViewItem[] => {
  const items: LyricsViewItem[] = [];
  let sectionBreakCount = 0;

  lines.forEach((line, sourceIndex) => {
    const displayText = displayTextForLine(line);
    if (!displayText) {
      sectionBreakCount += 1;
      return;
    }

    items.push({
      line,
      sourceIndex,
      displayText,
      sectionBreakCount,
    });
    sectionBreakCount = 0;
  });

  return items;
};

export const findActiveLyricIndex = (
  items: LyricsViewItem[],
  playbackMs: number,
  preRollMs = 1_000,
) => {
  if (!items.length) return null;
  if (playbackMs < items[0].line.start_ms - preRollMs) return null;

  const nextIndex = items.findIndex(({ line }) => line.start_ms > playbackMs);
  return nextIndex === -1 ? items.length - 1 : Math.max(0, nextIndex - 1);
};

export const getLyricAnchorRatio = (isMobile: boolean) => isMobile ? 0.35 : 0.3;

export const calculateLyricScrollTop = ({
  elementTop,
  containerHeight,
  anchorRatio,
}: {
  elementTop: number;
  containerHeight: number;
  anchorRatio: number;
}) => elementTop - containerHeight * anchorRatio;
