/**
 * Procedural audio.
 *
 * The Lamplight Cipher ships no audio files, so every rain shower, latch and
 * cello line here is synthesised from oscillators and noise buffers at runtime.
 * That constraint turns out to be the point: beds can run indefinitely without
 * an audible loop seam, one-shots vary slightly every time they fire, and the
 * whole soundtrack costs a few kilobytes of code rather than tens of megabytes
 * of streaming assets.
 *
 * The signal flow is deliberately shallow, because everything must share one
 * believable room:
 *
 *     voice ─┬─► channel.dry ────────────────────────────► master ─► limiter ─► out
 *            └─► channel.wet ─► convolver (shared room) ─► master
 *
 * The reverb send is taken *behind* each channel's fader, so pulling the SFX
 * slider to zero silences the SFX reverb too — a send tapped before the fader
 * would leave a ghost of every click hanging in the room.
 *
 * Nothing in this module is allowed to throw. A blocked, missing or exhausted
 * AudioContext degrades to silence and the game carries on.
 */

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------

/** Mixer channels the settings panel exposes. */
export type AudioChannel = 'master' | 'music' | 'ambience' | 'sfx';

/** Persisted mixer state. All gains are linear 0..1. */
export interface AudioLevels {
  master: number;
  music: number;
  ambience: number;
  sfx: number;
  muted: boolean;
}

/** Names accepted by {@link AudioEngine.setAmbience}. */
export const AMBIENCE_NAMES = [
  'rain-window',
  'heavy-storm',
  'wind-moor',
  'sea-swell',
  'fire-crackle',
  'clock-room',
  'cellar-drip',
  'attic-creak',
  'engine-hum',
  'quiet-library',
  'night-outdoors',
  'harbour',
  'silence',
] as const;

/** Names accepted by {@link AudioEngine.playSound}. */
export const SFX_NAMES = [
  'click-soft',
  'click-brass',
  'page-turn',
  'item-pickup',
  'clue-found',
  'drawer-open',
  'lock-click',
  'lock-refuse',
  'latch',
  'puzzle-correct',
  'puzzle-wrong',
  'puzzle-solved',
  'thunder',
  'door-heavy',
  'footstep-wood',
  'footstep-stone',
  'paper-rustle',
  'chime',
  'typewriter',
  'match-strike',
] as const;

/** Names accepted by {@link AudioEngine.setMusic}. */
export const MUSIC_NAMES = [
  'main-theme',
  'tension',
  'discovery',
  'sorrow',
  'confrontation',
] as const;

export type AmbienceName = (typeof AMBIENCE_NAMES)[number];
export type SfxName = (typeof SFX_NAMES)[number];
export type MusicName = (typeof MUSIC_NAMES)[number];

/**
 * Membership tests for content validation.
 *
 * The playback methods deliberately accept a bare `string`, because `Scene.
 * ambience`, `Effect{kind:'playSound'}` and `CinematicBeat.sound` are all typed
 * as strings in the content schema and an unknown name has to degrade to
 * silence rather than crash a scene transition. The cost of that leniency is
 * that a typo is invisible at runtime, so a build-time content check needs a
 * way to ask.
 */
export const isAmbienceName = (n: string): n is AmbienceName =>
  (AMBIENCE_NAMES as readonly string[]).includes(n);
export const isSfxName = (n: string): n is SfxName =>
  (SFX_NAMES as readonly string[]).includes(n);
export const isMusicName = (n: string): n is MusicName =>
  (MUSIC_NAMES as readonly string[]).includes(n);

const STORE_KEY = 'lamplight.audio';

/** Ambient beds cross-fade slowly enough that a room change never "cuts". */
const AMBIENCE_XFADE = 2.6;
/** Music breathes even slower — a cue should arrive before you notice it did. */
const MUSIC_XFADE = 4.2;
/** Fader moves are ramped, not stepped, so sliders never zipper. */
const FADER_RAMP = 0.05;

const DEFAULT_LEVELS: AudioLevels = {
  master: 0.8,
  music: 0.5,
  ambience: 0.7,
  sfx: 0.85,
  muted: false,
};

// ---------------------------------------------------------------------------
// Small numeric helpers
// ---------------------------------------------------------------------------

const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;

/**
 * Exponentially distributed delay. Natural transients — raindrops, fire pops,
 * distant creaks — arrive as a Poisson process; evenly-spaced events read as a
 * machine within about ten seconds of listening.
 */
const poisson = (meanSec: number) => -Math.log(1 - Math.random()) * meanSec;

/** Equal-tempered frequency for a MIDI note number. */
const noteHz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/**
 * A single-partial wave with an arbitrary starting phase.
 *
 * Every OscillatorNode starts at phase zero, so a dozen LFOs created in the
 * same frame all peak together and the bed pumps in lockstep for the first
 * minute. There is no phase argument in the Web Audio API; rotating the real
 * and imaginary coefficients of a one-partial `PeriodicWave` is the only way to
 * get one. Detuning is *not* a substitute — it changes the LFO's rate, which
 * quietly undoes the mutually-prime periods the weather beds depend on to keep
 * from ever repeating.
 */
function phasedSine(ctx: BaseAudioContext): PeriodicWave {
  const phi = Math.random() * Math.PI * 2;
  return ctx.createPeriodicWave(
    new Float32Array([0, Math.cos(phi)]),
    new Float32Array([0, Math.sin(phi)]),
    { disableNormalization: true },
  );
}

/**
 * Looks a content-supplied string up in one of the exhaustive tables.
 *
 * The tables are keyed by their literal name unions so they cannot drift from
 * the exported name lists, which means a plain `TABLE[name]` will not typecheck
 * against an arbitrary string. The own-property test is not ceremony either:
 * `SFX['toString']` is truthy on a bare object literal, and a scene author's
 * typo should never end up being *called*.
 */
function lookup<K extends string, T>(table: Record<K, T>, name: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(table, name) ? table[name as K] : undefined;
}

/** Chains nodes front-to-back; purely to keep the synth code readable. */
function wire(...nodes: AudioNode[]): void {
  for (let i = 0; i < nodes.length - 1; i++) nodes[i]!.connect(nodes[i + 1]!);
}

/**
 * Constant-power interpolation curve between two gains.
 *
 * Two beds cross-faded with linear gain audibly dip in the middle, because
 * uncorrelated signals sum by power, not amplitude. Interpolating the *squares*
 * keeps total energy flat across the swap.
 */
function powerCurve(from: number, to: number): Float32Array {
  // 129 points is one control point every ~33 ms across the longest (4.2 s)
  // fade. `setValueCurveAtTime` interpolates linearly between them, so a
  // coarser curve is a chain of slope discontinuities rather than a dissolve.
  const n = 129;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const s = i / (n - 1);
    c[i] = Math.sqrt(from * from * (1 - s) + to * to * s);
  }
  return c;
}

/**
 * Applies a constant-power fade to a gain, correctly interrupting one already
 * in flight.
 *
 * This is fussier than it looks, and getting it wrong is audible. A value curve
 * that has already *started* is not removed by `cancelScheduledValues`, and the
 * spec makes any `setValueAtTime` landing inside a live curve throw
 * `NotSupportedError`. That is not an exotic case: it is exactly what happens
 * when the player crosses two rooms faster than one 2.6 s ambience crossfade,
 * and the naive version leaves the outgoing bed pinned at full volume until its
 * dispose timer guillotines it — a hard cut in the middle of a slow dissolve.
 *
 * `cancelAndHoldAtTime` truncates the running curve and pins the parameter at
 * whatever value it had actually reached, which is the only way to start a new
 * fade from the real current position without a discontinuity. The two
 * fallbacks below it exist for engines that lack it, in decreasing order of
 * musicality; the last one simply lands on the target, which is still better
 * than a stuck fader.
 */
function fadeParam(param: AudioParam, to: number, dur: number, now: number): void {
  const seconds = Math.max(0.01, dur);

  let from = param.value;
  try {
    const hold = (param as Partial<AudioParam>).cancelAndHoldAtTime;
    if (typeof hold === 'function') hold.call(param, now);
    else param.cancelScheduledValues(now);
    // Read *after* the hold: before it, `value` may still reflect a stale event.
    from = param.value;
  } catch {
    /* nothing was scheduled, or the context is gone */
  }

  try {
    param.setValueCurveAtTime(powerCurve(from, to), now, seconds);
    return;
  } catch {
    /* a curve is still occupying this window */
  }
  try {
    param.setValueAtTime(from, now);
    param.linearRampToValueAtTime(to, now + seconds);
    return;
  } catch {
    /* automation is wedged; take the target directly */
  }
  try {
    param.value = to;
  } catch {
    /* the context is gone; silence is the correct outcome */
  }
}

// ---------------------------------------------------------------------------
// Baked buffers
// ---------------------------------------------------------------------------

type NoiseKind = 'white' | 'pink' | 'brown';

/** The three noise colours every bed is built from, generated exactly once. */
interface NoiseKit {
  white: AudioBuffer;
  pink: AudioBuffer;
  brown: AudioBuffer;
}

