"use client";

import { useEffect, useRef } from "react";

type Flake = {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  sway: number;
  freq: number;
  phase: number;
  sparkle: boolean;
};

function makeFlake(width: number, height: number, sparkle = false): Flake {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    size: sparkle ? 3 + Math.random() * 3 : 2 + Math.random() * 4,
    speed: sparkle ? 0.22 + Math.random() * 0.28 : 0.28 + Math.random() * 0.55,
    opacity: 0.35 + Math.random() * 0.5,
    sway: 0.25 + Math.random() * 0.55,
    freq: 0.6 + Math.random() * 0.9,
    phase: Math.random() * Math.PI * 2,
    sparkle,
  };
}

export function Snow() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let flakes: Flake[] = [];
    let frame = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = Math.floor(width * dpr);
      canvas!.height = Math.floor(height * dpr);
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(90, Math.max(42, width / 14)));
      flakes = Array.from({ length: count }, (_, index) => makeFlake(width, height, index % 9 === 0));
    }

    function drawSparkle(x: number, y: number, radius: number) {
      ctx!.save();
      ctx!.translate(x, y);
      ctx!.beginPath();
      for (let i = 0; i < 4; i += 1) {
        ctx!.rotate(Math.PI / 2);
        ctx!.lineTo(0, radius);
        ctx!.lineTo(radius * 0.32, radius * 0.32);
      }
      ctx!.closePath();
      ctx!.fill();
      ctx!.restore();
    }

    function tick(time: number) {
      ctx!.clearRect(0, 0, width, height);
      ctx!.fillStyle = "#ffffff";
      for (const flake of flakes) {
        flake.y += flake.speed;
        flake.x += Math.sin(time / 1000 * flake.freq + flake.phase) * flake.sway;
        if (flake.y > height + 8) {
          flake.y = -8;
          flake.x = Math.random() * width;
        }
        if (flake.x < -10) flake.x = width + 8;
        if (flake.x > width + 10) flake.x = -8;
        const twinkle = flake.sparkle ? 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(time / 320 + flake.phase)) : 1;
        ctx!.globalAlpha = Math.min(0.85, flake.opacity * twinkle);
        if (flake.sparkle) drawSparkle(flake.x, flake.y, flake.size);
        else {
          ctx!.beginPath();
          ctx!.arc(flake.x, flake.y, flake.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        }
      }
      ctx!.globalAlpha = 1;
      frame = window.requestAnimationFrame(tick);
    }

    resize();
    frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", resize);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="snow-canvas" aria-hidden="true" />;
}
