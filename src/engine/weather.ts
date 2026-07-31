/**
 * Canvas weather and atmosphere particles.
 *
 * Painted backgrounds are static, so the particle pass is what makes a scene
 * feel alive. Each preset is tuned to sit *behind* the eye rather than draw
 * attention: low alpha, motion blur on the fast layers, and a parallax split
 * so near particles move noticeably faster than far ones.
 */

export type WeatherKind =
  | 'none'
  | 'rain'
  /** The near curtain: fewer, longer, faster drops for a second parallax layer. */
  | 'rain-near'
  | 'heavy-rain'
  | 'snow'
  | 'dust'
  | 'embers'
  | 'fog';

/**
 * A normalised polygon (0..1 of the stage) that weather is allowed to occupy.
 *
 * Interiors need this: a scene shot from inside a cabin has exactly one place
 * the sky can be seen, and rain that falls across the bulkhead behind the
 * camera is not weather, it is a broken layer. With an aperture set, the falling
 * field is clipped to the glass and a second, different pass — beading and
 * runnels *on* the pane — takes over as the thing the player actually reads as
 * "it is filthy out there".
 */
export type Aperture = readonly (readonly [number, number])[];

/** A slow interior leak: one drop every `everyMs`, not a curtain. */
export interface Drip {
  x: number;
  y: number;
  /** Fall distance, normalised to stage height. */
  fall: number;
  everyMs: number;
}

/** Water sitting on the glass rather than falling past it. */
interface GlassBit {
  x: number;
  y: number;
  r: number;
  /** Runnels only: how far this bead has already crawled, and how fast. */
  vy: number;
  tail: number;
  alpha: number;
}

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

/** Normalised bounding box of an aperture: `[x0, y0, x1, y1]`. */
function bounds(a: Aperture): [number, number, number, number] {
  const xs = a.map((p) => p[0]);
  const ys = a.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

/**
 * The streak sprite.
 *
 * A rain streak drawn with `ctx.stroke()` is a capsule of flat alpha with two
 * square ends — at any magnification that is a tally mark, not water. Real
 * falling rain is a motion blur: it has no head and no tail, only a peak of
 * density somewhere along its length that fades to nothing at both ends.
 *
 * That needs a gradient per drop, and building one per particle per frame is
 * hundreds of allocations a frame on the one screen already painting weather.
 * So the taper is baked once into an offscreen strip and stamped with
 * `drawImage`, which also gives the ends free antialiasing.
 */
let streakSprite: HTMLCanvasElement | null = null;
const SPRITE_H = 96;
const SPRITE_W = 8;

function streak(): HTMLCanvasElement {
  if (streakSprite) return streakSprite;
  const c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, SPRITE_H);
  grad.addColorStop(0, 'rgba(207,224,234,0)');
  grad.addColorStop(0.38, 'rgba(207,224,234,0.55)');
  grad.addColorStop(0.74, 'rgba(224,238,246,1)');
  grad.addColorStop(1, 'rgba(224,238,246,0)');
  g.fillStyle = grad;
  // Slightly lozenge-shaped rather than a bar, so the streak thins at the ends
  // in width as well as in alpha.
  g.beginPath();
  g.moveTo(SPRITE_W / 2, 0);
  g.lineTo(SPRITE_W, SPRITE_H * 0.55);
  g.lineTo(SPRITE_W / 2, SPRITE_H);
  g.lineTo(0, SPRITE_H * 0.55);
  g.closePath();
  g.fill();
  streakSprite = c;
  return c;
}

/**
 * Falling water.
 *
 * @param intensity  Scales count and fall speed.
 * @param near       0 = the far curtain, 1 = the near one. Drives length, width
 *                   and brightness together, so two instances at different
 *                   values read as depth rather than as two identical sheets.
 *
 * The wind is shared, not per-drop: rain in a gale rakes 15-25 degrees off
 * vertical and every drop in the frame rakes the *same* way, with only a few
 * degrees of jitter. The old preset had 1.5-4 degrees, which is dead vertical
 * on a screen whose surf and cloud are visibly being torn sideways.
 */
const WIND_TAN = 0.3; /* ~17 degrees off vertical */