/**
 * Renders a looping noise buffer.
 *
 * `fill` writes `seconds + fadeSec` worth of samples; the overhang is then
 * spliced back over the head with a constant-power crossfade. White noise would
 * loop cleanly anyway, but pink and especially brown noise wander far from zero
 * and would click on every wrap without this.
 */
function makeNoiseBuffer(
  ctx: BaseAudioContext,
  seconds: number,
  fadeSec: number,
  fill: (out: Float32Array) => void,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(seconds * sr);
  const tail = Math.floor(fadeSec * sr);
  const buf = ctx.createBuffer(2, len, sr);

  for (let c = 0; c < 2; c++) {
    const work = new Float32Array(len + tail);
    fill(work);
    for (let i = 0; i < tail; i++) {
      const s = i / tail;
      work[i] = work[i]! * Math.sqrt(s) + work[len + i]! * Math.sqrt(1 - s);
    }
    buf.getChannelData(c).set(work.subarray(0, len));
  }
  return buf;
}

function buildNoiseKit(ctx: BaseAudioContext): NoiseKit {
  const white = makeNoiseBuffer(ctx, 4, 0.25, (out) => {
    for (let i = 0; i < out.length; i++) out[i] = Math.random() * 2 - 1;
  });

  // Paul Kellet's economy pink filter: -3 dB/octave, cheap enough to render a
  // multi-second buffer during a single user gesture without a hitch.
  const pink = makeNoiseBuffer(ctx, 5, 0.3, (out) => {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < out.length; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  });

  // Leaky integration gives -6 dB/octave without the DC runaway of a true
  // random walk. This is the weight under wind, sea, thunder and fire.
  const brown = makeNoiseBuffer(ctx, 6, 0.4, (out) => {
    let last = 0;
    for (let i = 0; i < out.length; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      out[i] = last * 3.4;
    }
  });

  return { white, pink, brown };
}

/**
 * Synthesised impulse response for the shared room.
 *
 * Exponentially decaying noise on its own sounds like a plate. The two things
 * that make it read as an actual interior are the darkening one-pole lowpass
 * (air and soft furnishings eat the top end first) and the half-dozen discrete
 * early reflections, which are what the ear actually uses to judge room size.
 *
 * The result is normalised by *energy*, not by peak. Convolution multiplies
 * signal power by the total energy of the impulse, so a two-second noise tail
 * peak-normalised to 0.9 has an RMS gain of roughly +30 dB — the reverb would
 * arrive louder than the sound that caused it and slam the limiter shut on
 * every footstep. Scaling by 1/sqrt(Σh²) makes the convolver unity-gain, which
 * is what lets the send amounts on individual voices actually mean something.
 */
function buildImpulse(ctx: BaseAudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(2.4 * sr);
  const pre = Math.floor(0.014 * sr);
  const early = [0.011, 0.019, 0.028, 0.041, 0.059, 0.078];
  const buf = ctx.createBuffer(2, len, sr);

  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    let hpX = 0;
    let hpY = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / (len - pre);
      const env = Math.pow(1 - t, 2.6) * Math.exp(-t * 2.2);
      const x = (Math.random() * 2 - 1) * env;
      lp += 0.34 * (x - lp);
      const y = 0.996 * (hpY + lp - hpX);
      hpX = lp;
      hpY = y;
      d[i] = y;
    }
    // Offset the reflection times per channel so the room has width.
    for (let k = 0; k < early.length; k++) {
      const idx = pre + Math.floor((early[k]! + c * 0.0033) * sr);
      if (idx < len) d[idx] += (k % 2 ? -1 : 1) * 0.42 * Math.pow(0.72, k);
    }
  }

  let energy = 0;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) energy += d[i]! * d[i]!;
  }
  energy /= 2;
  const k = energy > 1e-9 ? 1 / Math.sqrt(energy) : 0;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = d[i]! * k;
  }
  return buf;
}

// ---------------------------------------------------------------------------
// Voice primitives
// ---------------------------------------------------------------------------

/**
 * Where a voice is allowed to make noise.
 *
 * Beds hand their own inputs to voices via this shape, so the exact same
 * transient helpers can be used for a one-shot SFX (routed straight to the SFX
 * channel) and for a raindrop inside a bed (routed through the bed's fader, so
 * it cross-fades away with everything else).
 */
interface Studio {
  ctx: AudioContext;
  kit: NoiseKit;
  /** Dry destination, already behind this channel's fader. */
  out: AudioNode;
  /** Reverb send input, behind the same fader. */
  room: AudioNode;
}

/**
 * Starts a throwaway voice and guarantees it unhooks itself once it falls
 * silent. Beds fire thousands of these over a long session; without the
 * `onended` teardown the graph would grow without bound.
 *
 * Returns whether the voice actually started, because a caller that has already
 * started satellite sources (a vibrato oscillator, say) needs to know to stop
 * them. The failure path tears the graph down itself: an un-started source
 * never fires `onended`, so bailing out silently would strand every node the
 * caller had just built.
 */
function launch(
  src: AudioScheduledSourceNode,
  nodes: AudioNode[],
  at: number,
  end: number,
  offset = 0,
): boolean {
  const drop = () => {
    for (const n of nodes) {
      try {
        n.disconnect();
      } catch {
        /* already torn down */
      }
    }
  };

  try {
    if (offset > 0 && 'buffer' in src) (src as AudioBufferSourceNode).start(at, offset);
    else src.start(at);
    // A stop that is not strictly after the start is a no-op on some engines
    // and leaves the voice running forever.
    src.stop(Math.max(end, at + 0.01));
  } catch {
    try {
      src.stop();
    } catch {
      /* never started */
    }
    drop();
    return false;
  }

  src.onended = drop;
  return true;
}

/** Percussive gain shape: near-instant attack, exponential tail to silence. */
function shape(g: GainNode, at: number, level: number, attack: number, dur: number): number {
  const p = g.gain;
  const peak = Math.max(0.0002, level);
  p.setValueAtTime(0.0001, at);
  p.exponentialRampToValueAtTime(peak, at + attack);
  p.exponentialRampToValueAtTime(0.0001, at + attack + dur);
  return at + attack + dur;
}

interface BurstOpts {
  kind?: NoiseKind;
  type?: BiquadFilterType;
  freq: number;
  /** Sweeps the filter across the burst — friction, scrapes, thunder. */
  freqTo?: number;
  q?: number;
  level: number;
  attack?: number;
  dur: number;
  /** Reverb send, 0..1. */
  room?: number;
  /** Resamples the noise; below 1 darkens it, above 1 adds grit. */
  rate?: number;
}

/** A filtered noise transient — the backbone of nearly every mechanical sound. */
function burst(s: Studio, at: number, o: BurstOpts): void {
  const { ctx } = s;
  const buf = s.kit[o.kind ?? 'white'];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.playbackRate.value = o.rate ?? 1;

  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(Math.max(20, o.freq), at);
  if (o.freqTo !== undefined) {
    f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), at + o.dur);
  }

  const g = ctx.createGain();
  const end = shape(g, at, o.level, o.attack ?? 0.004, o.dur);
  wire(src, f, g, s.out);

  const nodes: AudioNode[] = [src, f, g];
  if (o.room) {
    const w = ctx.createGain();
    w.gain.value = o.room;
    g.connect(w);
    w.connect(s.room);
    nodes.push(w);
  }
  launch(src, nodes, at, end + 0.04, Math.random() * (buf.duration - 0.6));
}

interface PingOpts {
  type?: OscillatorType;
  hz: number;
  /** Pitch drop or rise across the tail — thuds, drips, gull cries. */
  hzTo?: number;
  level: number;
  attack?: number;
  dur: number;
  room?: number;
  detune?: number;
}

/** A pitched partial with an exponential tail — bells, tines, ticks, thuds. */
function ping(s: Studio, at: number, o: PingOpts): void {
  const { ctx } = s;
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(Math.max(10, o.hz), at);
  if (o.hzTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(10, o.hzTo), at + o.dur);
  }
  if (o.detune) osc.detune.value = o.detune;

  const g = ctx.createGain();
  const end = shape(g, at, o.level, o.attack ?? 0.003, o.dur);
  wire(osc, g, s.out);

  const nodes: AudioNode[] = [osc, g];
  if (o.room) {
    const w = ctx.createGain();
    w.gain.value = o.room;
    g.connect(w);
    w.connect(s.room);
    nodes.push(w);
  }
  launch(osc, nodes, at, end + 0.02);
}

/**
 * Wood under load.
 *
 * A creak is stick-slip friction, not a tone: the pitch is set by an extremely
 * narrow resonance that lurches erratically as the joint gives. Sweeping a
 * high-Q bandpass over brown noise in random steps reproduces that far more
 * convincingly than any oscillator.
 */
function creak(
  s: Studio,
  at: number,
  o: { hz: number; dur: number; level: number; room?: number },
): void {
  const { ctx } = s;
  const src = ctx.createBufferSource();
  src.buffer = s.kit.brown;
  src.loop = true;
  src.playbackRate.value = 0.7;

  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.Q.value = 20;
  bp.frequency.setValueAtTime(o.hz, at);
  const steps = 8;
  for (let i = 1; i <= steps; i++) {
    bp.frequency.linearRampToValueAtTime(o.hz * rand(0.78, 1.5), at + (o.dur * i) / steps);
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.level), at + o.dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  wire(src, bp, g, s.out);

  const nodes: AudioNode[] = [src, bp, g];
  if (o.room) {
    const w = ctx.createGain();
    w.gain.value = o.room;
    g.connect(w);
    w.connect(s.room);
    nodes.push(w);
  }
  launch(src, nodes, at, at + o.dur + 0.06, Math.random() * 4);
}

