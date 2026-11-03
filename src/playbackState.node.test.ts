import assert from "node:assert/strict";
import test from "node:test";
import {
  createLatestTaskRunner,
  isSamePositionTrack,
  isSelectedPlayerEvent,
  PLAYER_FALLBACK_POLL_INTERVAL_MS,
  PLAYER_POSITION_POLL_INTERVAL_MS,
  withPlaybackState,
} from "./playbackState.ts";

test("uses a ten second fallback poll", () => {
  assert.equal(PLAYER_FALLBACK_POLL_INTERVAL_MS, 10_000);
});

test("polls lightweight player position every second", () => {
  assert.equal(PLAYER_POSITION_POLL_INTERVAL_MS, 1_000);
});

test("applies position only to the loaded track", () => {
  assert.equal(isSamePositionTrack("track-1", "track-1"), true);
  assert.equal(isSamePositionTrack("track-1", "track-2"), false);
  assert.equal(isSamePositionTrack("track-1", undefined), true);
});

test("refreshes only for the selected player event", () => {
  assert.equal(isSelectedPlayerEvent("spotify", "spotify"), true);
  assert.equal(isSelectedPlayerEvent("spotify", "apple_music"), false);
  assert.equal(isSelectedPlayerEvent("apple_music", "apple_music"), true);
  assert.equal(isSelectedPlayerEvent("apple_music", "spotify"), false);
  assert.equal(isSelectedPlayerEvent("spotify", "unknown"), false);
});

test("coalesces overlapping triggers into one latest task", async () => {
  let releaseFirst: (() => void) | undefined;
  const firstBlocked = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const starts: number[] = [];
  let active = 0;
  let maxActive = 0;
  const runner = createLatestTaskRunner();

  const first = runner.run(async () => {
    starts.push(1);
    active += 1;
    maxActive = Math.max(maxActive, active);
    await firstBlocked;
    active -= 1;
  });
  await Promise.resolve();

  const replaced = runner.run(async () => {
    starts.push(2);
  });
  const latest = runner.run(async () => {
    starts.push(3);
    active += 1;
    maxActive = Math.max(maxActive, active);
    active -= 1;
  });

  releaseFirst?.();
  await Promise.all([first, replaced, latest]);

  assert.deepEqual(starts, [1, 3]);
  assert.equal(maxActive, 1);
});

test("updates playback state without changing track metadata", () => {
  const track = {
    id: "track-1",
    title: "SongDocent",
    isPlaying: true,
  };

  const pausedTrack = withPlaybackState(track, false);

  assert.deepEqual(pausedTrack, {
    id: "track-1",
    title: "SongDocent",
    isPlaying: false,
  });
  assert.notEqual(pausedTrack, track);
  assert.equal(track.isPlaying, true);
});

test("runs a refresh queued as the previous refresh finishes", async () => {
  const runner = createLatestTaskRunner();
  const starts: string[] = [];
  const first = runner.run(() => { starts.push("first"); });
  await Promise.resolve();
  const second = runner.run(() => { starts.push("second"); });

  await Promise.all([first, second]);

  assert.deepEqual(starts, ["first", "second"]);
});

test("waits for the refresh queued during completion", async () => {
  const runner = createLatestTaskRunner();
  let releaseSecond: (() => void) | undefined;
  const blocked = new Promise<void>((resolve) => { releaseSecond = resolve; });
  const first = runner.run(() => {});
  await Promise.resolve();
  let started = false;
  const second = runner.run(async () => {
    started = true;
    await blocked;
  });
  let finished = false;
  void first.then(() => { finished = true; });
  await Promise.resolve();

  assert.equal(started, true);
  assert.equal(finished, false);
  releaseSecond?.();
  await Promise.all([first, second]);
  assert.equal(finished, true);
});

test("keeps a missing track unchanged", () => {
  assert.equal(withPlaybackState(null, false), null);
});