function rainPreset(intensity: number, near = 0): Preset {
  return {
    count: Math.round((760 - near * 320) * intensity),
    make(w, h) {
      const depth = Math.random() * (1 - near * 0.45) + near * 0.55;
      const vy = rand(9, 15) * (0.45 + depth) * intensity;
      return {
        x: rand(-0.2 * w, 1.2 * w),
        y: rand(-h, h),
        vx: -vy * (WIND_TAN + rand(-0.06, 0.06)),
        vy,
        len: rand(11, 30) * (0.4 + depth) * (1 + near * 0.9),
        size: rand(0.7, 1.5) * (0.5 + depth) * (1 + near * 0.7),
        // Low enough that no single drop is a countable object: the curtain has
        // to read as density, which is what raising the count buys.
        alpha: rand(0.04, 0.15) * (0.35 + depth) * (1 + near * 0.55),
        depth,
        phase: 0,
      };
    },
    step(p, w, h) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.y > h + 20) {
        p.y = rand(-60, -10);
        p.x = rand(-0.2 * w, 1.2 * w);
      }
      if (p.x < -0.25 * w) p.x = 1.2 * w;
    },
    draw(ctx, p) {
      const sprite = streak();
      // Along-axis length, so a raked drop is not foreshortened.
      const run = Math.hypot(p.vx, p.vy);
      const len = p.len + run * 0.9;
      ctx.globalAlpha = p.alpha;
      ctx.save();
      ctx.translate(p.x, p.y);
      // The streak lies along its own velocity: no separate wind angle to keep
      // in sync, and a drop can never point somewhere it is not going.
      ctx.rotate(Math.atan2(-p.vx, p.vy));
      ctx.drawImage(sprite, -p.size / 2, -len, p.size, len);
      ctx.restore();
    },
  };
}

