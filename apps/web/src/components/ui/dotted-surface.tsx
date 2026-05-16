'use client';

import { cn } from '@hack/ui';
import { useTheme } from 'next-themes';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

type DottedSurfaceProps = Omit<React.ComponentProps<'div'>, 'ref'> & {
  /**
   * Force a dot color regardless of the active theme. Pass `'light'` when
   * the surface sits over a dark backdrop (e.g. our welcome splash, which
   * uses a fixed black bg) so dots stay visible. Default: follow `theme`.
   */
  forceDotColor?: 'light' | 'dark';
};

/**
 * Three.js powered grid of dots that ripple via two superimposed sine waves.
 * Adapted for this repo (cn from @hack/ui instead of @/lib/utils).
 *
 * Default positioning is `fixed inset-0 -z-1` — when mounting inside a
 * portal/overlay you may want to override via the `className` prop (e.g.
 * `absolute inset-0 z-0`) to stay scoped to that stacking context.
 */
export function DottedSurface({ className, forceDotColor, ...props }: DottedSurfaceProps) {
  const { theme } = useTheme();
  // If forced, use that. Otherwise follow the theme. Default to 'light' dots
  // on the first paint (before next-themes hydrates) so we never get the
  // invisible "black-on-black" failure mode.
  const dotColor = forceDotColor ?? (theme === 'light' ? 'dark' : 'light');

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    particles: THREE.Points[];
    animationId: number;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const SEPARATION = 150;
    const AMOUNTX = 40;
    const AMOUNTY = 60;

    // Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xffffff, 2000, 10000);

    const camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      1,
      10000,
    );
    camera.position.set(0, 355, 1220);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(scene.fog.color, 0);

    containerRef.current.appendChild(renderer.domElement);

    // Create particles
    const positions: number[] = [];
    const colors: number[] = [];

    // Create geometry for all particles
    const geometry = new THREE.BufferGeometry();

    for (let ix = 0; ix < AMOUNTX; ix++) {
      for (let iy = 0; iy < AMOUNTY; iy++) {
        const x = ix * SEPARATION - (AMOUNTX * SEPARATION) / 2;
        const y = 0; // Will be animated
        const z = iy * SEPARATION - (AMOUNTY * SEPARATION) / 2;

        positions.push(x, y, z);
        if (dotColor === 'light') {
          colors.push(220, 220, 220);
        } else {
          colors.push(0, 0, 0);
        }
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let count = 0;
    let animationId = 0;
    // Stop flag closed over by animate(). Necessary because dev StrictMode
    // runs the effect twice; without it the first closure's loop could leak
    // and the visible (second) loop would still appear to run but compete
    // for the WebGL context.
    let stopped = false;

    const animate = () => {
      if (stopped) return;
      animationId = requestAnimationFrame(animate);

      // Non-null: we just set `position` on the geometry above.
      const positionAttribute = geometry.attributes.position!;
      const positionsArr = positionAttribute.array as Float32Array;

      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const index = i * 3;
          // Amplitudes bumped 50 → 120 and increment 0.1 → 0.3 so the wave
          // motion is unmistakably visible at the camera distance we use
          // (z=1220). Without this the displacement reads as static at
          // viewport scale.
          positionsArr[index + 1] =
            Math.sin((ix + count) * 0.3) * 120 + Math.sin((iy + count) * 0.5) * 120;
          i++;
        }
      }

      positionAttribute.needsUpdate = true;
      renderer.render(scene, camera);
      count += 0.3;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handleResize);

    animate();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      particles: [points],
      animationId,
      count,
    };

    return () => {
      // Halt the loop BOTH ways: the flag stops the next-scheduled callback
      // from doing any work, and cancelAnimationFrame cancels the one
      // currently pending. Either alone would race in dev (StrictMode runs
      // effects twice) and leak frames.
      stopped = true;
      cancelAnimationFrame(animationId);

      window.removeEventListener('resize', handleResize);

      if (sceneRef.current) {
        sceneRef.current.scene.traverse((object) => {
          if (object instanceof THREE.Points) {
            object.geometry.dispose();
            if (Array.isArray(object.material)) {
              object.material.forEach((material) => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        });

        sceneRef.current.renderer.dispose();

        if (containerRef.current && sceneRef.current.renderer.domElement) {
          containerRef.current.removeChild(sceneRef.current.renderer.domElement);
        }
      }
    };
  }, [dotColor]);

  return (
    <div
      ref={containerRef}
      className={cn('pointer-events-none fixed inset-0 -z-1', className)}
      {...props}
    />
  );
}