/**
 * A struck music-box tine: a bright hammer contact, a long triangle
 * fundamental, and two fast inharmonic partials. The slight detune on the
 * partials (2.01x, 4.03x rather than 2x, 4x) is what stops it sounding like a
 * synthesiser playing a sine.
 */
function musicBox(s: Studio, at: number, hz: number, level: number): void {
  burst(s, at, { type: 'bandpass', freq: hz * 4.2, q: 2.2, level: level * 0.3, dur: 0.018 });
  ping(s, at, { type: 'triangle', hz, level, dur: 2.4, room: 0.55 });
  ping(s, at, { type: 'sine', hz: hz * 2.01, level: level * 0.42, dur: 0.9, room: 0.4 });
  ping(s, at, { type: 'sine', hz: hz * 4.03, level: level * 0.11, dur: 0.32, room: 0.3 });
}

/**
 * A bowed low string. Cello, not synth pad: the swell is slow, the lowpass
 * opens as the bow digs in and closes as it lifts, and a shallow 4.7 Hz vibrato
 * keeps the pitch alive.
 */
function bowed(s: Studio, at: number, hz: number, dur: number, level: number): void {
  const { ctx } = s;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = hz;

  const vib = ctx.createOscillator();
  vib.frequency.value = rand(4.2, 5.2);
  const vibDepth = ctx.createGain();
  vibDepth.gain.value = hz * 0.004;
  vib.connect(vibDepth);
  vibDepth.connect(osc.frequency);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.9;
  lp.frequency.setValueAtTime(Math.max(160, hz * 2), at);
  lp.frequency.linearRampToValueAtTime(Math.max(340, hz * 5), at + dur * 0.4);
  lp.frequency.linearRampToValueAtTime(Math.max(160, hz * 2.2), at + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, level), at + dur * 0.38);
  g.gain.setValueAtTime(Math.max(0.0002, level), at + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  wire(osc, lp, g, s.out);
  g.connect(wet);
  wet.connect(s.room);

  // The vibrato oscillator is a satellite of the main voice, so it is only
  // started once the voice is known to be running — otherwise a failed start
  // would leave a free-running LFO wired into a graph nobody will ever tear
  // down, and a long session of cello swells would accumulate them.
  const nodes: AudioNode[] = [osc, vib, vibDepth, lp, g, wet];
  if (launch(osc, nodes, at, at + dur + 0.1)) {
    try {
      vib.start(at);
      vib.stop(at + dur + 0.1);
    } catch {
      /* context gone; the voice's own onended still cleans up */
    }
  }
}

/** A single drop landing on glass or into standing water. */
function droplet(s: Studio, at: number, hz: number, level: number, room = 0.2): void {
  burst(s, at, { freq: hz * 2.2, q: 3, level: level * 0.7, dur: 0.012 });
  ping(s, at, { hz, hzTo: hz * 0.42, level, dur: 0.055, room });
}

/** Distant thunder, also used as a one-shot. Scaled by `weight` for storms. */
function thunderClap(s: Studio, at: number, weight: number): void {
  burst(s, at, {
    type: 'lowpass',
    freq: 3200,
    freqTo: 280,
    q: 0.7,
    level: 0.3 * weight,
    attack: 0.006,
    dur: 0.4,
    room: 0.6,
  });
  burst(s, at + 0.02, {
    kind: 'brown',
    type: 'lowpass',
    freq: 240,
    freqTo: 60,
    level: 0.48 * weight,
    attack: 0.14,
    dur: 3.2,
    rate: 0.5,
    room: 0.8,
  });
  burst(s, at + rand(0.7, 1.2), {
    kind: 'brown',
    type: 'lowpass',
    freq: 130,
    level: 0.26 * weight,
    attack: 0.5,
    dur: 2.6,
    rate: 0.45,
    room: 0.7,
  });
}

// ---------------------------------------------------------------------------
// Rig — one continuous bed and everything it owns
// ---------------------------------------------------------------------------

type EventFn = (at: number) => void;

interface ScheduledEvent {
  next: number;
  period(): number;
  fn: EventFn;
}

/** How far ahead the scheduler commits events to the audio clock. */
const LOOKAHEAD = 0.25;
const SCHED_TICK_MS = 100;
/**
 * Hard ceiling on events one drain may commit for a single stream. A period
 * function that returns something pathological (or a clock that jumps) must
 * cost a dropped transient, never a hung tab.
 */
const MAX_EVENTS_PER_DRAIN = 64;

/**
 * A running ambience or music bed.
 *
 * Owns every node and timer it creates so that switching beds a hundred times
 * leaves nothing behind, and exposes two faders — dry and reverb-send — which
 * are automated together so a bed's room tone fades out with the bed itself.
 *
 * Timed events run off a lookahead scheduler rather than raw `setTimeout`:
 * a clock tick placed by `setTimeout` wanders by tens of milliseconds and
 * immediately stops sounding like a clock, whereas events committed to the
 * audio clock 250 ms early are sample-accurate.
 */
class Rig {
  readonly stage: Studio;
  /** Voices connect here for the dry path. */
  readonly input: GainNode;
  /** Voices connect here for extra room. */
  readonly roomInput: GainNode;

  private readonly ctx: AudioContext;
  private readonly dryFade: GainNode;
  private readonly wetFade: GainNode;
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private readonly events: ScheduledEvent[] = [];
  private timer = 0;
  private disposeTimer = 0;
  private disposed = false;
  private onGone: (() => void) | undefined;

  constructor(kit: NoiseKit, ctx: AudioContext, dry: AudioNode, room: AudioNode) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.roomInput = ctx.createGain();
    this.dryFade = ctx.createGain();
    this.wetFade = ctx.createGain();
    this.dryFade.gain.value = 0;
    this.wetFade.gain.value = 0;

    this.input.connect(this.dryFade).connect(dry);
    this.roomInput.connect(this.wetFade).connect(room);
    this.nodes.push(this.input, this.roomInput, this.dryFade, this.wetFade);

