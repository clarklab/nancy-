/**
 * Voice-over playback.
 *
 * Recorded lines are streamed with a plain `HTMLAudioElement` rather than
 * being routed through the WebAudio graph in `audio.ts`. Dialogue audio is
 * long, played one at a time, and never needs filtering or convolution — and
 * an `<audio>` element streams it instead of decoding several megabytes into
 * memory before the first word.
 *
 * Two behaviours matter for it to feel like a shipped game rather than a
 * soundboard:
 *
 *   - **Ducking.** Ambience and music step back while someone is speaking and
 *     come back afterwards, so a storm bed never competes with a whisper.
 *   - **Barge-in.** Starting a new line always stops the previous one. Players
 *     click through dialogue faster than it plays, and overlapping voices are
 *     the fastest way to sound cheap.
 */

import { audio } from './audio';

/** Where `tools/generate-voice.mjs` writes its output. */
const VO_BASE = './audio/vo';

/** How far ambience and music drop while a line plays. */
const DUCK_TO = 0.35;
const DUCK_MS = 260;
const UNDUCK_MS = 700;

export interface VoiceLineHandle {
  /** Resolves when the line finishes, is skipped, or fails to load. */
  done: Promise<void>;
  /** Stops immediately and resolves `done`. */
  stop(): void;
}

class VoiceEngine {
  private el: HTMLAudioElement | null = null;
  private current: { stop: () => void } | null = null;
  private volume = 1;
  private enabled = true;
  /** Whether the beds are currently held back for a line. */
  private ducked = false;
  private duckTimer = 0;
  /** Lines known to exist, from the generated index. */
  private available: Set<string> | null = null;

  /** Registers which line ids have audio, so misses are silent, not 404s. */
  setAvailable(ids: Iterable<string>) {
    this.available = new Set(ids);
  }

  has(lineId: string): boolean {
    return this.enabled && (this.available?.has(lineId) ?? false);
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.el) this.el.volume = this.volume;
  }

  setEnabled(on: boolean) {
    this.enabled = on;
    if (!on) this.stop();
  }

  /**
   * Plays a line. Always resolves — a missing file must never stall the
   * dialogue chain, because the text is the source of truth and the audio is
   * an enhancement.
   */
  play(lineId: string): VoiceLineHandle {
    this.stop();

    if (!this.has(lineId)) {
      return { done: Promise.resolve(), stop: () => {} };
    }

    const el = new Audio(`${VO_BASE}/${lineId}.mp3`);
    el.volume = this.volume;
    el.preload = 'auto';
    this.el = el;

    let settle!: () => void;
    const done = new Promise<void>((resolve) => {
      settle = resolve;
    });

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      el.onended = null;
      el.onerror = null;
      el.pause();
      if (this.el === el) this.el = null;
      if (this.current === handle) this.current = null;
      this.unduck();
      settle();
    };

    const handle = { stop: finish };
    this.current = handle;

    el.onended = finish;
    el.onerror = finish;

    this.duck();
    // Autoplay can still be blocked if no gesture has happened yet; treat a
    // rejected play() exactly like a finished line.
    void el.play().catch(finish);

    return { done, stop: finish };
  }

  stop() {
    this.current?.stop();
  }

  private duck() {
    clearTimeout(this.duckTimer);
    if (this.ducked) return;
    this.ducked = true;
    audio.duck('music', DUCK_TO, DUCK_MS);
    audio.duck('ambience', DUCK_TO, DUCK_MS);
  }

  private unduck() {
    if (!this.ducked) return;
    this.ducked = false;
    // A short hold stops rapid-fire lines from pumping the bed up and down
    // between every sentence of a multi-line reply.
    this.duckTimer = window.setTimeout(() => {
      if (this.ducked) return;
      audio.clearDucks(UNDUCK_MS);
    }, 140);
  }
}

export const voice = new VoiceEngine();
