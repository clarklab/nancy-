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
await page.waitForFunction(() => window.__r?.done === true, { timeout: 90_000 });
const r = await page.evaluate(() => window.__r);
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

if (errors.length) console.log('page errors:', errors);

if (failures.length) {
  console.error('\nFAIL:\n' + failures.map((f) => '  - ' + f).join('\n'));
  process.exit(1);
}
console.log('\naudio OK');
