import { useEffect, useRef } from 'react';
import { dateToAngle } from '../geometry/angle';
import { DIAL_SIZE } from '../geometry/layout';
import { polarToScreen } from '../geometry/polar';
import { normalForDate } from '../data/providers/climate';
import type { ClimateSeries } from '../data/schemas';
import { dateFromDayIndex, daysInYear } from '../time/calendar';
import type { DialMode } from '../time/modes';
import type { Theme } from '../themes/types';

interface AmbienceCanvasProps {
  year: number;
  size: number;
  mode: DialMode;
  theme: Theme;
  normals: ClimateSeries;
  reducedMotion: boolean;
  paused: boolean;
}

interface Particle {
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  alpha: number;
  kind: 'snow' | 'petal' | 'shimmer' | 'leaf' | 'mote';
  color: string;
}

function randomGenerator(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 22_695_477) + 1) >>> 0;
    return state / 4_294_967_296;
  };
}

export function AmbienceCanvas({
  year,
  size,
  mode,
  theme,
  normals,
  reducedMotion,
  paused,
}: AmbienceCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || reducedMotion || paused || theme.ambience === null) return;
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * ratio);
    canvas.height = Math.round(size * ratio);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale((size * ratio) / DIAL_SIZE, (size * ratio) / DIAL_SIZE);
    const random = randomGenerator(year * 31 + (mode.id === 'birthday' ? 17 : 3));
    const particleCount = theme.ambience === 'seasonal' ? 108 : 58;
    const yearLength = daysInYear(year);

    const createParticle = (): Particle => {
      const dayIndex = Math.floor(random() * yearLength);
      const date = dateFromDayIndex(year, dayIndex);
      const angle = dateToAngle(date, mode);
      const point = polarToScreen(angle, 155 + random() * 315, DIAL_SIZE / 2, DIAL_SIZE / 2);
      const normal = normalForDate(date, normals);
      const month = date.month;
      const kind = theme.ambience === 'celestial'
        ? 'mote'
        : month <= 2 || month === 12
          ? 'snow'
          : month <= 5
            ? 'petal'
            : month <= 8
              ? 'shimmer'
              : 'leaf';
      const intensity = kind === 'snow'
        ? Math.min(1, normal.precipIn * 11)
        : kind === 'shimmer'
          ? Math.max(0.35, (normal.hiF - 72) / 18)
          : 0.75;
      return {
        x: point.x,
        y: point.y,
        originX: point.x,
        originY: point.y,
        vx: (random() - 0.5) * (kind === 'leaf' ? 0.42 : 0.2),
        vy: kind === 'shimmer' ? -0.08 - random() * 0.12 : 0.08 + random() * 0.28,
        age: random() * 180,
        life: 130 + random() * 160,
        size: 1 + random() * (kind === 'leaf' ? 3.4 : 2.1),
        alpha: (0.18 + random() * 0.46) * intensity,
        kind,
        color:
          kind === 'leaf'
            ? theme.seasons.autumn
            : kind === 'petal'
              ? theme.seasons.spring
              : kind === 'shimmer'
                ? theme.seasons.summer
                : theme.tokens.ink,
      };
    };

    const particles = Array.from({ length: particleCount }, createParticle);
    let frame = 0;
    let animation = 0;
    const draw = () => {
      context.clearRect(0, 0, DIAL_SIZE, DIAL_SIZE);
      for (const particle of particles) {
        particle.age += 1;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.age >= particle.life) {
          const fresh = createParticle();
          Object.assign(particle, fresh, { age: 0 });
        }
        const phase = particle.age / particle.life;
        const fade = Math.min(1, phase * 8, (1 - phase) * 8);
        context.globalAlpha = particle.alpha * Math.max(0, fade);
        context.fillStyle = particle.color;
        context.strokeStyle = particle.color;
        if (particle.kind === 'leaf') {
          context.save();
          context.translate(particle.x, particle.y);
          context.rotate((frame % 180) / 28);
          context.fillRect(-particle.size, -particle.size * 0.35, particle.size * 2, particle.size * 0.7);
          context.restore();
        } else if (particle.kind === 'petal') {
          context.beginPath();
          context.ellipse(particle.x, particle.y, particle.size * 1.4, particle.size * 0.65, 0.5, 0, Math.PI * 2);
          context.fill();
        } else if (particle.kind === 'shimmer') {
          context.lineWidth = 0.8;
          context.beginPath();
          context.moveTo(particle.x, particle.y - particle.size * 2);
          context.lineTo(particle.x, particle.y + particle.size * 2);
          context.stroke();
        } else {
          context.beginPath();
          context.arc(particle.x, particle.y, particle.size * 0.55, 0, Math.PI * 2);
          context.fill();
        }
      }
      context.globalAlpha = 1;
      frame += 1;
      animation = requestAnimationFrame(draw);
    };
    animation = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animation);
  }, [mode, normals, paused, reducedMotion, size, theme, year]);

  return <canvas aria-hidden="true" className="ambience-canvas" ref={ref} />;
}