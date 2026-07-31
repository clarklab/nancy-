#!/usr/bin/env node
/**
 * Audio regression check.
 *
 * The audio engine is fully procedural, so "it compiles" says nothing about
 * whether it makes a sound. This boots the real engine in Chromium, taps the
 * output by intercepting every connection to `ctx.destination`, and asserts
 * that each bed and one-shot actually moves the signal.
 *
 * Requires the dev server on :5173 (`npm run dev`).
 */

import { chromium } from 'playwright';
import { readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const d of readdirSync(base)
      .filter((x) => /^chromium-\d+$/.test(x))
      .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))) {
      const p = path.join(base, d, 'chrome-linux', 'chrome');
      if (existsSync(p)) return p;
    }
  } catch {
    /* fall back to Playwright's own resolution */
  }
  return undefined;
}

/** A bed is "audible" above this RMS; chosen well below normal output. */
const MIN_RMS = 0.004;
const MIN_SFX_PEAK = 0.008;

const browser = await chromium.launch({
  executablePath: findChromium(),
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 300)));

await page.goto('http://localhost:5173/tools/checks/audio-probe.html', {
  waitUntil: 'domcontentloaded',
});
/**
 * Poll on a timer, not on animation frames.
 *
 * `waitForFunction` defaults to `polling: 'raf'`, and a headless page that is
 * never composited can go long stretches without producing a frame — which
 * shows up here as a timeout whose reported limit is not the one in this call,
 * and sends you hunting for a bug in the probe that is not there. The probe runs
 * for the better part of a minute (three composed tracks, each fetched, faded up
 * and faded down), so it is worth being explicit about both the interval and the
 * budget.
 */
const PROBE_BUDGET_MS = 150_000;
let r = null;
for (const deadline = Date.now() + PROBE_BUDGET_MS; Date.now() < deadline; ) {
  const snap = await page.evaluate(() => window.__r).catch(() => null);
  if (snap?.done) {
    r = snap;
    break;
  }
  await page.waitForTimeout(500);
}

if (!r) {
  // A partial result names the last step that completed, which is the one that
  // hung — far more use than a bare timeout.
  const partial = await page.evaluate(() => window.__r).catch(() => null);
  console.error(`probe did not finish within ${PROBE_BUDGET_MS / 1000}s`);
  console.error('  last steps:', (partial?.steps ?? []).map((s) => s[0]).join(', ') || '(none)');
  if (partial?.err) console.error('  probe error:', partial.err);
  await browser.close();
  process.exit(1);
}
await browser.close();

const failures = [];
if (r.err) failures.push(`engine threw: ${r.err}`);
if (!r.ctxCreated) failures.push('no AudioContext was created');

for (const [name, lvl] of r.steps ?? []) {
  if (name === 'silence') {
    if (lvl.rms > MIN_RMS) failures.push(`silence is not silent (rms ${lvl.rms})`);
  } else if (name !== 'faded-out') {
    if (lvl.rms < MIN_RMS) failures.push(`"${name}" produced no audible signal (rms ${lvl.rms})`);
  }
  console.log(`  ${name.padEnd(18)} rms=${lvl.rms} peak=${lvl.peak}`);
}

for (const [name, peak] of r.sfx ?? []) {
  if (peak < MIN_SFX_PEAK) failures.push(`sfx "${name}" produced no transient (peak ${peak})`);
  console.log(`  sfx ${name.padEnd(14)} peak=${peak}`);
}

/**
 * The composed score is deliberately quiet — beds are normalised to -32 LUFS,
 * which is roughly a tenth of the level of a procedural bed — so it gets its own
 * floor. The point of the assertion is not loudness but routing: a track that
 * reached the speakers without going through the music strip would be inaudible
 * to this tap while still being audible to the player, and would silently stop
 * ducking under dialogue.
 */
const MIN_MUSIC_RMS = 0.0004;

if (r.composed) {
  console.log(`\n  composed score (${(r.composedNames ?? []).length} tracks indexed)`);
  for (const [name, lvl] of r.composed) {
    if (lvl.rms < MIN_MUSIC_RMS) {
      failures.push(`composed track "${name}" produced no signal through the music strip (rms ${lvl.rms})`);
    }
    console.log(`  ${name.padEnd(18)} rms=${lvl.rms} peak=${lvl.peak}`);
  }
}

if (errors.length) console.log('page errors:', errors);

if (failures.length) {
  console.error('\nFAIL:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('\naudio OK');
