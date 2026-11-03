export type LyricAnnotationSelection = {
  lineId: string;
  selectedText: string;
  left: number;
  top: number;
};

type SelectionRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type LyricAnnotationSelectionInput = {
  text: string;
  startLineId?: string;
  endLineId?: string;
  rect: SelectionRect;
  viewportWidth: number;
};

const ACTION_EDGE_GAP = 28;
const ACTION_VERTICAL_GAP = 8;
const MAX_SELECTION_LENGTH = 500;

export const createLyricAnnotationSelection = ({
  text,
  startLineId,
  endLineId,
  rect,
  viewportWidth,
}: LyricAnnotationSelectionInput): LyricAnnotationSelection | null => {
  const lineId = startLineId?.trim();
  const selectedText = text.replace(/\s+/g, " ").trim();
  if (
    !lineId ||
    lineId !== endLineId?.trim() ||
    !selectedText ||
    selectedText.length > MAX_SELECTION_LENGTH ||
    rect.width <= 0 ||
    rect.height <= 0
  ) {
    return null;
  }

  const idealLeft = rect.left + rect.width / 2;
  const maxLeft = Math.max(ACTION_EDGE_GAP, viewportWidth - ACTION_EDGE_GAP);
  return {
    lineId,
    selectedText,
    left: Math.min(maxLeft, Math.max(ACTION_EDGE_GAP, idealLeft)),
    top: Math.max(12, rect.top - ACTION_VERTICAL_GAP),
  };
};

// Manual requests are independent of automatic annotation density and translation.
export const shouldShowLyricAnnotation = (automaticEnabled: boolean, requested: boolean) =>
  automaticEnabled || requested;

export function readLyricAnnotationSelection(selection: Selection | null, viewportWidth: number): LyricAnnotationSelection | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  const elementForNode = (node: Node) => node instanceof Element ? node : node.parentElement;
  const start = elementForNode(range.startContainer)?.closest('[data-annotation-selectable="true"]');
  const end = elementForNode(range.endContainer)?.closest('[data-annotation-selectable="true"]');
  if (!start || !end) return null;
  return createLyricAnnotationSelection({
    text: selection.toString(),
    startLineId: start.closest<HTMLElement>("[data-lyric-line-id]")?.dataset.lyricLineId,
    endLineId: end.closest<HTMLElement>("[data-lyric-line-id]")?.dataset.lyricLineId,
    rect: range.getBoundingClientRect(),
    viewportWidth,
  });
}
