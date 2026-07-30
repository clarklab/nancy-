/**
 * Narration overlay: spoken lines, the detective's interior voice, item
 * close-ups, and act title cards.
 *
 * These are the beats that pace the game, so every one of them blocks until
 * the player acknowledges it. The distinction between `say` and `think` is
 * deliberate and visual — dialogue is on paper, thought is unbounded and
 * italic, floating in the dark.
 */

import type { Act } from '@/engine/types';

type Resolver = () => void;

export class Narration {
  private root: HTMLElement;
  private current: Resolver | null = null;
  /** Set while text is still revealing, so a click completes instead of advancing. */
  private completeReveal: (() => void) | null = null;
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  /**
   * Screenshot/automation mode.
   *
   * Narration deliberately blocks until the player acknowledges it — that is
   * how the game paces itself. An automated harness has nobody to click, so a
   * scene's arrival beat would hang `goto()` forever. In this mode each panel
   * still renders (so it can be captured) but settles on a timer instead of an
   * input.
   */
  private autoAdvanceMs: number | null = null;

  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'narration-root';
    this.root.addEventListener('click', () => this.advance());
    this.onKey = this.onKey.bind(this);
  }

  mount(parent: HTMLElement) {
    parent.appendChild(this.root);
    window.addEventListener('keydown', this.onKey);
  }

  private onKey(ev: KeyboardEvent) {
    if (!this.current) return;
    if (ev.key === ' ' || ev.key === 'Enter' || ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      this.advance();
    }
  }

  private advance() {
    if (this.completeReveal) {
      // First click finishes the typewriter; a second one moves on.
      this.completeReveal();
      this.completeReveal = null;
      return;
    }
    this.current?.();
  }

  /** Spoken narration or an off-screen voice, rendered on paper. */
  async say(lines: string[], speaker?: string) {
    for (const line of lines) {
      await this.showPanel(line, { mode: 'say', speaker });
    }
  }

  /** The protagonist's interior voice. */
  async think(lines: string[]) {
    for (const line of lines) {
      await this.showPanel(line, { mode: 'think' });
    }
  }

  private showPanel(
    line: string,
    opts: { mode: 'say' | 'think'; speaker?: string },
  ): Promise<void> {
    return new Promise((resolve) => {
      const panel = document.createElement('div');
      panel.className = `narration-panel is-${opts.mode}`;
      panel.setAttribute('role', 'status');

      if (opts.speaker) {
        const name = document.createElement('span');
        name.className = 'narration-speaker';
        name.textContent = opts.speaker;
        panel.appendChild(name);
      }

      const body = document.createElement('p');
      body.className = 'narration-text';
      panel.appendChild(body);

      const caret = document.createElement('span');
      caret.className = 'narration-caret';
      caret.setAttribute('aria-hidden', 'true');
      panel.appendChild(caret);

      this.root.classList.add('is-active');
      this.root.appendChild(panel);
      requestAnimationFrame(() => panel.classList.add('is-in'));

      const finish = () => {
        this.current = null;
        this.completeReveal = null;
        panel.classList.remove('is-in');
        panel.classList.add('is-out');
        const cleanup = () => {
          panel.remove();
          if (!this.root.children.length) this.root.classList.remove('is-active');
          resolve();
        };
        // Fall back to a timer in case the transition never fires (tab hidden).
        panel.addEventListener('transitionend', cleanup, { once: true });
        setTimeout(cleanup, 400);
      };

      const stop = typewrite(body, line, this.reduced, () => {
        this.completeReveal = null;
        panel.classList.add('is-ready');
      });
      this.completeReveal = stop;
      this.current = finish;

      if (this.autoAdvanceMs !== null) {
        // Complete the reveal immediately so the captured frame shows the
        // whole line, then dismiss after the configured dwell.
        stop();
        this.completeReveal = null;
        setTimeout(finish, this.autoAdvanceMs);
      }
    });
  }

  /** Full-screen close-up of an inventory object. */
  examine(name: string, text: string, image?: string): Promise<void> {
    return new Promise((resolve) => {
      const view = document.createElement('div');
      view.className = 'examine-view';
      view.setAttribute('role', 'dialog');
      view.setAttribute('aria-label', `Examining ${name}`);
      view.innerHTML = `
        <div class="examine-plate">
          ${image ? `<img class="examine-image" src="${image}" alt="${escapeAttr(name)}" />` : ''}
          <div class="examine-body">
            <h2 class="examine-title"></h2>
            <p class="examine-text"></p>
          </div>
          <button class="examine-close" type="button" aria-label="Put it away">Put it away</button>
        </div>`;

      view.querySelector('.examine-title')!.textContent = name;
      view.querySelector('.examine-text')!.textContent = text;

      const close = () => {
        this.current = null;
        window.removeEventListener('keydown', esc);
        view.classList.add('is-out');
        setTimeout(() => {
          view.remove();
          if (!this.root.children.length) this.root.classList.remove('is-active');
          resolve();
        }, 300);
      };
      const esc = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          ev.stopPropagation();
          close();
        }
      };

      view.querySelector<HTMLButtonElement>('.examine-close')!.addEventListener('click', (ev) => {
        ev.stopPropagation();
        close();
      });
      window.addEventListener('keydown', esc);

      this.root.classList.add('is-active');
      this.root.appendChild(view);
      requestAnimationFrame(() => view.classList.add('is-in'));
      view.querySelector<HTMLButtonElement>('.examine-close')!.focus();
      // Swallow the root click handler so the panel does not self-dismiss.
      this.current = null;
      view.addEventListener('click', (ev) => ev.stopPropagation());
    });
  }

  /** The between-acts title card. */
  actCard(act: Act): Promise<void> {
    return new Promise((resolve) => {
      const card = document.createElement('div');
      card.className = 'act-card';
      card.innerHTML = `
        <div class="act-card-inner">
          <span class="act-card-number"></span>
          <h2 class="act-card-title"></h2>
          <div class="act-card-rule" aria-hidden="true"></div>
          <p class="act-card-epigraph"></p>
        </div>`;

      card.querySelector('.act-card-number')!.textContent = `Act ${toRoman(act.number)}`;
      card.querySelector('.act-card-title')!.textContent = act.title;
      card.querySelector('.act-card-epigraph')!.textContent = act.epigraph ?? act.goal;

      this.root.classList.add('is-active');
      this.root.appendChild(card);
      requestAnimationFrame(() => card.classList.add('is-in'));

      const hold = this.autoAdvanceMs !== null ? this.autoAdvanceMs : this.reduced ? 900 : 4200;
      const done = () => {
        card.classList.remove('is-in');
        card.classList.add('is-out');
        setTimeout(() => {
          card.remove();
          if (!this.root.children.length) this.root.classList.remove('is-active');
          resolve();
        }, 700);
      };
      const timer = setTimeout(done, hold);
      // Let an impatient player move on, but do not make it feel skippable-by-accident.
      card.addEventListener(
        'click',
        () => {
          clearTimeout(timer);
          done();
        },
        { once: true },
      );
    });
  }

  /**
   * Enables timer-based dismissal for the screenshot harness.
   *
   * @param ms Dwell per panel, or `null` to restore normal click-to-advance.
   */
  setAutoAdvance(ms: number | null) {
    this.autoAdvanceMs = ms;
  }

  destroy() {
    window.removeEventListener('keydown', this.onKey);
    this.root.remove();
  }
}

/**
 * Reveals text character by character. Returns a function that completes the
 * reveal immediately — the "click to finish the line" affordance every
 * adventure game needs.
 */
function typewrite(
  el: HTMLElement,
  text: string,
  reduced: boolean,
  onDone: () => void,
): () => void {
  if (reduced) {
    el.textContent = text;
    onDone();
    return () => {};
  }

  let i = 0;
  let raf = 0;
  let last = performance.now();
  // ~34ms per character reads as "spoken" without testing patience.
  const perChar = 34;

  const tick = (now: number) => {
    const due = Math.floor((now - last) / perChar);
    if (due > 0) {
      i = Math.min(text.length, i + due);
      last = now;
      el.textContent = text.slice(0, i);
    }
    if (i < text.length) {
      raf = requestAnimationFrame(tick);
    } else {
      onDone();
    }
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    el.textContent = text;
    onDone();
  };
}

function toRoman(n: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  let v = n;
  for (const [val, sym] of map) {
    while (v >= val) {
      out += sym;
      v -= val;
    }
  }
  return out || 'I';
}

function escapeAttr(s: string) {
  return s.replace(/"/g, '&quot;');
}
