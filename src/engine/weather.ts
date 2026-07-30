/**
 * Canvas weather and atmosphere particles.
 *
 * Painted backgrounds are static, so the particle pass is what makes a scene
 * feel alive. Each preset is tuned to sit *behind* the eye rather than draw
 * attention: low alpha, motion blur on the fast layers, and a parallax split
 * so near particles move noticeably faster than far ones.
 */

export type WeatherKind = 'none' | 'rain' | 'heavy-rain' | 'snow' | 'dust' | 'embers' | 'fog';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  size: number;
  alpha: number;
  /** 0 = far, 1 = near. Drives speed, size and opacity together. */
  depth: number;
  /** Phase offset for drifting presets. */
  phase: number;
}

interface Preset {
  count: number;
  make(w: number, h: number): Particle;
  draw(ctx: CanvasRenderingContext2D, p: Particle): void;
  step(p: Particle, w: number, h: number, t: number): void;
  /** Extra full-canvas pass, e.g. fog banks or a lightning flash. */
  overlay?(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void;
  composite?: GlobalCompositeOperation;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function rainPreset(intensity: number): Preset {
  return {
    count: Math.round(340 * intensity),
    make(w, h) {
      const depth = Math.random();
      return {
        x: rand(-0.1 * w, 1.1 * w),
        y: rand(-h, h),
        vx: rand(-0.6, -0.2) * (1 + depth) * intensity,
        vy: rand(9, 15) * (0.45 + depth) * intensity,
        len: rand(10, 26) * (0.4 + depth),
        size: rand(0.6, 1.4) * (0.5 + depth),
        alpha: rand(0.06, 0.22) * (0.35 + depth),
        depth,
        phase: 0,
      };
    },
    step(p, w, h) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > h + 20) {
        p.y = rand(-60, -10);
        p.x = rand(-0.1 * w, 1.1 * w);
      }
      if (p.x < -0.15 * w) p.x = 1.1 * w;
    },
    draw(ctx, p) {
      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = '#cfe0ea';
      ctx.lineWidth = p.size;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 1.6, p.y - p.len);
      ctx.stroke();
    },
  };
}

