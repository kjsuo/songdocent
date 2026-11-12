import { DomLyricPlayer, LayoutReason, LyricLineMouseEvent, type LyricLine } from "@applemusic-like-lyrics/core";
import "@applemusic-like-lyrics/core/style.css";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type AmllLine = { lyric: LyricLine; id: string; sectionBreakCount: number };

type LyricSlot = { id: string; translation: HTMLDivElement; annotation: HTMLDivElement };

class SongDocentLyricPlayer extends DomLyricPlayer {
  override calcLayout(reason: LayoutReason) {
    super.calcLayout(reason === LayoutReason.DiscreteScroll ? LayoutReason.ContinuousScroll : reason);
  }

  measureLyricHeights(lineIds?: ReadonlySet<string>) {
    if (!this.getElement().clientWidth) return;
    const rows = this.currentLyricGroups.flatMap((group, index) => {
      const lineId = group.mainLine.getElement().dataset.lyricLineId;
      if (lineIds && (!lineId || !lineIds.has(lineId))) return [];
      const wrapper = group.getElement();
      const wasMounted = wrapper.parentElement === this.getElement();
      group.show();
      return [{ group, index, wrapper, wasMounted }];
    });
    // Read all sizes after mounting the rows so the browser lays them out together.
    const sizes = rows.map(({ wrapper }) => wrapper.getBoundingClientRect());
    let changed = false;
    rows.forEach(({ group, index, wasMounted }, rowIndex) => {
      if (!wasMounted) group.hide();
      const { width, height } = sizes[rowIndex];
      if (!height) return;
      const previous = this.lyricGroupSize.get(group);
      if (previous?.[0] === width && previous[1] === height) return;
      this.lyricGroupSize.set(group, [width, height]);
      this.layoutCalculator.setLineHeight(index, height);
      changed = true;
    });
    if (changed) this.calcLayout(LayoutReason.Resize);
  }
}

