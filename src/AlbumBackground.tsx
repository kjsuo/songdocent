import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

const VERTEX = `#version 300 es
out vec2 uv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const DOWNSAMPLE = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec2 crop;
in vec2 uv;
out vec4 color;
void main() {
  color = vec4(texture(image, (uv - 0.5) * crop + 0.5).rgb, 1.0);
}`;

const BLUR = `#version 300 es
precision highp float;
uniform sampler2D image;
uniform vec2 direction;
uniform float sigma;
in vec2 uv;
out vec4 color;
void main() {
  vec3 sum = vec3(0.0);
  float total = 0.0;
  for (int i = -48; i <= 48; i++) {
    float x = float(i);
    float weight = exp(-0.5 * x * x / (sigma * sigma));
    vec2 point = uv + direction * x;
    sum += texture(image, clamp(point, vec2(0.0), vec2(1.0))).rgb * weight;
    total += weight;
  }
  color = vec4(sum / total, 1.0);
}`;

const OUTPUT = `#version 300 es
precision highp float;
uniform sampler2D image;
in vec2 uv;
out vec4 color;
void main() {
  vec3 rgb = texture(image, uv).rgb;
  // Match CSS brightness(.65) and saturate(1.5), without an 8-bit intermediate.
  rgb *= 0.65;
  float luminance = dot(rgb, vec3(0.213, 0.715, 0.072));
  rgb = clamp(mix(vec3(luminance), rgb, 1.5), 0.0, 1.0);
  float radius = clamp(length((uv - 0.5) * 1.41421356), 0.0, 1.0);
  float shade = radius < 0.5 ? radius * 0.2 : 0.1 + (radius - 0.5) * 0.6;
  rgb *= 1.0 - shade;
  // Interleaved Gradient Noise, at physical pixel resolution, before quantization.
  // Jorge Jimenez: https://www.iryoku.com/next-generation-post-processing-in-call-of-duty-advanced-warfare
  float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  rgb += (noise - 0.5) / 255.0;
  color = vec4(rgb, 1.0);
}`;

