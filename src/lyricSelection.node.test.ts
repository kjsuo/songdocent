import assert from "node:assert/strict";
import test from "node:test";
import { createLyricAnnotationSelection } from "./lyricSelection.ts";

test("creates an annotation action above a same-line lyric selection", () => {
  const selection = createLyricAnnotationSelection({
    text: "  moonlight\n  shadow  ",
    startLineId: "12",
    endLineId: "12",
    rect: { left: 80, top: 140, width: 120, height: 42 },
    viewportWidth: 800,
  });

  assert.deepEqual(selection, {
    lineId: "12",
    selectedText: "moonlight shadow",
    left: 140,
    top: 132,
  });
});

test("rejects selections spanning multiple lyric lines", () => {
  assert.equal(
    createLyricAnnotationSelection({
      text: "two different lines",
      startLineId: "4",
      endLineId: "5",
      rect: { left: 20, top: 100, width: 200, height: 80 },
      viewportWidth: 500,
    }),
    null,
  );
});

test("keeps the floating action inside the viewport", () => {
  const selection = createLyricAnnotationSelection({
    text: "edge",
    startLineId: "1",
    endLineId: "1",
    rect: { left: -30, top: 4, width: 20, height: 20 },
    viewportWidth: 320,
  });

  assert.equal(selection?.left, 28);
  assert.equal(selection?.top, 12);
});
