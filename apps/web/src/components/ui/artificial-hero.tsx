'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useTheme } from 'next-themes';

type Vec2 = { x: number; y: number };

interface AnimationParams {
  rotation: number;
  atmosphereShift: number;
  glitchIntensity: number;
  glitchFrequency: number;
}

interface SceneRef {
  ctx: CanvasRenderingContext2D | null;
  grainCtx: CanvasRenderingContext2D | null;
  size: Vec2;
  frame: number;
  time: number;
  visible: boolean;
}

interface Props {
  className?: string;
  /** Whether to animate the cosmic glitch effect. Default: true. */
  glitch?: boolean;
}

/**
 * Animated cosmic background: rotating ASCII sphere + film grain over a hue-shifting
 * Arkangeles-blue nebula. Adapts to the active light/dark theme.
 */
export function ArtificialHeroBackground({ className = '', glitch = true }: Props) {
  const { resolvedTheme } = useTheme();
  const isLight = resolvedTheme === 'light';
  const themeRef = useRef(isLight);
  themeRef.current = isLight;

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const grainCanvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneRef>({
    ctx: null,
    grainCtx: null,
    size: { x: 0, y: 0 },
    frame: 0,
    time: 0,
    visible: true,
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const grainCanvas = grainCanvasRef.current;
    if (!container || !canvas || !grainCanvas) return;

    const ctx = canvas.getContext('2d');
    const grainCtx = grainCanvas.getContext('2d');
    if (!ctx || !grainCtx) return;

    sceneRef.current.ctx = ctx;
    sceneRef.current.grainCtx = grainCtx;

    const density = ' .:-=+*#%@';
    const params: AnimationParams = {
      rotation: 0,
      atmosphereShift: 0,
      glitchIntensity: 0,
      glitchFrequency: 0,
    };

    const tweens = [
      gsap.to(params, {
        rotation: Math.PI * 2,
        duration: 20,
        repeat: -1,
        ease: 'none',
      }),
      gsap.to(params, {
        atmosphereShift: 1,
        duration: 6,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      }),
    ];

    if (glitch) {
      tweens.push(
        gsap.to(params, {
          glitchIntensity: 1,
          duration: 0.1,
          repeat: -1,
          yoyo: true,
          ease: 'power2.inOut',
          repeatDelay: Math.random() * 3 + 1,
        }),
        gsap.to(params, {
          glitchFrequency: 1,
          duration: 0.05,
          repeat: -1,
          yoyo: true,
          ease: 'none',
        }),
      );
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.floor(rect.width * dpr);
      const h = Math.floor(rect.height * dpr);
      canvas.width = grainCanvas.width = w;
      canvas.height = grainCanvas.height = h;
      canvas.style.width = grainCanvas.style.width = `${rect.width}px`;
      canvas.style.height = grainCanvas.style.height = `${rect.height}px`;
      sceneRef.current.size = { x: w, y: h };
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) sceneRef.current.visible = entry.isIntersecting;
      },
      { threshold: 0.01 },
    );
    io.observe(container);

    const generateFilmGrain = (
      width: number,
      height: number,
      intensity: number,
      lightMode: boolean,
    ) => {
      const imageData = grainCtx.createImageData(width, height);
      const data = imageData.data;
      // In light mode the grain shifts the texture toward darker speckles on a
      // light backdrop; in dark mode it keeps the original behavior.
      const base = lightMode ? 64 : 128;
      for (let i = 0; i < data.length; i += 4) {
        const grain = (Math.random() - 0.5) * intensity * 255;
        const v = Math.max(0, Math.min(255, base + grain));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
        data[i + 3] = Math.abs(grain) * (lightMode ? 1.4 : 3);
      }
      return imageData;
    };

    const drawGlitchedOrb = (
      centerX: number,
      centerY: number,
      radius: number,
      hue: number,
      glitchIntensity: number,
      lightMode: boolean,
    ) => {
      ctx.save();
      const shouldGlitch = glitch && Math.random() < 0.1 && glitchIntensity > 0.5;
      const glitchOffset = shouldGlitch ? (Math.random() - 0.5) * 20 * glitchIntensity : 0;
      const glitchScale = shouldGlitch ? 1 + (Math.random() - 0.5) * 0.3 * glitchIntensity : 1;

      if (shouldGlitch) {
        ctx.translate(glitchOffset, glitchOffset * 0.8);
        ctx.scale(glitchScale, 1 / glitchScale);
      }

      const orbGradient = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        radius * 1.5,
      );
      // Light mode: deeper, less luminous so it pops on a white canvas.
      // Dark mode: bright glow on black.
      if (lightMode) {
        orbGradient.addColorStop(0, `hsla(${hue}, 90%, 70%, 0.55)`);
        orbGradient.addColorStop(0.25, `hsla(${hue}, 85%, 55%, 0.4)`);
        orbGradient.addColorStop(0.55, `hsla(${hue + 10}, 70%, 45%, 0.22)`);
        orbGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      } else {
        orbGradient.addColorStop(0, `hsla(${hue}, 95%, 75%, 0.85)`);
        orbGradient.addColorStop(0.2, `hsla(${hue + 5}, 90%, 65%, 0.6)`);
        orbGradient.addColorStop(0.5, `hsla(${hue}, 80%, 45%, 0.4)`);
        orbGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      }
      ctx.fillStyle = orbGradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerRadius = radius * 0.3;
      ctx.fillStyle = lightMode ? `hsla(${hue}, 85%, 55%, 0.55)` : `hsla(${hue}, 100%, 85%, 0.85)`;
      ctx.beginPath();
      ctx.arc(centerX, centerY, centerRadius, 0, Math.PI * 2);
      ctx.fill();

      if (shouldGlitch) {
        ctx.globalCompositeOperation = lightMode ? 'multiply' : 'screen';
        ctx.fillStyle = `hsla(${hue + 10}, 100%, 50%, ${0.55 * glitchIntensity})`;
        ctx.beginPath();
        ctx.arc(centerX + glitchOffset * 0.5, centerY, centerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${hue - 20}, 100%, 50%, ${0.5 * glitchIntensity})`;
        ctx.beginPath();
        ctx.arc(centerX - glitchOffset * 0.5, centerY, centerRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        ctx.strokeStyle = lightMode
          ? `rgba(20, 30, 60, ${0.5 * glitchIntensity})`
          : `rgba(255, 255, 255, ${0.6 * glitchIntensity})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const y = centerY - radius + Math.random() * radius * 2;
          const startX = centerX - radius + Math.random() * 20;
          const endX = centerX + radius - Math.random() * 20;
          ctx.beginPath();
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
        }

        ctx.fillStyle = `hsla(${hue + 30}, 100%, 60%, ${0.4 * glitchIntensity})`;
        for (let i = 0; i < 3; i++) {
          const blockX = centerX - radius + Math.random() * radius * 2;
          const blockY = centerY - radius + Math.random() * radius * 2;
          const blockSize = Math.random() * 10 + 2;
          ctx.fillRect(blockX, blockY, blockSize, blockSize);
        }
      }

      ctx.strokeStyle = lightMode
        ? `hsla(${hue}, 70%, 45%, 0.45)`
        : `hsla(${hue + 10}, 80%, 70%, 0.55)`;
      ctx.lineWidth = 2;
      if (shouldGlitch) {
        const segments = 8;
        for (let i = 0; i < segments; i++) {
          const startAngle = (i / segments) * Math.PI * 2;
          const endAngle = ((i + 1) / segments) * Math.PI * 2;
          const ringRadius = radius * 1.2 + (Math.random() - 0.5) * 10 * glitchIntensity;
          ctx.beginPath();
          ctx.arc(centerX, centerY, ringRadius, startAngle, endAngle);
          ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (shouldGlitch && Math.random() < 0.3) {
        ctx.globalCompositeOperation = 'difference';
        ctx.fillStyle = `rgba(${lightMode ? '0, 0, 0' : '255, 255, 255'}, ${0.7 * glitchIntensity})`;
        for (let i = 0; i < 3; i++) {
          const barY = centerY - radius + Math.random() * radius * 2;
          const barHeight = Math.random() * 5 + 1;
          ctx.fillRect(centerX - radius, barY, radius * 2, barHeight);
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.restore();
    };

    const render = () => {
      const scene = sceneRef.current;
      const lightMode = themeRef.current;
      if (!scene.visible) {
        scene.frame = requestAnimationFrame(render);
        return;
      }
      scene.time += 0.016;

      const width = canvas.width;
      const height = canvas.height;

      // Clear with the right base color for the active theme.
      if (lightMode) {
        // Match --bg-canvas for light theme (220 20% 98%).
        ctx.fillStyle = '#f7f9fb';
      } else {
        ctx.fillStyle = '#000';
      }
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.2;

      // Arkangeles brand: hue 220 = electric blue. Atmosphere shift sweeps
      // a small range so it stays unmistakably blue.
      const hue = 218 + params.atmosphereShift * 18;

      const bgGradient = ctx.createRadialGradient(
        centerX,
        centerY - 50,
        0,
        centerX,
        centerY,
        Math.max(width, height) * 0.8,
      );
      if (lightMode) {
        bgGradient.addColorStop(0, `hsla(${hue}, 85%, 70%, 0.18)`);
        bgGradient.addColorStop(0.35, `hsla(${hue + 10}, 75%, 60%, 0.12)`);
        bgGradient.addColorStop(0.7, `hsla(${hue - 10}, 60%, 75%, 0.06)`);
        bgGradient.addColorStop(1, 'rgba(247, 249, 251, 0)');
      } else {
        bgGradient.addColorStop(0, `hsla(${hue + 5}, 85%, 55%, 0.45)`);
        bgGradient.addColorStop(0.3, `hsla(${hue}, 75%, 35%, 0.32)`);
        bgGradient.addColorStop(0.6, `hsla(${hue - 15}, 55%, 18%, 0.2)`);
        bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.95)');
      }
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, width, height);

      drawGlitchedOrb(centerX, centerY, radius, hue, params.glitchIntensity, lightMode);

      // ASCII sphere — particle ink swaps with theme.
      ctx.font = '10px "JetBrains Mono", "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const spacing = 9;
      const cols = Math.min(150, Math.floor(width / spacing));
      const rows = Math.min(100, Math.floor(height / spacing));

      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const x = (i - cols / 2) * spacing + centerX;
          const y = (j - rows / 2) * spacing + centerY;
          const dx = x - centerX;
          const dy = y - centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist >= radius || Math.random() <= 0.4) continue;
          const z = Math.sqrt(Math.max(0, radius * radius - dx * dx - dy * dy));
          const angle = params.rotation;
          const rotZ = dx * Math.sin(angle) + z * Math.cos(angle);
          if (rotZ <= -radius * 0.3) continue;
          const brightness = (rotZ + radius) / (radius * 2);
          const charIndex = Math.floor(brightness * (density.length - 1));
          let char = density[charIndex] ?? ' ';
          if (
            glitch &&
            dist < radius * 0.8 &&
            params.glitchIntensity > 0.8 &&
            Math.random() < 0.3
          ) {
            const glitchChars = ['█', '▓', '▒', '░', '▄', '▀', '■', '□'];
            char = glitchChars[Math.floor(Math.random() * glitchChars.length)] ?? char;
          }
          const alpha = Math.max(0.2, brightness);
          // In light mode, ink is brand-blue tinted dark text; in dark mode it's white.
          ctx.fillStyle = lightMode
            ? `rgba(15, 34, 102, ${Math.min(0.85, alpha)})`
            : `rgba(255, 255, 255, ${alpha})`;
          ctx.fillText(char, x, y);
        }
      }

      // Film grain
      grainCtx.clearRect(0, 0, width, height);
      const grainIntensity = 0.18 + Math.sin(scene.time * 10) * 0.03;
      const grainImageData = generateFilmGrain(width, height, grainIntensity, lightMode);
      grainCtx.putImageData(grainImageData, 0, 0);

      const sparkColor = lightMode ? 'rgba(15, 34, 102,' : 'rgba(255, 255, 255,';
      const dustColor = lightMode ? 'rgba(255, 255, 255,' : 'rgba(0, 0, 0,';

      if (glitch && params.glitchIntensity > 0.5) {
        grainCtx.globalCompositeOperation = lightMode ? 'multiply' : 'screen';
        for (let i = 0; i < 200; i++) {
          const x = Math.random() * width;
          const y = Math.random() * height;
          const size = Math.random() * 3 + 0.5;
          const opacity = Math.random() * 0.5 * params.glitchIntensity;
          grainCtx.fillStyle = `${sparkColor} ${opacity})`;
          grainCtx.beginPath();
          grainCtx.arc(x, y, size, 0, Math.PI * 2);
          grainCtx.fill();
        }
      }

      grainCtx.globalCompositeOperation = lightMode ? 'multiply' : 'screen';
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 2 + 0.5;
        const opacity = Math.random() * 0.3;
        grainCtx.fillStyle = `${sparkColor} ${opacity})`;
        grainCtx.beginPath();
        grainCtx.arc(x, y, size, 0, Math.PI * 2);
        grainCtx.fill();
      }

      grainCtx.globalCompositeOperation = lightMode ? 'screen' : 'multiply';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const size = Math.random() * 1.5 + 0.5;
        const opacity = Math.random() * 0.5 + 0.3;
        grainCtx.fillStyle = `${dustColor} ${opacity})`;
        grainCtx.beginPath();
        grainCtx.arc(x, y, size, 0, Math.PI * 2);
        grainCtx.fill();
      }
      grainCtx.globalCompositeOperation = 'source-over';

      scene.frame = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(sceneRef.current.frame);
      ro.disconnect();
      io.disconnect();
      tweens.forEach((t) => t.kill());
    };
  }, [glitch]);

  // Background color of the wrapper matches the theme so it doesn't flash black
  // before the first frame is drawn.
  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 overflow-hidden ${
        isLight ? 'bg-canvas' : 'bg-black'
      } ${className}`}
      aria-hidden
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <canvas
        ref={grainCanvasRef}
        className="absolute inset-0 h-full w-full"
        style={{
          mixBlendMode: isLight ? 'multiply' : 'overlay',
          opacity: isLight ? 0.45 : 0.6,
        }}
      />
    </div>
  );
}