/** Float blur buffers keep the smooth colors intact until the final dithered output. */
function createRenderer(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false });
  if (!gl) throw new Error("WebGL 2 unavailable");
  const textures: WebGLTexture[] = [];
  const buffers: WebGLFramebuffer[] = [];
  const programs: WebGLProgram[] = [];
  const shaders: WebGLShader[] = [];
  const dispose = () => {
    textures.forEach((texture) => gl.deleteTexture(texture));
    buffers.forEach((buffer) => gl.deleteFramebuffer(buffer));
    programs.forEach((program) => gl.deleteProgram(program));
    shaders.forEach((shader) => gl.deleteShader(shader));
  };
  try {
    if (!gl.getExtension("EXT_color_buffer_float")) throw new Error("Float color buffers unavailable");
    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) throw new Error("Shader allocation failed");
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || "Shader compilation failed");
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, VERTEX);
    const program = (fragment: string) => {
      const result = gl.createProgram();
      if (!result) throw new Error("Program allocation failed");
      programs.push(result);
      gl.attachShader(result, vertex);
      gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(result);
      if (!gl.getProgramParameter(result, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(result) || "Shader link failed");
      return result;
    };
    const downsample = program(DOWNSAMPLE);
    const blur = program(BLUR);
    const output = program(OUTPUT);
    const texture = () => {
      const result = gl.createTexture();
      if (!result) throw new Error("Texture allocation failed");
      textures.push(result);
      gl.bindTexture(gl.TEXTURE_2D, result);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return result;
    };
    const source = texture();
    const stages = [0, 1].map(() => {
      const tex = texture();
      const buffer = gl.createFramebuffer();
      if (!buffer) throw new Error("Framebuffer allocation failed");
      buffers.push(buffer);
      return { tex, buffer };
    });
    gl.disable(gl.DITHER);
    const render = (image: HTMLImageElement) => {
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width * window.devicePixelRatio));
      const height = Math.max(1, Math.round(rect.height * window.devicePixelRatio));
      canvas.width = width;
      canvas.height = height;
      // Keep sigma <= 16 texels so the dense 97-tap kernel covers at least 3 sigma.
      // Prefilter the original BEFORE these passes; sparse sampling of detailed art aliases into stripes.
      const scale = Math.min(1, 16 / 208, 256 / Math.max(rect.width, rect.height, 1));
      const w = Math.max(1, Math.floor(rect.width * scale));
      const h = Math.max(1, Math.floor(rect.height * scale));
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.generateMipmap(gl.TEXTURE_2D);
      for (const stage of stages) {
        gl.bindTexture(gl.TEXTURE_2D, stage.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, stage.buffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, stage.tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error("Float framebuffer incomplete");
      }
      const aspect = rect.width / Math.max(rect.height, 1);
      const imageAspect = image.naturalWidth / image.naturalHeight;
      const crop = [Math.min(1, aspect / imageAspect) / 1.3, Math.min(1, imageAspect / aspect) / 1.3];
      gl.viewport(0, 0, w, h);
      gl.useProgram(downsample);
      gl.uniform1i(gl.getUniformLocation(downsample, "image"), 0);
      gl.uniform2f(gl.getUniformLocation(downsample, "crop"), crop[0], crop[1]);
      gl.bindFramebuffer(gl.FRAMEBUFFER, stages[0].buffer);
      gl.bindTexture(gl.TEXTURE_2D, source);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.useProgram(blur);
      gl.uniform1i(gl.getUniformLocation(blur, "image"), 0);
      for (let pass = 0; pass < 2; pass++) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, stages[1 - pass].buffer);
        gl.bindTexture(gl.TEXTURE_2D, stages[pass].tex);
        gl.uniform2f(gl.getUniformLocation(blur, "direction"), pass === 0 ? 1 / w : 0, pass === 1 ? 1 / h : 0);
        gl.uniform1f(gl.getUniformLocation(blur, "sigma"), pass === 0 ? 208 * w / Math.max(rect.width, 1) : 208 * h / Math.max(rect.height, 1));
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.useProgram(output);
      gl.uniform1i(gl.getUniformLocation(output, "image"), 0);
      gl.bindTexture(gl.TEXTURE_2D, stages[0].tex);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (gl.getError() !== gl.NO_ERROR) throw new Error("Background rendering failed");
    };
    return { render, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}

export function AlbumBackground({ src }: { src: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let renderer: ReturnType<typeof createRenderer> | undefined;
    let observer: ResizeObserver | undefined;
    let frame = 0;
    let stopped = false;
    const image = new Image();
    const fail = () => {
      stopped = true;
      setReady(false);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      renderer?.dispose();
      renderer = undefined;
    };
    const draw = () => {
      if (stopped || !image.naturalWidth) return;
      try {
        renderer?.render(image);
        setReady(true);
      } catch {
        fail();
      }
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(draw);
    };
    const contextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    setReady(false);
    canvas.addEventListener("webglcontextlost", contextLost);
    window.addEventListener("resize", schedule);
    try {
      renderer = createRenderer(canvas);
      observer = new ResizeObserver(schedule);
      observer.observe(canvas);
      image.crossOrigin = "anonymous";
      image.onload = draw;
      image.onerror = fail;
      image.src = src;
    } catch {
      fail();
    }
    return () => {
      stopped = true;
      image.onload = null;
      image.onerror = null;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      canvas.removeEventListener("webglcontextlost", contextLost);
      renderer?.dispose();
    };
  }, [src]);

  return (
    <div className="absolute inset-0" aria-hidden="true">
      <motion.img
        src={src}
        alt=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 h-full w-full object-cover blur-[160px] brightness-[0.65] saturate-150 scale-[1.3] origin-center"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-black/10 to-black/40" />
      <motion.canvas
        ref={canvasRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: ready ? 1 : 0 }}
        transition={{ duration: 1.5 }}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}
