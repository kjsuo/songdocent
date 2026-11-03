import assert from "node:assert/strict";
import test from "node:test";
import * as lyricsView from "./lyricsView.ts";

const {
  buildLyricsView,
  calculateLyricScrollTop,
  findActiveLyricIndex,
  getLyricAnchorRatio,
} = lyricsView;

const line = (index: number, startMs: number, text: string) => ({
  index,
  start_ms: startMs,
  end_ms: startMs + 1_000,
  timestamp: "",
  text,
});

test("keeps blank lyric lines as section spacing but not timeline items", () => {
  const view = buildLyricsView([
    line(0, 1_000, "Verse"),
    line(1, 2_000, "   "),
    line(2, 4_000, "Chorus"),
  ]);

  assert.deepEqual(
    view.map(({ line: lyric, sectionBreakCount }) => ({
      index: lyric.index,
      sectionBreakCount,
    })),
    [
      { index: 0, sectionBreakCount: 0 },
      { index: 2, sectionBreakCount: 1 },
    ],
  );
  assert.equal(findActiveLyricIndex(view, 2_500), 0);
  assert.equal(findActiveLyricIndex(view, 4_000), 1);
});

test("counts consecutive blank lines without activating them", () => {
  const view = buildLyricsView([
    line(0, 1_000, "Verse"),
    line(1, 2_000, ""),
    line(2, 2_500, "\t"),
    line(3, 5_000, "Bridge"),
  ]);

  assert.equal(view[1]?.sectionBreakCount, 2);
  assert.equal(findActiveLyricIndex(view, 3_000), 0);
});

test("keeps the active lyric top at a fixed viewport anchor", () => {
  const containerHeight = 800;
  const anchorRatio = 0.5;

  for (const elementTop of [640, 1_240, 2_075]) {
    const scrollTop = calculateLyricScrollTop({
      elementTop,
      containerHeight,
      anchorRatio,
    });

    assert.equal(elementTop - scrollTop, containerHeight * anchorRatio);
  }
});

test("uses a 30 percent anchor on desktop", () => {
  assert.equal(getLyricAnchorRatio(false), 0.3);
});
