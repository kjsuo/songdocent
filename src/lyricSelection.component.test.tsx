// @vitest-environment jsdom
import { afterEach, expect, test } from "vitest";
import { readLyricAnnotationSelection, shouldShowLyricAnnotation } from "./lyricSelection";
afterEach(() => { document.body.innerHTML = ""; window.getSelection()?.removeAllRanges(); });
test("original lyric selection produces an action before translation or automatic annotations", () => {
  document.body.innerHTML = '<div data-lyric-line-id="7"><p data-annotation-selectable="true">moonlight shadow</p></div>';
  const text = document.querySelector("p")!.firstChild!;
  const range = document.createRange();
  range.setStart(text, 0); range.setEnd(text, 9);
  range.getBoundingClientRect = () => ({ left: 50, top: 120, width: 80, height: 24 } as DOMRect);
  const selection = window.getSelection()!;
  selection.addRange(range);
  expect(readLyricAnnotationSelection(selection, 800)).toEqual({ lineId: "7", selectedText: "moonlight", left: 90, top: 112 });
  expect(shouldShowLyricAnnotation(false, true)).toBe(true);
  expect(shouldShowLyricAnnotation(false, false)).toBe(false);
});
test("collapsed selections and non-lyric content do not produce an action", () => {
  expect(readLyricAnnotationSelection(window.getSelection(), 800)).toBeNull();
  document.body.innerHTML = '<p>settings</p>';
  const range = document.createRange(); range.selectNodeContents(document.querySelector("p")!);
  window.getSelection()!.addRange(range);
  expect(readLyricAnnotationSelection(window.getSelection(), 800)).toBeNull();
});
