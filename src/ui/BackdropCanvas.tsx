import { useEffect, useRef } from 'react';
import type { Theme } from '../themes/types';

interface BackdropCanvasProps {
  theme: Theme;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

export function BackdropCanvas({ theme }: BackdropCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const draw = () => {
      const ratio = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(window.innerWidth * ratio);
      canvas.height = Math.round(window.innerHeight * ratio);
      const context = canvas.getContext('2d');
      if (!context) return;
      context.scale(ratio, ratio);
      const width = window.innerWidth;
      const height = window.innerHeight;
      context.clearRect(0, 0, width, height);
      const random = randomGenerator(theme.id === 'observatory' ? 11 : theme.id === 'almanac' ? 29 : 47);

      if (theme.backdrop === 'stars') {
        const stars = Array.from({ length: 190 }, () => ({
          x: random() * width,
          y: random() * height,
          radius: 0.35 + random() * 1.25,
          alpha: 0.18 + random() * 0.62,
        }));
        for (const star of stars) {
          context.fillStyle = `rgba(236, 226, 196, ${star.alpha})`;
          context.beginPath();
          context.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
          context.fill();
        }
        context.strokeStyle = 'rgba(216, 185, 106, 0.13)';
        context.lineWidth = 0.65;
        for (let index = 0; index < 28; index += 4) {
          const first = stars[index];
          const second = stars[index + 1];
          const third = stars[index + 2];
          if (!first || !second || !third) continue;
          context.beginPath();
          context.moveTo(first.x, first.y);
          context.lineTo(second.x, second.y);
          context.lineTo(third.x, third.y);
          context.stroke();
        }
      } else if (theme.backdrop === 'print') {
        context.strokeStyle = 'rgba(24, 28, 27, 0.055)';
        context.lineWidth = 1;
        for (let x = 24; x < width; x += 48) {
          context.beginPath();
          context.moveTo(x, 0);
          context.lineTo(x, height);
          context.stroke();
        }
        for (let y = 24; y < height; y += 48) {
          context.beginPath();
          context.moveTo(0, y);
          context.lineTo(width, y);
          context.stroke();
        }
      } else {
        for (let index = 0; index < 10_000; index += 1) {
          const alpha = 0.018 + random() * 0.025;
          context.fillStyle = `rgba(23, 63, 58, ${alpha})`;
          context.fillRect(random() * width, random() * height, 0.7, 0.7);
        }
        context.strokeStyle = 'rgba(23, 63, 58, 0.055)';
        for (let y = 18; y < height; y += 26) {
          context.beginPath();
          context.moveTo(0, y + random() * 2);
          context.lineTo(width, y + random() * 2);
          context.stroke();
        }
      }
    };

    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, [theme]);

  return <canvas aria-hidden="true" className="backdrop-canvas" ref={ref} />;
}