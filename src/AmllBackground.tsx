import { BackgroundRender, MeshGradientRenderer } from "@applemusic-like-lyrics/core";
import { useEffect, useRef, useState } from "react";

export function AmllBackground({ src, reducedMotion }: { src: string; reducedMotion: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const renderer = useRef<BackgroundRender<MeshGradientRenderer>>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let background: BackgroundRender<MeshGradientRenderer>;
    try {
      background = BackgroundRender.new(MeshGradientRenderer);
    } catch {
      return;
    }
    renderer.current = background;
    background.setFPS(30);
    background.setRenderScale(0.5);
    const canvas = background.getElement();
    const onContextLost = () => setReady(false);
    canvas.addEventListener("webglcontextlost", onContextLost);
    container.append(canvas);
    return () => {
      canvas.removeEventListener("webglcontextlost", onContextLost);
      background.dispose();
      canvas.remove();
      renderer.current = null;
    };
  }, []);

  useEffect(() => {
    renderer.current?.setStaticMode(reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    const background = renderer.current;
    if (!background) return;
    let cancelled = false;
    setReady(false);
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.src = src;
    void image.decode().then(async () => {
      if (cancelled) return;
      await background.setAlbum(image);
      if (!cancelled) setReady(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [src]);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <img src={src} alt="" className="absolute inset-0 size-full scale-125 object-cover blur-[100px] brightness-50" />
      <div ref={host} className={`songdocent-amll-background absolute inset-0 transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />
      <div className="absolute inset-0 bg-black/25" />
    </div>
  );
}
