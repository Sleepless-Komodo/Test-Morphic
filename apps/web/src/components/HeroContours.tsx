'use client';

import { useEffect, useRef } from 'react';

// Morphic = shapes that morph. The hero background is a topographic contour field
// of slowly drifting noise; the lines bend and brighten around the pointer.
// One WebGL2 fragment shader, paused offscreen. Its drift is slow, so it runs under reduced motion too.

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseOn;
out vec4 o;

vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(hash(i), f), dot(hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
    mix(dot(hash(i + vec2(0, 1)), f - vec2(0, 1)), dot(hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x),
    u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes.y;
  vec2 m = uMouse * vec2(uRes.x / uRes.y, 1.0);
  float d = distance(uv, m);
  float t = uTime * 0.035;

  vec2 q = uv * 1.5;
  float f = fbm(q + vec2(t, -0.6 * t)) + 0.4 * fbm(q * 2.1 - vec2(0.3 * t, t));
  f += uMouseOn * 0.16 * exp(-d * d * 14.0);

  float bands = f * 16.0;
  float w = max(fwidth(bands), 1e-3);
  float g = abs(fract(bands - 0.5) - 0.5);
  float line = 1.0 - smoothstep(0.5 * w, 1.5 * w, g);

  // Every fifth line is an index line, like a survey map.
  float major = step(mod(floor(bands + 0.5), 5.0), 0.5);
  float a = line * mix(0.11, 0.32, major);

  // Quiet behind the copy, full strength toward the edges.
  vec2 c = gl_FragCoord.xy / uRes - vec2(0.5, 0.55);
  a *= mix(0.3, 1.0, smoothstep(0.05, 0.55, length(c * vec2(1.0, 1.5))));

  a += line * 0.45 * uMouseOn * exp(-d * d * 9.0);
  a = clamp(a, 0.0, 1.0);
  o = vec4(vec3(a), a);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  return s;
}

export default function HeroContours({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl2', { antialias: false, alpha: true });
    if (!canvas || !gl) return; // No WebGL2: the stage stays solid black.

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    // One oversized triangle covers the viewport.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes = gl.getUniformLocation(prog, 'uRes');
    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uMouse = gl.getUniformLocation(prog, 'uMouse');
    const uMouseOn = gl.getUniformLocation(prog, 'uMouseOn');

    const host = canvas.parentElement!;
    const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, on: 0, ton: 0 };
    let frame = 0;
    let visible = true;
    const start = performance.now();

    // Perf budget: the field is soft background texture, so it renders at 75% of CSS size
    // (never above 1x DPR) and redraws at ~30fps; its drift is slow enough that this is invisible.
    const RENDER_SCALE = 0.75;
    const FRAME_MS = 33;
    let lastDraw = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1) * RENDER_SCALE;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    };

    const draw = (time: number) => {
      mouse.x += (mouse.tx - mouse.x) * 0.08;
      mouse.y += (mouse.ty - mouse.y) * 0.08;
      mouse.on += (mouse.ton - mouse.on) * 0.06;
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.uniform1f(uMouseOn, mouse.on);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const loop = () => {
      frame = 0;
      if (!visible || document.hidden) return;
      const now = performance.now();
      if (now - lastDraw >= FRAME_MS) {
        lastDraw = now;
        draw((now - start) / 1000);
      }
      frame = requestAnimationFrame(loop);
    };
    const kick = () => {
      if (!frame && visible && !document.hidden) frame = requestAnimationFrame(loop);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const r = canvas.getBoundingClientRect();
      mouse.tx = (e.clientX - r.left) / r.width;
      mouse.ty = 1 - (e.clientY - r.top) / r.height;
      mouse.ton = 1;
    };
    const onLeave = () => {
      mouse.ton = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      kick();
    });
    io.observe(canvas);
    document.addEventListener('visibilitychange', kick);
    host.addEventListener('pointermove', onMove);
    host.addEventListener('pointerleave', onLeave);
    resize();
    kick();

    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', kick);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