    this.stage = { ctx, kit, out: this.input, room: this.roomInput };
  }

  // -- node factories (everything created here is tracked and torn down) ----

  gain(value = 1): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = value;
    this.nodes.push(g);
    return g;
  }

  biquad(type: BiquadFilterType, freq: number, q = 1, gainDb?: number): BiquadFilterNode {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    if (gainDb !== undefined) f.gain.value = gainDb;
    this.nodes.push(f);
    return f;
  }

  /** A continuous oscillator, started immediately and stopped on teardown. */
  osc(type: OscillatorType, freq: number, detuneCents = 0, wave?: PeriodicWave): OscillatorNode {
    const o = this.ctx.createOscillator();
    // Set before `start()`: swapping the waveform of a running oscillator is a
    // discontinuity, and at LFO rates that discontinuity is a thump.
    if (wave) o.setPeriodicWave(wave);
    else o.type = type;
    o.frequency.value = freq;
    o.detune.value = detuneCents;
    this.nodes.push(o);
    this.srcs.push(o);
    try {
      o.start();
    } catch {
      /* context gone */
    }
    return o;
  }

  /** A looping noise source, entered at a random offset to decorrelate layers. */
  noise(kind: NoiseKind, rate = 1): AudioBufferSourceNode {
    const buf = this.stage.kit[kind];
    const s = this.ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.playbackRate.value = rate;
    this.nodes.push(s);
    this.srcs.push(s);
    try {
      s.start(this.ctx.currentTime, Math.random() * buf.duration);
    } catch {
      /* context gone */
    }
    return s;
  }

  /** noise → filters → gain → dry input. The workhorse of every bed. */
  band(kind: NoiseKind, filters: BiquadFilterNode[], level: number, rate = 1): GainNode {
    const g = this.gain(level);
    let node: AudioNode = this.noise(kind, rate);
    for (const f of filters) {
      node.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(this.input);
    return g;
  }

  /**
   * Ties a sub-audio oscillator to a parameter — gusts, swells, flicker.
   *
   * The rate is taken literally and only the phase is randomised. Beds choose
   * mutually prime periods (0.043 / 0.071 / 0.031 Hz in the rain, say) so their
   * layers never line up twice in a session; anything that perturbs the rate
   * throws that away.
   */
  lfo(target: AudioParam, hz: number, depth: number): void {
    let wave: PeriodicWave | undefined;
    try {
      wave = phasedSine(this.ctx);
    } catch {
      /* a zero-phase sine is an acceptable degradation */
    }
    const o = this.osc('sine', hz, 0, wave);
    const g = this.gain(depth);
    o.connect(g);
    g.connect(target);
  }

  /** Bleeds a fixed proportion of the whole bed into the shared room. */
  roomMix(amount: number): void {
    const g = this.gain(amount);
    this.input.connect(g);
    g.connect(this.roomInput);
  }

  // -- scheduling ----------------------------------------------------------

  /**
   * Repeats `fn` on the audio clock. `period` may be a constant (a clock tick)
   * or a thunk returning a fresh interval each time (Poisson transients).
   */
  every(period: number | (() => number), fn: EventFn, firstDelay?: number): void {
    if (this.disposed) return;
    const next = typeof period === 'number' ? () => period : period;
    this.events.push({
      next: this.ctx.currentTime + (firstDelay ?? next() * Math.random()),
      period: next,
      fn,
    });
    if (!this.timer) this.timer = setInterval(this.drain, SCHED_TICK_MS);
  }

  private drain = () => {
    // A suspended context freezes `currentTime`; committing events against it
    // would queue hundreds at the same instant and detonate them on resume.
    if (this.disposed || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    // Snapshot: a factory is allowed to register further streams, and mutating
    // the array mid-iteration would either skip or double-serve one.
    for (const e of this.events.slice()) {
      // Catching up after a suspension, a throttled tab or a clock jump: the
      // backlog is discarded rather than replayed, because forty seconds of
      // raindrops arriving in one buffer is a gunshot, not weather.
      if (e.next < now) e.next = now + 0.03;
      let fired = 0;
      while (e.next < horizon && fired++ < MAX_EVENTS_PER_DRAIN) {
        try {
          e.fn(e.next);
        } catch {
          /* one bad transient must never kill the bed */
        }
        const period = e.period();
        e.next += Number.isFinite(period) ? Math.max(0.02, period) : 1;
      }
    }
  };

  // -- lifecycle -----------------------------------------------------------

  fadeIn(dur: number): void {
    const now = this.ctx.currentTime;
    fadeParam(this.dryFade.gain, 1, dur, now);
    fadeParam(this.wetFade.gain, 1, dur, now);
  }

  /**
   * Fades out, then disposes. Transients keep firing during the fade on
   * purpose — a fire whose crackles stop dead the instant a room change begins
   * announces the transition far more loudly than the crossfade hides it.
   *
   * `onGone` fires once the teardown has actually happened, so the engine can
   * stop tracking a bed it no longer owns without polling for it.
   */
  fadeOutAndDispose(dur: number, onGone?: () => void): void {
    if (this.disposed) {
      onGone?.();
      return;
    }
    if (onGone) this.onGone = onGone;
    const now = this.ctx.currentTime;
    fadeParam(this.dryFade.gain, 0, dur, now);
    fadeParam(this.wetFade.gain, 0, dur, now);
    clearTimeout(this.disposeTimer);
    this.disposeTimer = setTimeout(() => this.dispose(), dur * 1000 + 150);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearInterval(this.timer);
    clearTimeout(this.disposeTimer);
    this.timer = 0;
    this.events.length = 0;
    for (const s of this.srcs) {
      try {
        s.stop();
      } catch {
        /* never started, or already stopped */
      }
    }
    for (const n of this.nodes) {
      try {
        n.disconnect();
      } catch {
        /* already gone */
      }
    }
    this.srcs.length = 0;
    this.nodes.length = 0;
    const gone = this.onGone;
    this.onGone = undefined;
    gone?.();
  }
}

// ---------------------------------------------------------------------------
// Ambience beds
// ---------------------------------------------------------------------------

type BedFactory = (r: Rig) => void;

/**
 * Rain: three noise bands rather than one.
 *
 * A single filtered hiss reads as static. Splitting it into the low wash that
 * carries the weight, the mid body of water striking glass, and the fine
 * sizzle that places it outdoors — each breathing on its own slow, mutually
 * prime LFO — is what makes it read as weather.
 */
function rainLayers(r: Rig, weight: number): void {
  const low = r.band('pink', [r.biquad('lowpass', 620, 0.7)], 0.3 * weight);
  const mid = r.band('white', [r.biquad('bandpass', 1500, 0.6)], 0.2 * weight);
  const hiss = r.band('white', [r.biquad('bandpass', 5200, 0.9)], 0.05 * weight);
  r.lfo(low.gain, 0.043, 0.09 * weight);
  r.lfo(mid.gain, 0.071, 0.06 * weight);
  r.lfo(hiss.gain, 0.031, 0.016 * weight);
}

/**
 * Keyed by {@link AmbienceName} rather than `string` so that adding a bed here
 * without listing it in {@link AMBIENCE_NAMES} — or vice versa — is a compile
 * error. The two used to be able to drift, and a bed nobody can name is dead
 * code that still looks alive.
 */
const AMBIENCE: Record<AmbienceName, BedFactory> = {
  'rain-window': (r) => {
    rainLayers(r, 1);
    // Individual drops on the pane, close enough to have a pitch.
    r.every(
      () => poisson(0.5),
      (at) => droplet(r.stage, at, rand(700, 1600), rand(0.03, 0.09), 0.25),
    );
    r.roomMix(0.14);
  },

  'heavy-storm': (r) => {
    rainLayers(r, 1.7);
    // Storms are mostly low end: without the brown bed it is just loud rain.
    const rumble = r.band('brown', [r.biquad('lowpass', 160, 0.8)], 0.16, 0.6);
    r.lfo(rumble.gain, 0.019, 0.07);
    const gust = r.band('brown', [r.biquad('lowpass', 700, 1.1)], 0.16);
    r.lfo(gust.gain, 0.037, 0.11);
    r.every(
      () => poisson(0.22),
      (at) => droplet(r.stage, at, rand(600, 1800), rand(0.03, 0.1), 0.3),
    );
    r.every(
      () => poisson(21),
      (at) => thunderClap(r.stage, at, rand(0.35, 0.85)),
      rand(6, 18),
    );
    r.roomMix(0.18);
  },

  'wind-moor': (r) => {
    // The wandering resonance, not the noise floor, is what says "wind".
    const sweep = r.biquad('lowpass', 380, 1.2);
    const peak = r.biquad('peaking', 400, 6, 12);
    const body = r.band('brown', [sweep, peak], 0.5);
    r.lfo(sweep.frequency, 0.036, 260);
    r.lfo(peak.frequency, 0.021, 170);
    r.lfo(body.gain, 0.047, 0.18);

    // A thin whistle over the top, gusting out of phase with the body.
    const whistleF = r.biquad('bandpass', 1250, 4.5);
    const whistle = r.band('white', [whistleF], 0.035);
    r.lfo(whistleF.frequency, 0.058, 420);
    r.lfo(whistle.gain, 0.029, 0.03);
    r.roomMix(0.1);
  },

  'sea-swell': (r) => {
    // Swell and foam share one period but not one phase: the hiss of a wave
    // arrives slightly after its weight, which is the whole character.
    const swellF = r.biquad('lowpass', 520, 0.8);
    const swell = r.band('brown', [swellF], 0.45);
    r.lfo(swellF.frequency, 0.062, 300);
    r.lfo(swell.gain, 0.062, 0.2);

    const foam = r.band('white', [r.biquad('bandpass', 2600, 0.7)], 0.055);
    r.lfo(foam.gain, 0.059, 0.045);
    r.lfo(foam.gain, 0.017, 0.02);
    r.roomMix(0.12);
  },

  'fire-crackle': (r) => {
    const bed = r.band('brown', [r.biquad('lowpass', 190, 0.9)], 0.24, 0.7);
    r.lfo(bed.gain, 0.13, 0.07);
    r.band('pink', [r.biquad('bandpass', 900, 0.6)], 0.045);
    // Dense small crackles with an occasional resinous pop underneath them.
    r.every(
      () => poisson(0.085),
      (at) =>
        burst(r.stage, at, {
          freq: rand(1300, 5200),
          q: rand(1.5, 5),
          level: rand(0.015, 0.11),
          dur: rand(0.008, 0.03),
          rate: rand(0.9, 1.4),
        }),
    );
    r.every(
      () => poisson(3.4),
      (at) => {
        burst(r.stage, at, { type: 'lowpass', freq: 700, level: 0.12, dur: 0.07, room: 0.2 });
        ping(r.stage, at, { hz: rand(180, 320), hzTo: 110, level: 0.05, dur: 0.09 });
      },
    );
    r.roomMix(0.1);
  },

  'clock-room': (r) => {
    r.band('pink', [r.biquad('lowpass', 300, 0.7)], 0.035);
    // Tick and tock differ: the escapement is not symmetrical, and a clock
    // whose two halves sound identical reads as a metronome.
    let tock = false;
    r.every(
      1,
      (at) => {
        tock = !tock;
        const f = tock ? 2100 : 2600;
        burst(r.stage, at, { freq: f, q: 6, level: 0.05, dur: 0.012, room: 0.3 });
        ping(r.stage, at, { hz: tock ? 165 : 195, hzTo: 120, level: 0.028, dur: 0.03, room: 0.25 });
      },
      0.6,
    );
    r.roomMix(0.2);
  },

  'cellar-drip': (r) => {
    r.band('brown', [r.biquad('lowpass', 120, 0.8)], 0.09, 0.5);
    r.band('pink', [r.biquad('bandpass', 420, 0.9)], 0.018);
    // Very wet: in a stone cellar the reflection is louder than the drop.
    r.every(
      () => poisson(3.2),
      (at) => droplet(r.stage, at, rand(520, 1000), rand(0.06, 0.14), 0.9),
    );
    r.every(
      () => poisson(11),
      (at) => droplet(r.stage, at, rand(240, 380), 0.09, 1),
    );
    r.roomMix(0.5);
  },

  'attic-creak': (r) => {
    const seepF = r.biquad('bandpass', 760, 2.2);
    const seep = r.band('white', [seepF], 0.03);
    r.lfo(seepF.frequency, 0.04, 220);
    r.lfo(seep.gain, 0.033, 0.024);
    r.band('brown', [r.biquad('lowpass', 140, 0.8)], 0.07, 0.6);
    r.every(
      () => poisson(9),
      (at) => creak(r.stage, at, { hz: rand(95, 210), dur: rand(0.5, 1.4), level: rand(0.05, 0.13), room: 0.4 }),
      rand(2, 7),
    );
    // Small settling ticks: the house cooling, nothing more sinister.
    r.every(
      () => poisson(6),
      (at) => burst(r.stage, at, { freq: rand(900, 2400), q: 5, level: 0.03, dur: 0.015, room: 0.35 }),
    );
    r.roomMix(0.25);
  },

  'engine-hum': (r) => {
    // Harmonics plus a deliberate 0.7 Hz beat between the two 50 Hz oscillators;
    // perfectly in-tune partials sound synthetic, machines never are.
    const lp = r.biquad('lowpass', 420, 1.1);
    const g = r.gain(0.16);
    for (const [hz, level, detune] of [
      [50, 1, 0],
      [50, 0.6, 24],
      [100, 0.45, -8],
      [150, 0.22, 12],
      [200, 0.1, -16],
    ] as const) {
      const o = r.osc('sawtooth', hz, detune);
      const og = r.gain(level);
      o.connect(og);
      og.connect(lp);
    }
    lp.connect(g);
    g.connect(r.input);
    r.lfo(g.gain, 3.2, 0.03);
    r.lfo(lp.frequency, 0.09, 120);
    // Mechanical air over the top.
    const hiss = r.band('pink', [r.biquad('bandpass', 1800, 0.8)], 0.03);
    r.lfo(hiss.gain, 0.21, 0.012);
    r.roomMix(0.12);
  },

  'quiet-library': (r) => {
    // Almost nothing — but "almost nothing" and true digital silence feel
    // completely different, and only one of them feels like a room.
    r.band('pink', [r.biquad('lowpass', 240, 0.7)], 0.045);
    const o = r.osc('sine', 47);
    const og = r.gain(0.012);
    o.connect(og);
    og.connect(r.input);
    r.lfo(og.gain, 0.07, 0.005);
    r.every(
      () => poisson(17),
      (at) => creak(r.stage, at, { hz: rand(120, 240), dur: rand(0.4, 0.9), level: 0.035, room: 0.5 }),
      rand(8, 20),
    );
    r.roomMix(0.3);
  },

  'night-outdoors': (r) => {
    const lp = r.biquad('lowpass', 300, 0.9);
    const air = r.band('brown', [lp], 0.22);
    r.lfo(lp.frequency, 0.028, 170);
    r.lfo(air.gain, 0.039, 0.08);
    // Crickets: four narrow pulses, not one — the stridulation rate is the tell.
    r.every(
      () => poisson(2.4),
      (at) => {
        const hz = rand(4000, 5200);
        const level = rand(0.012, 0.035);
        for (let i = 0; i < 4; i++) {
          burst(r.stage, at + i * 0.022, { freq: hz, q: 18, level, dur: 0.011, room: 0.3 });
        }
      },
    );
    r.every(
      () => poisson(13),
      (at) => burst(r.stage, at, { kind: 'pink', freq: rand(1400, 3000), q: 1.4, level: 0.03, dur: 0.18, room: 0.4 }),
    );
    r.roomMix(0.15);
  },

  harbour: (r) => {
    const swellF = r.biquad('lowpass', 460, 0.8);
    const swell = r.band('brown', [swellF], 0.34);
    r.lfo(swellF.frequency, 0.055, 240);
    r.lfo(swell.gain, 0.055, 0.16);
    const foam = r.band('white', [r.biquad('bandpass', 2200, 0.8)], 0.035);
    r.lfo(foam.gain, 0.051, 0.03);

    // Rope and hull under a slow swell.
    r.every(
      () => poisson(13),
      (at) => creak(r.stage, at, { hz: rand(70, 150), dur: rand(0.7, 1.7), level: rand(0.04, 0.1), room: 0.45 }),
      rand(3, 10),
    );
    // A bell buoy, far enough out to be almost all reverb.
    r.every(
      () => poisson(23),
      (at) => {
        const base = rand(520, 620);
        for (const [mult, dur, lvl] of [
          [1, 2.4, 0.05],
          [2.76, 1.4, 0.026],
          [5.4, 0.7, 0.012],
        ] as const) {
          ping(r.stage, at, { hz: base * mult, level: lvl, dur, room: 0.9 });
        }
      },
      rand(9, 22),
    );
    // A gull, rarely. Two calls, because one sounds like a mistake.
    r.every(
      () => poisson(46),
      (at) => {
        for (let i = 0; i < 2; i++) {
          const t = at + i * 0.42;
          ping(r.stage, t, { type: 'sawtooth', hz: 1150, hzTo: 1500, level: 0.016, attack: 0.05, dur: 0.3, room: 0.6 });
        }
      },
      rand(20, 60),
    );
    r.roomMix(0.22);
  },

  // Deliberately empty: an explicit "no bed" is clearer at the call site than
  // an unknown name silently falling through to nothing.
  silence: () => {},
};

// ---------------------------------------------------------------------------
// One-shot SFX
// ---------------------------------------------------------------------------

type SfxFactory = (s: Studio, at: number) => void;

/** Exhaustive over {@link SFX_NAMES}; see the note on {@link AMBIENCE}. */
const SFX: Record<SfxName, SfxFactory> = {
  'click-soft': (s, at) => {
    burst(s, at, { freq: 1700, q: 1.4, level: 0.1, dur: 0.022 });
    ping(s, at, { hz: 260, hzTo: 180, level: 0.045, dur: 0.04 });
  },

  'click-brass': (s, at) => {
    burst(s, at, { freq: 3200, q: 2, level: 0.09, dur: 0.028, room: 0.2 });
    // Inharmonic partials with staggered decays: brass, not a bell.
    ping(s, at, { hz: 2410, level: 0.045, dur: 0.12, room: 0.25 });
    ping(s, at, { hz: 3730, level: 0.03, dur: 0.08, room: 0.25 });
    ping(s, at, { hz: 5140, level: 0.016, dur: 0.05, room: 0.2 });
    ping(s, at, { hz: 320, hzTo: 220, level: 0.05, dur: 0.05 });
  },

  'page-turn': (s, at) => {
    burst(s, at, { freq: 1400, freqTo: 3600, q: 0.8, level: 0.14, attack: 0.02, dur: 0.18, rate: 1.2, room: 0.2 });
    burst(s, at + 0.1, { freq: 2400, freqTo: 900, q: 0.7, level: 0.1, attack: 0.015, dur: 0.16, room: 0.2 });
  },

  'item-pickup': (s, at) => {
    burst(s, at, { kind: 'pink', freq: 900, q: 0.7, level: 0.08, attack: 0.02, dur: 0.18 });
    musicBox(s, at + 0.03, noteHz(76), 0.075);
    musicBox(s, at + 0.14, noteHz(83), 0.06);
  },

  'clue-found': (s, at) => {
    // Rising, but only three notes and quietly: discovery, not a level-up.
    musicBox(s, at, noteHz(72), 0.08);
    musicBox(s, at + 0.11, noteHz(76), 0.07);
    musicBox(s, at + 0.22, noteHz(79), 0.065);
    burst(s, at, { type: 'highpass', freq: 6000, level: 0.03, attack: 0.03, dur: 0.4, room: 0.6 });
  },

  'drawer-open': (s, at) => {
    burst(s, at, {
      kind: 'brown',
      freq: 260,
      freqTo: 460,
      q: 1.2,
      level: 0.2,
      attack: 0.12,
      dur: 0.45,
      rate: 0.8,
      room: 0.25,
    });
    burst(s, at + 0.5, { freq: 900, q: 2, level: 0.09, dur: 0.05, room: 0.2 });
    ping(s, at + 0.5, { hz: 150, hzTo: 90, level: 0.16, dur: 0.12, room: 0.2 });
  },

  'lock-click': (s, at) => {
    for (const [t, f] of [
      [0, 2600],
      [0.048, 3100],
    ] as const) {
      burst(s, at + t, { freq: f, q: 3.5, level: 0.14, dur: 0.022, room: 0.25 });
      ping(s, at + t, { hz: f * 0.7, level: 0.04, dur: 0.05, room: 0.25 });
    }
  },

  'lock-refuse': (s, at) => {
    // Dull, low, and stopped short — a mechanism refusing to travel.
    burst(s, at, { kind: 'brown', type: 'lowpass', freq: 420, level: 0.26, dur: 0.12, room: 0.2 });
    ping(s, at, { hz: 140, hzTo: 105, level: 0.18, dur: 0.18, room: 0.2 });
    ping(s, at, { type: 'square', hz: 92, level: 0.03, dur: 0.1 });
  },

  latch: (s, at) => {
    burst(s, at, { freq: 3400, q: 4, level: 0.18, dur: 0.018, room: 0.3 });
    ping(s, at, { hz: 2100, level: 0.06, dur: 0.06, room: 0.3 });
    ping(s, at, { hz: 190, hzTo: 120, level: 0.08, dur: 0.05 });
  },

  'puzzle-correct': (s, at) => {
    musicBox(s, at, noteHz(74), 0.08);
    musicBox(s, at + 0.1, noteHz(78), 0.07);
  },

  'puzzle-wrong': (s, at) => {
    // A minor second, low and short. Unpleasant without being punitive.
    ping(s, at, { type: 'triangle', hz: noteHz(55), level: 0.13, attack: 0.008, dur: 0.34, room: 0.3 });
    ping(s, at, { type: 'triangle', hz: noteHz(56), level: 0.11, attack: 0.008, dur: 0.3, room: 0.3 });
    burst(s, at, { kind: 'brown', type: 'lowpass', freq: 300, level: 0.1, dur: 0.1 });
  },

  'puzzle-solved': (s, at) => {
    const notes = [69, 72, 76, 81];
    notes.forEach((n, i) => musicBox(s, at + i * 0.17, noteHz(n), 0.085 - i * 0.008));
    bowed(s, at + 0.1, noteHz(45), 3.2, 0.07);
  },

  thunder: (s, at) => thunderClap(s, at, 1),

  'door-heavy': (s, at) => {
    creak(s, at, { hz: 105, dur: 1.1, level: 0.16, room: 0.4 });
    ping(s, at + 1.05, { hz: 92, hzTo: 46, level: 0.42, dur: 0.5, room: 0.4 });
    burst(s, at + 1.05, { kind: 'brown', type: 'lowpass', freq: 220, level: 0.26, dur: 0.25, room: 0.35 });
  },

  'footstep-wood': (s, at) => {
    burst(s, at, { kind: 'brown', type: 'lowpass', freq: 240, level: 0.24, dur: 0.09, rate: 0.7 });
    ping(s, at, { hz: 124, hzTo: 82, level: 0.15, dur: 0.08 });
    burst(s, at, { freq: 1400, q: 2, level: 0.05, dur: 0.02 });
  },

  'footstep-stone': (s, at) => {
    burst(s, at, { freq: 900, q: 0.8, level: 0.14, dur: 0.055, room: 0.3 });
    burst(s, at, { kind: 'pink', type: 'highpass', freq: 2600, level: 0.07, dur: 0.045, room: 0.3 });
    ping(s, at, { hz: 95, hzTo: 62, level: 0.1, dur: 0.06 });
  },

  'paper-rustle': (s, at) => {
    for (let i = 0; i < 6; i++) {
      burst(s, at + Math.random() * 0.34, {
        freq: rand(1600, 4200),
        q: rand(0.8, 2),
        level: rand(0.035, 0.09),
        attack: 0.006,
        dur: rand(0.04, 0.1),
        rate: rand(0.9, 1.3),
      });
    }
  },

  chime: (s, at) => {
    // Classic inharmonic bell ratios; the 2.76 partial is what makes it a bell.
    const base = 660;
    for (const [mult, dur, lvl] of [
      [1, 2.8, 0.075],
      [2, 2, 0.03],
      [2.76, 1.5, 0.035],
      [5.4, 0.9, 0.016],
      [8.93, 0.5, 0.008],
    ] as const) {
      ping(s, at, { hz: base * mult, level: lvl, dur, room: 0.7 });
    }
    burst(s, at, { freq: 4200, q: 2, level: 0.05, dur: 0.02, room: 0.4 });
  },

  typewriter: (s, at) => {
    burst(s, at, { freq: 2400, q: 2, level: 0.15, dur: 0.028, room: 0.2 });
    ping(s, at, { hz: 900, level: 0.06, dur: 0.05, room: 0.2 });
    ping(s, at + 0.006, { hz: 155, hzTo: 100, level: 0.14, dur: 0.07 });
    // The escapement spring, only sometimes — that irregularity is the charm.
    if (Math.random() < 0.3) ping(s, at + 0.02, { hz: 3200, level: 0.014, dur: 0.25, room: 0.4 });
  },

  'match-strike': (s, at) => {
    burst(s, at, { freq: 1200, freqTo: 4600, q: 1.8, level: 0.28, attack: 0.008, dur: 0.16, rate: 1.4 });
    // The catch: a soft swell of flame, plus a few first crackles.
    burst(s, at + 0.16, { kind: 'pink', type: 'lowpass', freq: 900, level: 0.16, attack: 0.07, dur: 0.5, room: 0.3 });
    for (let i = 0; i < 5; i++) {
      burst(s, at + 0.18 + Math.random() * 0.4, {
        freq: rand(1800, 5000),
        q: 3,
        level: rand(0.02, 0.06),
        dur: 0.015,
      });
    }
  },
};

// ---------------------------------------------------------------------------
// Music beds
// ---------------------------------------------------------------------------

/**
 * The parameters that distinguish one cue from another.
 *
 * All five cues share a single generator, because they are the same ensemble
 * in different moods: a bowed drone, a sparse music box wandering a mode, and
 * occasional cello swells. Varying mode, register, pulse and density gets far
 * more coherence than writing five unrelated bits of code would.
 */
interface MusicPlan {
  /** Drone root as a MIDI note. */
  root: number;
  /** Modal degrees in semitones above the root. */
  scale: number[];
  /** Intervals above the root sounded continuously by the drone. */
  drone: number[];
  droneLevel: number;
  /** Lowpass on the drone. Darker reads as further away. */
  colour: number;
  /** Offset from the root at which the music box plays. */
  boxRegister: number;
  boxLevel: number;
  /** Seconds between melodic opportunities. */
  pulse: number;
  /** Odds any given opportunity actually sounds; silence is what makes it sparse. */
  density: number;
  /** Mean seconds between cello swells. */
  bowEvery: number;
  bowLevel: number;
  /** Low repeated pulse under everything — pressure, used sparingly. */
  heartbeat?: number;
}

/** Exhaustive over {@link MUSIC_NAMES}; see the note on {@link AMBIENCE}. */
const MUSIC: Record<MusicName, MusicPlan> = {
  // A minor, aeolian, unhurried. The title cue and the default room tone.
  'main-theme': {
    root: 45,
    scale: [0, 2, 3, 5, 7, 8, 10],
    drone: [0, 7, 12],
    droneLevel: 0.075,
    colour: 420,
    boxRegister: 31,
    boxLevel: 0.055,
    pulse: 2.1,
    density: 0.62,
    bowEvery: 11,
    bowLevel: 0.05,
  },
  // D with a flat second and a tritone: the mode itself does the worrying.
  tension: {
    root: 38,
    scale: [0, 1, 3, 5, 6, 8, 10],
    drone: [0, 6],
    droneLevel: 0.085,
    colour: 300,
    boxRegister: 29,
    boxLevel: 0.035,
    pulse: 1.15,
    density: 0.44,
    bowEvery: 8,
    bowLevel: 0.045,
  },
  // Lifted, but still modal — a clue is not a fanfare.
  discovery: {
    root: 48,
    scale: [0, 2, 4, 7, 9, 11],
    drone: [0, 7],
    droneLevel: 0.055,
    colour: 620,
    boxRegister: 26,
    boxLevel: 0.06,
    pulse: 1.55,
    density: 0.72,
    bowEvery: 13,
    bowLevel: 0.035,
  },
  // F# minor, nearly rhythmless: mostly cello and a lot of room.
  sorrow: {
    root: 42,
    scale: [0, 2, 3, 7, 8],
    drone: [0, 3, 7],
    droneLevel: 0.07,
    colour: 340,
    boxRegister: 29,
    boxLevel: 0.045,
    pulse: 3.4,
    density: 0.42,
    bowEvery: 7,
    bowLevel: 0.06,
  },
  // E harmonic minor over a heartbeat. The only cue with a pulse you can feel.
  confrontation: {
    root: 40,
    scale: [0, 2, 3, 5, 7, 8, 11],
    drone: [0, 7, 8],
    droneLevel: 0.09,
    colour: 280,
    boxRegister: 31,
    boxLevel: 0.04,
    pulse: 0.85,
    density: 0.5,
    bowEvery: 9,
    bowLevel: 0.055,
    heartbeat: 1.05,
  },
};

/** Builds one music cue from its plan. */
function buildMusic(r: Rig, plan: MusicPlan): void {
  const lp = r.biquad('lowpass', plan.colour, 1.1);
  const droneGain = r.gain(plan.droneLevel);
  lp.connect(droneGain);
  droneGain.connect(r.input);
  r.lfo(lp.frequency, 0.031, plan.colour * 0.35);
  r.lfo(droneGain.gain, 0.043, plan.droneLevel * 0.35);

  // Two saws a few cents apart per drone note. The beating between them is the
  // difference between "sustained strings" and "one held oscillator".
  for (const interval of plan.drone) {
    const hz = noteHz(plan.root + interval);
    const g = r.gain(1 / plan.drone.length);
    r.osc('sawtooth', hz, -5).connect(g);
    r.osc('sawtooth', hz, 6).connect(g);
    r.osc('sine', hz / 2, 0).connect(g);
    g.connect(lp);
  }

  // Melody: a random walk over the mode, biased back toward the tonic so it
  // wanders without ever losing the key.
  const span = plan.scale.length;
  let step = 0;
  r.every(plan.pulse, (at) => {
    if (Math.random() > plan.density) return;
    step += pick([-3, -2, -1, -1, 1, 1, 2, 3]);
    if (step < 0 || step > span * 2 - 1) step = Math.floor(Math.random() * span);
    const midi =
      plan.root + plan.boxRegister + plan.scale[step % span]! + 12 * Math.floor(step / span);
    musicBox(r.stage, at, noteHz(midi), plan.boxLevel * rand(0.7, 1.15));
    // An occasional shadow a sixth below turns a line into two voices.
    if (Math.random() < 0.2) {
      musicBox(r.stage, at + 0.04, noteHz(midi - 9), plan.boxLevel * 0.4);
    }
  });

  r.every(
    () => plan.bowEvery * rand(0.7, 1.5),
    (at) => {
      const interval = pick(plan.scale);
      bowed(r.stage, at, noteHz(plan.root + 12 + interval), rand(3.5, 6.5), plan.bowLevel);
    },
    rand(1, 4),
  );

  if (plan.heartbeat) {
    r.every(plan.heartbeat, (at) => {
      ping(r.stage, at, {
        hz: noteHz(plan.root - 12),
        hzTo: noteHz(plan.root - 12) * 0.85,
        level: 0.09,
        attack: 0.012,
        dur: 0.38,
        room: 0.35,
      });
    });
  }

  r.roomMix(0.35);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function readLevels(): AudioLevels {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...DEFAULT_LEVELS };
    const p = JSON.parse(raw) as Partial<AudioLevels>;
    return {
      master: clamp01(p.master ?? DEFAULT_LEVELS.master),
      music: clamp01(p.music ?? DEFAULT_LEVELS.music),
      ambience: clamp01(p.ambience ?? DEFAULT_LEVELS.ambience),
      sfx: clamp01(p.sfx ?? DEFAULT_LEVELS.sfx),
      muted: p.muted === true,
    };
  } catch {
    // Private mode, corrupt JSON, no storage at all — defaults are always fine.
    return { ...DEFAULT_LEVELS };
  }
}