const PRESETS: Record<Exclude<WeatherKind, 'none'>, Preset> = {
  rain: rainPreset(1),
  'heavy-rain': {
    ...rainPreset(1.7),
    // A storm reads as a storm because of the light, not the droplet count.
    overlay(ctx, w, h, t) {
      const strike = Math.sin(t * 0.0011) + Math.sin(t * 0.00037);
      if (strike > 1.93) {
        ctx.globalAlpha = (strike - 1.93) * 2.2;
        ctx.fillStyle = '#b9d4e8';
        ctx.fillRect(0, 0, w, h);
      }
    },
  },
  snow: {
    count: 260,
    make(w, h) {
      const depth = Math.random();
      return {
        x: rand(0, w),
        y: rand(-h, h),
        vx: 0,
        vy: rand(0.5, 1.4) * (0.4 + depth),
        len: 0,
        size: rand(1, 3.4) * (0.4 + depth),
        alpha: rand(0.18, 0.55) * (0.4 + depth),
        depth,
        phase: rand(0, Math.PI * 2),
      };
    },
    step(p, w, h, t) {
      p.y += p.vy;
      p.x += Math.sin(t * 0.0006 + p.phase) * (0.5 + p.depth);
      if (p.y > h + 8) {
        p.y = -8;
        p.x = rand(0, w);
      }
    },
    draw(ctx, p) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#eef4f8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  dust: {
    count: 130,
    composite: 'screen',
    make(w, h) {
      const depth = Math.random();
      return {
        x: rand(0, w),
        y: rand(0, h),
        vx: rand(-0.14, 0.14),
        vy: rand(-0.16, -0.02),
        len: 0,
        size: rand(0.7, 2.3) * (0.4 + depth),
        alpha: rand(0.05, 0.3) * (0.3 + depth),
        depth,
        phase: rand(0, Math.PI * 2),
      };
    },
    step(p, w, h, t) {
      p.x += p.vx + Math.sin(t * 0.0004 + p.phase) * 0.16;
      p.y += p.vy;
      if (p.y < -8) {
        p.y = h + 8;
        p.x = rand(0, w);
      }
    },
    draw(ctx, p) {
      // Warm motes read as sunlight catching dust rather than as snow.
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = '#ffe9c2';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  embers: {
    count: 90,
    composite: 'screen',
    make(w, h) {
      const depth = Math.random();
      return {
        x: rand(0, w),
        y: rand(h * 0.4, h + 40),
        vx: rand(-0.25, 0.25),
        vy: rand(-1.5, -0.4) * (0.4 + depth),
        len: 0,
        size: rand(0.8, 2.2) * (0.4 + depth),
        alpha: rand(0.25, 0.8),
        depth,
        phase: rand(0, Math.PI * 2),
      };
    },
    step(p, w, h, t) {
      p.x += p.vx + Math.sin(t * 0.001 + p.phase) * 0.3;
      p.y += p.vy;
      p.alpha *= 0.995;
      if (p.y < h * 0.15 || p.alpha < 0.03) {
        p.y = h + rand(0, 40);
        p.x = rand(0, w);
        p.alpha = rand(0.25, 0.8);
      }
    },
    draw(ctx, p) {
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      g.addColorStop(0, `rgba(255,196,110,${p.alpha})`);
      g.addColorStop(1, 'rgba(255,120,30,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fill();
    },
  },
  fog: {
    count: 0,
    make: () => ({ x: 0, y: 0, vx: 0, vy: 0, len: 0, size: 0, alpha: 0, depth: 0, phase: 0 }),
    step: () => {},
    draw: () => {},
    // Three offset gradient bands drifting at different rates read as depth.
    overlay(ctx, w, h, t) {
      for (let i = 0; i < 3; i++) {
        const y = h * (0.55 + i * 0.14) + Math.sin(t * 0.0002 + i) * h * 0.02;
        const x = ((t * (0.006 + i * 0.004)) % (w * 2)) - w * 0.5;
        const g = ctx.createRadialGradient(x, y, 0, x, y, w * 0.6);
        g.addColorStop(0, `rgba(190,205,215,${0.1 - i * 0.02})`);
        g.addColorStop(1, 'rgba(190,205,215,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }
    },
  },
};

export class Weather {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private preset: Preset | null = null;
  private raf = 0;
  private ro: ResizeObserver;
  private reduced = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true })!;
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
  }

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    // Cap DPR: particles are soft, and 3x costs far more than it shows.
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(r.width * dpr);
    this.canvas.height = Math.round(r.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.preset) this.seed();
  }

  set(kind: WeatherKind) {
    cancelAnimationFrame(this.raf);
    if (kind === 'none') {
      this.preset = null;
      this.particles = [];
      this.clear();
      return;
    }
    this.preset = PRESETS[kind];
    this.seed();
    this.loop(0);
  }

  private seed() {
    if (!this.preset) return;
    const { width: w, height: h } = this.canvas.getBoundingClientRect();
    // Honour reduced-motion by thinning the field rather than killing weather
    // outright — the scene should still feel like it has air in it.
    const n = Math.round(this.preset.count * (this.reduced ? 0.25 : 1));
    this.particles = Array.from({ length: n }, () => this.preset!.make(w, h));
  }

  private clear() {
    const { width, height } = this.canvas;
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.restore();
  }

  private loop = (t: number) => {
    if (!this.preset) return;
    const { width: w, height: h } = this.canvas.getBoundingClientRect();
    this.clear();
    const ctx = this.ctx;
    ctx.globalCompositeOperation = this.preset.composite ?? 'source-over';

    const speed = this.reduced ? 0.4 : 1;
    for (const p of this.particles) {
      this.preset.step(p, w, h, t * speed);
      this.preset.draw(ctx, p);
    }
    this.preset.overlay?.(ctx, w, h, t * speed);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.raf = requestAnimationFrame(this.loop);
  };

  destroy() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
  }
}