const PRESETS: Record<Exclude<WeatherKind, 'none'>, Preset> = {
  rain: rainPreset(1),
  'rain-near': rainPreset(1.15, 1),
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

/** True when the preset is water falling out of the sky. */
const isWet = (kind: WeatherKind) =>
  kind === 'rain' || kind === 'rain-near' || kind === 'heavy-rain';

export class Weather {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private particles: Particle[] = [];
  private preset: Preset | null = null;
  private kind: WeatherKind = 'none';
  private raf = 0;
  private ro: ResizeObserver;
  private reduced = false;

  /** Set for interiors: weather is confined to this polygon. */
  private aperture: Aperture | null = null;
  private beads: GlassBit[] = [];
  private runnels: GlassBit[] = [];
  private drip: Drip | null = null;

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
    this.kind = kind;
    if (kind === 'none') {
      this.preset = null;
      this.particles = [];
      this.beads = [];
      this.runnels = [];
      this.clear();
      return;
    }
    this.preset = PRESETS[kind];
    this.seed();
    this.loop(0);
  }

  /**
   * Confines the falling field to a window (and switches on the glass pass).
   * Pass `null` for an exterior, where the sky really is the whole frame.
   */
  setAperture(aperture: Aperture | null, drip: Drip | null = null) {
    this.aperture = aperture && aperture.length >= 3 ? aperture : null;
    this.drip = drip;
    this.seedGlass();
  }

  private seed() {
    if (!this.preset) return;
    const { width: w, height: h } = this.canvas.getBoundingClientRect();
    // Honour reduced-motion by thinning the field rather than killing weather
    // outright — the scene should still feel like it has air in it.
    const n = Math.round(this.preset.count * (this.reduced ? 0.25 : 1));
    this.particles = Array.from({ length: n }, () => this.preset!.make(w, h));
    this.seedGlass();
  }

  /**
   * Water on the pane. Beads are effectively static — surface tension holds
   * them until one lets go — and a handful of runnels crawl down, which is the
   * only motion in a real rain-lashed window that the eye actually tracks.
   */
  private seedGlass() {
    if (!this.aperture || !isWet(this.kind)) {
      this.beads = [];
      this.runnels = [];
      return;
    }
    const [x0, y0, x1, y1] = bounds(this.aperture);
    const thin = this.reduced ? 0.4 : 1;
    this.beads = Array.from({ length: Math.round(210 * thin) }, () => ({
      x: rand(x0, x1),
      y: rand(y0, y1),
      r: rand(0.001, 0.0055),
      vy: 0,
      tail: 0,
      alpha: rand(0.14, 0.55),
    }));
    this.runnels = Array.from({ length: Math.round(18 * thin) }, () => ({
      x: rand(x0, x1),
      y: rand(y0, y1),
      r: rand(0.0012, 0.0032),
      vy: rand(0.00022, 0.0011),
      tail: rand(0.012, 0.055),
      alpha: rand(0.16, 0.5),
    }));
  }

  /** Builds the clip path in device-independent pixels. */
  private aperturePath(w: number, h: number): Path2D | null {
    if (!this.aperture) return null;
    const p = new Path2D();
    this.aperture.forEach(([x, y], i) => {
      const px = x * w;
      const py = y * h;
      if (i === 0) p.moveTo(px, py);
      else p.lineTo(px, py);
    });
    p.closePath();
    return p;
  }

  /**
   * The glass pass: beading, a few crawling runnels, and a shallow refracted
   * wash along the bottom of the pane where the water pools on the sill.
   */
  private drawGlass(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const [, , , y1] = bounds(this.aperture!);
    const sill = y1 * h;

    for (const b of this.beads) {
      const x = b.x * w;
      // Beads breathe rather than sit dead still: the hull is moving.
      const y = b.y * h + Math.sin(t * 0.0004 + b.x * 40) * 0.6;
      const r = b.r * h;
      const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x, y, r);
      g.addColorStop(0, `rgba(232,242,248,${b.alpha})`);
      g.addColorStop(0.55, `rgba(158,180,193,${b.alpha * 0.42})`);
      g.addColorStop(1, 'rgba(24,32,38,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const r of this.runnels) {
      r.y += r.vy;
      if (r.y * h > sill + 4) {
        r.y = bounds(this.aperture!)[1];
        r.x = rand(bounds(this.aperture!)[0], bounds(this.aperture!)[2]);
      }
      const x = r.x * w;
      const y = r.y * h;
      const rad = r.r * h;
      const tail = r.tail * h;
      const g = ctx.createLinearGradient(x, y - tail, x, y);
      g.addColorStop(0, 'rgba(206,224,234,0)');
      g.addColorStop(1, `rgba(226,240,247,${r.alpha * 0.55})`);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = g;
      ctx.lineWidth = rad * 1.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y - tail);
      ctx.lineTo(x, y);
      ctx.stroke();
      // The head of a runnel is a fat bead being dragged down.
      const hg = ctx.createRadialGradient(x - rad * 0.3, y - rad * 0.3, 0, x, y, rad * 1.4);
      hg.addColorStop(0, `rgba(238,248,252,${r.alpha})`);
      hg.addColorStop(1, 'rgba(150,175,190,0)');
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(x, y, rad * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Refracted wash where the water gathers on the sill.
    const wash = ctx.createLinearGradient(0, sill - h * 0.05, 0, sill);
    const wobble = 0.06 + Math.sin(t * 0.0007) * 0.02;
    wash.addColorStop(0, 'rgba(200,222,234,0)');
    wash.addColorStop(1, `rgba(200,222,234,${wobble})`);
    ctx.globalAlpha = 1;
    ctx.fillStyle = wash;
    ctx.fillRect(0, sill - h * 0.05, w, h * 0.05);
  }

  /**
   * The one thing that is allowed to fall inside the room: a seam leak. Three
   * drops a minute by default, so it registers as the hull working rather than
   * as weather that has got in.
   */
  private drawDrip(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
    const d = this.drip!;
    const phase = (t % d.everyMs) / d.everyMs;
    // Most of the cycle is the drop swelling at the seam; the fall is quick.
    if (phase < 0.82) {
      const swell = phase / 0.82;
      const r = 0.9 + swell * 2.1;
      ctx.globalAlpha = 0.35 + swell * 0.35;
      ctx.fillStyle = '#cfe0ea';
      ctx.beginPath();
      ctx.arc(d.x * w, d.y * h, r, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const k = (phase - 0.82) / 0.18;
    const y = (d.y + d.fall * k * k) * h;
    ctx.globalAlpha = 0.5 * (1 - k * 0.6);
    ctx.strokeStyle = '#cfe0ea';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(d.x * w, y - 9);
    ctx.lineTo(d.x * w, y);
    ctx.stroke();
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
    // A canvas that has not been laid out yet reports 0x0, which turns every
    // gradient coordinate into NaN. Skip the frame and try again next tick.
    if (w < 1 || h < 1) {
      this.raf = requestAnimationFrame(this.loop);
      return;
    }
    this.clear();
    const ctx = this.ctx;
    ctx.globalCompositeOperation = this.preset.composite ?? 'source-over';

    const speed = this.reduced ? 0.4 : 1;
    const clip = this.aperturePath(w, h);

    if (clip) {
      // Interior: the sky is only visible through one hole in the hull, and
      // what falls past it is seen *through* glass — dimmer and shorter.
      ctx.save();
      ctx.clip(clip);
      for (const p of this.particles) {
        this.preset.step(p, w, h, t * speed);
        const a = p.alpha;
        const len = p.len;
        p.alpha = a * 0.5;
        p.len = len * 0.7;
        this.preset.draw(ctx, p);
        p.alpha = a;
        p.len = len;
      }
      if (isWet(this.kind)) this.drawGlass(ctx, w, h, t * speed);
      ctx.restore();
    } else {
      for (const p of this.particles) {
        this.preset.step(p, w, h, t * speed);
        this.preset.draw(ctx, p);
      }
    }

    if (this.drip) this.drawDrip(ctx, w, h, t * speed);
    // Overlays are light, not water — a lightning flash fills the room whether
    // or not the rain itself is confined to the scuttle.
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