function writeLevels(levels: AudioLevels): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(levels));
  } catch {
    /* the mixer simply will not persist; the game still plays */
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

type VoiceChannel = 'music' | 'ambience' | 'sfx';

/** Gestures a browser will accept as consent to make noise. */
const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;

/**
 * Fade used when a bed arrives at wake-up rather than at a room change. Short,
 * because the player has just clicked and is waiting for the world to exist;
 * a 2.6 s dissolve from silence reads as a bug, not as atmosphere.
 */
const WAKE_XFADE = 1.2;

/** How many one-shots may be committed against a not-yet-running clock. */
const PREROLL_LIMIT = 3;

interface ChannelStrip {
  dry: GainNode;
  wet: GainNode;
  studio: Studio;
}

/**
 * The game's whole sound system.
 *
 * No AudioContext exists until {@link unlock} runs inside a user gesture,
 * because a context created before one starts suspended, and every bed built
 * against a frozen clock would detonate simultaneously the moment it resumed.
 *
 * Everything downstream of that follows from one rule: **requests are always
 * accepted, playback is reconciled later**. `setAmbience` and `setMusic` record
 * what the game wants whether or not the clock is running, and
 * {@link reconcile} makes the world match on every wake-up — first unlock, tab
 * return, explicit resume. Content code can therefore call `setAmbience` from a
 * scene's `onEnter` without knowing anything about gesture policy, and a player
 * who tabs out in one room and back in another hears the room they are in.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private kit: NoiseKit | null = null;
  private master: GainNode | null = null;
  private strips: Record<VoiceChannel, ChannelStrip> | null = null;

  private ambienceRig: Rig | null = null;
  private musicRig: Rig | null = null;

  /**
   * What the *game* has asked for, versus what is *actually sounding*.
   *
   * These come apart more often than you would think: every request made while
   * the context is asleep — before the first gesture, and for the whole time
   * the player has the tab in the background — is accepted but cannot be
   * honoured yet. Keeping the two apart is what lets {@link reconcile} put the
   * world right on resume; collapsing them into one field means a player who
   * tabs out in the library and tabs back in the cellar hears the library.
   */
  private wantAmbience: string | null = null;
  private wantMusic: string | null = null;
  private liveAmbience: string | null = null;
  private liveMusic: string | null = null;

  /** Beds mid-fade-out. Tracked only so {@link destroy} can cut them short. */
  private retiring = new Set<Rig>();

  private levelState: AudioLevels = readLevels();
  private listeners = new Set<() => void>();
  private unlocked = false;
  /** Latched once construction fails, so we never retry a hopeless context. */
  private broken = false;
  /** Latched by {@link destroy}, so a stray late gesture cannot resurrect us. */
  private dead = false;
  /**
   * Distinguishes "the tab went away" from "the shell asked for quiet". Without
   * it, tabbing out and back would cheerfully undo an explicit {@link suspend}.
   */
  private autoSuspended = false;
  /** One-shots already committed against a frozen clock; see {@link playSound}. */
  private preroll = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibility);
      // Self-arming unlock. The shell also unlocks from its own first-gesture
      // handler, but that handler unregisters itself immediately and `resume()`
      // is a promise that can reject — if it does, the shell has already thrown
      // away its only chance and the session is silent. These listeners stay
      // until audio is genuinely running, so the *next* click always tries
      // again. They are capture-phase and passive so nothing can swallow them.
      for (const ev of GESTURES) {
        document.addEventListener(ev, this.onGesture, { capture: true, passive: true });
      }
    }
  }

  private onGesture = () => {
    this.unlock();
    if (this.ready) this.disarmGestures();
  };

  private disarmGestures(): void {
    if (typeof document === 'undefined') return;
    for (const ev of GESTURES) {
      document.removeEventListener(ev, this.onGesture, { capture: true });
    }
  }

  // -- lifecycle -----------------------------------------------------------

  /**
   * Resumes (and, on the first call, creates) the AudioContext.
   *
   * Safe and cheap to call on every pointer/key event — browsers silently drop
   * a resume outside a gesture, and the expensive buffer rendering happens
   * exactly once.
   */
  unlock(): void {
    if (this.broken || this.dead) return;
    if (!this.ctx && !this.build()) return;
    const ctx = this.ctx!;
    this.autoSuspended = false;
    if (ctx.state === 'running') {
      this.unlocked = true;
      this.disarmGestures();
      this.reconcile();
      return;
    }
    void ctx
      .resume()
      .then(() => {
        // `destroy()` can land while this promise is in flight.
        if (this.ctx !== ctx) return;
        this.unlocked = true;
        this.disarmGestures();
        this.reconcile();
      })
      .catch(() => {
        /* still gestureless; the next gesture will try again */
      });
  }

  /** True once audio is actually audible — useful for a "click to enable" hint. */
  get ready(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /** Pauses the clock entirely. Beds resume exactly where they left off. */
  suspend(): void {
    this.autoSuspended = false;
    this.doSuspend();
  }

  /** Resumes and, crucially, re-syncs whatever changed while we were asleep. */
  resume(): void {
    this.autoSuspended = false;
    const ctx = this.ctx;
    if (!ctx || !this.unlocked || this.dead) return;
    if (ctx.state === 'running') {
      this.reconcile();
      return;
    }
    void ctx
      .resume()
      .then(() => {
        if (this.ctx !== ctx) return;
        this.reconcile();
      })
      .catch(() => {
        /* the browser wants another gesture; the arming listeners will get it */
      });
  }

  private doSuspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend().catch(() => {});
  }

  /** Tears everything down. Only the page teardown path should need this. */
  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    this.disarmGestures();
    this.ambienceRig?.dispose();
    this.musicRig?.dispose();
    // Beds part-way through a fade-out own a live interval and a pending
    // timeout of their own; nothing else will ever call them again.
    for (const rig of [...this.retiring]) rig.dispose();
    this.retiring.clear();
    this.ambienceRig = null;
    this.musicRig = null;
    this.liveAmbience = null;
    this.liveMusic = null;
    this.listeners.clear();
    const ctx = this.ctx;
    this.ctx = null;
    this.strips = null;
    this.master = null;
    this.kit = null;
    if (ctx) void ctx.close().catch(() => {});
  }

  private onVisibility = () => {
    // A hidden tab should not be paying for convolution, and audio from a game
    // the player has tabbed away from is simply rude. Only undo our own
    // suspension though: if the shell muted the world deliberately, coming back
    // to the tab is not permission to un-mute it.
    if (typeof document === 'undefined' || this.dead) return;
    if (document.hidden) {
      if (this.ctx?.state === 'running') {
        this.autoSuspended = true;
        this.doSuspend();
      }
    } else if (this.autoSuspended) {
      this.resume();
    }
  };

  /** Builds the mixer. Returns false — permanently — if audio is unavailable. */
  private build(): boolean {
    type Legacy = { webkitAudioContext?: typeof AudioContext };
    const Ctor =
      typeof AudioContext !== 'undefined'
        ? AudioContext
        : typeof window !== 'undefined'
          ? (window as unknown as Legacy).webkitAudioContext
          : undefined;
    if (!Ctor) {
      this.broken = true;
      return false;
    }

    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const kit = buildNoiseKit(ctx);

      // A safety limiter, not a compressor for tone. Threshold and knee are set
      // so that it does nothing at all until a thunderclap stacks on top of a
      // storm bed: with the previous -8 dB threshold and an 8 dB knee it began
      // working at -12 dBFS, which is inside the normal operating range of the
      // mix — it was quietly squashing every bed all game.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -3;
      limiter.knee.value = 3;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      limiter.connect(ctx.destination);

      const master = ctx.createGain();
      master.gain.value = this.levelState.muted ? 0 : this.levelState.master;
      master.connect(limiter);

      const convolver = ctx.createConvolver();
      // `normalize` is only consulted when `buffer` is assigned, so it must be
      // set first — the other order silently leaves the browser's equal-power
      // normalisation in charge and makes the wet level engine-dependent. The
      // impulse is already energy-normalised, so the send amounts on individual
      // voices are the only thing deciding how wet anything is.
      convolver.normalize = false;
      convolver.buffer = buildImpulse(ctx);
      const roomReturn = ctx.createGain();
      roomReturn.gain.value = 0.35;
      convolver.connect(roomReturn);
      roomReturn.connect(master);

      const strip = (ch: VoiceChannel): ChannelStrip => {
        const dry = ctx.createGain();
        const wet = ctx.createGain();
        dry.gain.value = this.levelState[ch];
        wet.gain.value = this.levelState[ch];
        dry.connect(master);
        wet.connect(convolver);
        return { dry, wet, studio: { ctx, kit, out: dry, room: wet } };
      };

      this.ctx = ctx;
      this.kit = kit;
      this.master = master;
      this.strips = { music: strip('music'), ambience: strip('ambience'), sfx: strip('sfx') };
      return true;
    } catch {
      this.broken = true;
      return false;
    }
  }

  /**
   * Brings what is sounding into line with what the game asked for.
   *
   * Called on every wake-up, because every `setAmbience`/`setMusic` issued
   * while the clock was frozen was recorded and not acted on. Comparing
   * requested against live also makes the whole thing idempotent, so calling it
   * defensively costs nothing.
   */
  private reconcile(): void {
    if (!this.ready) return;
    if (this.wantAmbience !== this.liveAmbience) {
      this.startAmbience(this.wantAmbience, this.liveAmbience ? AMBIENCE_XFADE : WAKE_XFADE);
    }
    if (this.wantMusic !== this.liveMusic) {
      this.startMusic(this.wantMusic, this.liveMusic ? MUSIC_XFADE : WAKE_XFADE * 2);
    }
  }

  /** Fades a bed out and keeps hold of it only until it has actually gone. */
  private retire(rig: Rig | null, xfade: number): void {
    if (!rig) return;
    this.retiring.add(rig);
    rig.fadeOutAndDispose(xfade, () => this.retiring.delete(rig));
  }

  // -- ambience ------------------------------------------------------------

  /**
   * Cross-fades to a new ambient bed. Unknown names resolve to silence rather
   * than throwing, so a typo in content data costs atmosphere, not the game.
   */
  setAmbience(name: string): void {
    if (name === this.wantAmbience) return;
    this.wantAmbience = name;
    if (!this.ready) return;
    this.startAmbience(name, AMBIENCE_XFADE);
  }

  /** What the game last asked for, which may not be audible yet. */
  get currentAmbience(): string | null {
    return this.wantAmbience;
  }

  private startAmbience(name: string | null, xfade: number): void {
    this.retire(this.ambienceRig, xfade);
    this.ambienceRig = null;
    // Recorded before the early returns: an unknown or absent name *is* the
    // silent bed, and leaving `live` stale would make reconcile() retry it on
    // every wake-up for the rest of the session.
    this.liveAmbience = name;
    const factory = name === null ? undefined : lookup(AMBIENCE, name);
    if (!factory || !this.ctx || !this.kit || !this.strips) return;
    const strip = this.strips.ambience;
    const rig = new Rig(this.kit, this.ctx, strip.dry, strip.wet);
    try {
      factory(rig);
    } catch {
      rig.dispose();
      return;
    }
    rig.fadeIn(xfade);
    this.ambienceRig = rig;
  }

  // -- music ---------------------------------------------------------------

  /** Cross-fades to a music cue, or to nothing when passed `null`. */
  setMusic(name: string | null): void {
    if (name === this.wantMusic) return;
    this.wantMusic = name;
    if (!this.ready) return;
    this.startMusic(name, MUSIC_XFADE);
  }

  /** What the game last asked for, which may not be audible yet. */
  get currentMusic(): string | null {
    return this.wantMusic;
  }

  private startMusic(name: string | null, xfade: number): void {
    this.retire(this.musicRig, xfade);
    this.musicRig = null;
    this.liveMusic = name;
    const plan = name === null ? undefined : lookup(MUSIC, name);
    if (!plan || !this.ctx || !this.kit || !this.strips) return;
    const strip = this.strips.music;
    const rig = new Rig(this.kit, this.ctx, strip.dry, strip.wet);
    try {
      buildMusic(rig, plan);
    } catch {
      rig.dispose();
      return;
    }
    rig.fadeIn(xfade);
    this.musicRig = rig;
  }

  // -- one-shots -----------------------------------------------------------

  /**
   * Fires a one-shot. Unknown names are ignored.
   *
   * The awkward case is the very first sound of the session. Almost every SFX
   * originates in a click, and a click is also a valid unlock gesture — but
   * `resume()` is a promise, so by the strict reading the context is not
   * running yet and the click that starts the game would be the one click in
   * the whole session you cannot hear. Instead we spend the gesture on an
   * unlock *and* commit the voice against the frozen clock, where it will fire
   * a few milliseconds into the resumed timeline. The cap keeps that from
   * turning into a queue: if the context never wakes, at most a handful of
   * voices are waiting, and they arrive as a short flurry rather than a wall.
   */
  playSound(name: string): void {
    const ctx = this.ctx;
    if (this.dead || !ctx || !this.strips) {
      this.unlock();
      return;
    }

    if (ctx.state !== 'running') {
      this.unlock();
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (hidden || this.preroll >= PREROLL_LIMIT) return;
      this.preroll++;
    } else {
      this.preroll = 0;
    }

    const factory = lookup(SFX, name);
    if (!factory) return;
    try {
      // A hair of lead time keeps the envelope's first ramp on the schedule
      // rather than in the past, which is what causes clicks on fast clicks.
      factory(this.strips.sfx.studio, ctx.currentTime + 0.008);
    } catch {
      /* a failed sound must never interrupt gameplay */
    }
  }

  // -- mixer ---------------------------------------------------------------

  /** A snapshot of the mixer, for rendering the settings panel. */
  get levels(): Readonly<AudioLevels> {
    return { ...this.levelState };
  }

  getLevel(channel: AudioChannel): number {
    return this.levelState[channel];
  }

  setLevel(channel: AudioChannel, value: number): void {
    const v = clamp01(value);
    if (this.levelState[channel] === v) return;
    this.levelState[channel] = v;
    this.applyLevels();
    this.persist();
  }

  get muted(): boolean {
    return this.levelState.muted;
  }

  setMuted(muted: boolean): void {
    if (this.levelState.muted === muted) return;
    this.levelState.muted = muted;
    this.applyLevels();
    this.persist();
  }

  toggleMute(): boolean {
    this.setMuted(!this.levelState.muted);
    return this.levelState.muted;
  }

  /** Notifies the settings UI whenever the mixer changes, GameState-style. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private persist(): void {
    writeLevels(this.levelState);
    // A snapshot, because a settings panel closing in response to a change will
    // unsubscribe mid-notify; and each listener is isolated, because this
    // module's whole contract is that a mixer move cannot break the game.
    for (const fn of [...this.listeners]) {
      try {
        fn();
      } catch {
        /* a broken observer is not the mixer's problem */
      }
    }
  }

  private applyLevels(): void {
    if (!this.ctx || !this.master || !this.strips) return;
    const now = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => {
      try {
        p.cancelScheduledValues(now);
        p.setValueAtTime(p.value, now);
        p.linearRampToValueAtTime(v, now + FADER_RAMP);
      } catch {
        /* context gone */
      }
    };
    set(this.master.gain, this.levelState.muted ? 0 : this.levelState.master);
    for (const ch of ['music', 'ambience', 'sfx'] as const) {
      // Dry and wet move together so muting a channel mutes its room tone too.
      set(this.strips[ch].dry.gain, this.levelState[ch]);
      set(this.strips[ch].wet.gain, this.levelState[ch]);
    }
  }
}

/**
 * The engine everyone shares.
 *
 * Audio is inherently a singleton — two AudioContexts would fight over the
 * output device and double every ambient bed — so the app imports this rather
 * than constructing its own.
 */
export const audio = new AudioEngine();
