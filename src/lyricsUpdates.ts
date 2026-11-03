import type { LyricLine, LyricsPayload } from "./useDesktopPolling";

export const lyricLineId = (line: LyricLine, position: number) => String(line.index ?? position).trim();

export function mergeTranslationLine(current: LyricLine, incoming: LyricLine, preserveAnnotation: boolean) {
  const merged = { ...current, ...incoming };
  if (preserveAnnotation) {
    delete merged.annotation;
    if ("annotation" in current) merged.annotation = current.annotation;
    delete merged.annotation_grounding;
    if ("annotation_grounding" in current) merged.annotation_grounding = current.annotation_grounding;
  }
  return merged;
}

export function mergeTranslatedLyrics(current: LyricsPayload | null, incoming: LyricsPayload, manualLineIds: ReadonlySet<string>) {
  const currentLines = new Map(current?.lines?.map((line, index) => [lyricLineId(line, index), line]));
  return {
    ...incoming,
    lines: incoming.lines?.map((line, index) => {
      const id = lyricLineId(line, index);
      const previous = currentLines.get(id);
      return previous && manualLineIds.has(id) ? mergeTranslationLine(previous, line, true) : line;
    }),
  };
}

export function mergeSelectedAnnotation(current: LyricsPayload, incoming: LyricsPayload, lineId: string) {
  const selected = incoming.lines?.find((line, index) => lyricLineId(line, index) === lineId);
  if (!selected) return current;
  return {
    ...current,
    lines: current.lines?.map((line, index) => {
      if (lyricLineId(line, index) !== lineId) return line;
      const merged = { ...line };
      delete merged.annotation;
      if ("annotation" in selected) merged.annotation = selected.annotation;
      delete merged.annotation_grounding;
      if ("annotation_grounding" in selected) merged.annotation_grounding = selected.annotation_grounding;
      return merged;
    }),
  };
}