export function AmllLyrics({
  lines, time, playing, selectionPaused, reducedMotion, anchor,
  translationLanguage, annotations, onSeek, onSelect, onBrowse,
}: {
  lines: AmllLine[];
  time: number;
  playing: boolean;
  selectionPaused: boolean;
  reducedMotion: boolean;
  anchor: number;
  translationLanguage: string | undefined;
  annotations: ReadonlyMap<string, ReactNode>;
  onSeek: (time: number) => void;
  onSelect: () => void;
  onBrowse: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<SongDocentLyricPlayer>(null);
  const clock = useRef(time);
  const seek = useRef(onSeek);
  const loadedLyrics = useRef<{ structure: string; slots: LyricSlot[] } | null>(null);
  const measuredSlots = useRef<LyricSlot[] | null>(null);
  const previousAnnotations = useRef(annotations);
  const [slots, setSlots] = useState<LyricSlot[]>([]);
  const translations = useMemo(() => new Map(lines.map(({ id, lyric }) => [id, lyric.translatedLyric])), [lines]);

  useLayoutEffect(() => {
    seek.current = onSeek;
  }, [onSeek]);

  useLayoutEffect(() => {
    clock.current = Math.max(0, Math.round(time));
    if (!selectionPaused) player.current?.setCurrentTime(clock.current);
  }, [time, selectionPaused]);

  useLayoutEffect(() => {
    const instance = new SongDocentLyricPlayer();
    player.current = instance;
    instance.setOptimizeOptions({ tryAdvanceStartTime: false, resetLineTimestamps: false });
    instance.setAlignAnchor("top");
    const click = (event: Event) => {
      if (event instanceof LyricLineMouseEvent && !window.getSelection()?.toString().trim()) {
        seek.current(event.line.getLine().startTime);
      }
    };
    instance.addEventListener("line-click", click);
    host.current?.append(instance.getElement());
    return () => {
      instance.removeEventListener("line-click", click);
      instance.dispose();
      player.current = null;
      loadedLyrics.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const instance = player.current;
    if (!instance) return;
    // AMLL rebuilds its timeline and scroll state when given new lyric lines.
    const originals = lines.map((row) => ({ ...row, lyric: { ...row.lyric, translatedLyric: "" } }));
    const structure = JSON.stringify(originals);
    if (loadedLyrics.current?.structure === structure) return;
    instance.setLyricLines(originals.map(({ lyric }) => lyric), clock.current);
    const nextSlots = instance.currentLyricGroups.flatMap((group, index) => {
      const row = lines[index];
      if (!row) return [];
      const element = group.mainLine.getElement();
      element.dataset.lyricLineId = row.id;
      if (row.sectionBreakCount) element.style.paddingTop = `${row.sectionBreakCount * 1.5}rem`;
      const [original] = element.children;
      original?.setAttribute("data-annotation-selectable", "true");
      original?.classList.add("songdocent-amll-original");
      const translation = document.createElement("div");
      translation.className = "songdocent-amll-translation";
      translation.dataset.annotationSelectable = "true";
      translation.dir = "auto";
      const annotation = document.createElement("div");
      annotation.className = "songdocent-amll-annotation";
      element.append(translation, annotation);
      return [{ id: row.id, translation, annotation }];
    });
    loadedLyrics.current = { structure, slots: nextSlots };
    setSlots(nextSlots);
  }, [lines]);

  useLayoutEffect(() => {
    const instance = player.current;
    if (!instance || slots !== loadedLyrics.current?.slots) return;
    const initialLayout = measuredSlots.current !== slots;
    const changedIds = new Set<string>();
    const reveal: HTMLDivElement[] = [];

    for (const { id, translation } of slots) {
      const text = translations.get(id) ?? "";
      if (previousAnnotations.current.get(id) !== annotations.get(id)) changedIds.add(id);
      if (selectionPaused && !initialLayout) continue;
      const textChanged = translation.textContent !== text;
      const lang = translationLanguage ?? "";
      if (!textChanged && translation.lang === lang) continue;
      for (const animation of translation.getAnimations()) animation.cancel();
      if (textChanged && text && !initialLayout && !reducedMotion) reveal.push(translation);
      translation.textContent = text;
      translation.lang = lang;
      changedIds.add(id);
    }

    measuredSlots.current = slots;
    previousAnnotations.current = annotations;
    if (initialLayout) instance.measureLyricHeights();
    else if (changedIds.size) instance.measureLyricHeights(changedIds);
    for (const translation of reveal) {
      translation.animate([
        { clipPath: "inset(0 0 100% 0)", opacity: 0, offset: 0 },
        { clipPath: "inset(0 0 100% 0)", opacity: 0, offset: 0.25 },
        { clipPath: "inset(0 0 0 0)", opacity: 0.96, offset: 1 },
      ], { duration: 360, easing: "ease-out" });
    }
  }, [slots, translations, translationLanguage, annotations, reducedMotion, selectionPaused]);

  useLayoutEffect(() => {
    const instance = player.current;
    const container = host.current;
    if (!instance || !container || slots.length === 0) return;
    let frame = 0;
    let disposed = false;
    let width = container.clientWidth;
    const measure = () => {
      if (disposed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => instance.measureLyricHeights());
    };
    const observer = new ResizeObserver(() => {
      const nextWidth = container.clientWidth;
      if (width === nextWidth) return;
      width = nextWidth;
      measure();
    });
    observer.observe(container);
    void document.fonts.ready.then(measure);
    return () => {
      disposed = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [slots]);

  useLayoutEffect(() => {
    const instance = player.current;
    if (!instance) return;
    instance.setAlignPosition(anchor);
    instance.setEnableSpring(!reducedMotion);
    instance.setEnableScale(!reducedMotion);
    instance.setEnableBlur(!reducedMotion);
  }, [anchor, reducedMotion]);

  useEffect(() => {
    const instance = player.current;
    if (!instance) return;
    if (playing && !selectionPaused) instance.resume();
    else instance.pause();
  }, [playing, selectionPaused]);

  useEffect(() => {
    const instance = player.current;
    if (!instance || selectionPaused) return;
    let previous: number | undefined;
    let frame = 0;
    const tick = (now: number) => {
      instance.update(previous === undefined ? 0 : now - previous);
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [selectionPaused]);

  return (
    <div className="songdocent-amll-lyrics relative min-h-0 flex-1" ref={host}
      onMouseUp={onSelect} onWheel={onBrowse} onTouchStart={onBrowse}>
      {slots.map(({ id, annotation }) => createPortal(annotations.get(id), annotation, id))}
    </div>
  );
}
