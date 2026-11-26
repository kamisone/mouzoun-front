#!/usr/bin/env node
/**
 * Order check: proves that the shop, shop-section, guest-deposit and consent specs pass whatever
 * ran before them. Playwright orders files itself, so one invocation cannot run "shop, then
 * shop-section" and the reverse; this script runs one spec per invocation, one worker, against
 * the same database (no reset in between), in a sequence where every ordered pair of the four
 * specs appears back to back once (12 pairs in 13 runs).
 *
 *   E2E_STAFF_EMAIL=… E2E_STAFF_PASSWORD=… node tests/fullstack/scripts/order-check.mjs
 *
 * Needs the full-stack stack running (tests/fullstack/scripts/stack.sh) and a built front.
 * Exits non-zero if any run fails, after printing every pair with its result.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const front = fileURLToPath(new URL('../../..', import.meta.url))
const SPECS = {
  'shop': ['tests/fullstack/shop.spec.ts', '--project=shop-state'],
  'shop-section': ['tests/fullstack/shop-section.spec.ts', '--project=shop-state'],
  'guest-deposit': ['tests/fullstack/guest.spec.ts', '--project=fr-desktop', '--project=ar-mobile', '-g', 'deposit paid online'],
  'consent': ['tests/fullstack/consent.spec.ts', '--project=consent'],
}
// An Eulerian circuit of the complete directed graph on the four specs.
const SEQUENCE = ['shop', 'shop-section', 'guest-deposit', 'consent', 'shop', 'guest-deposit', 'shop-section', 'consent', 'guest-deposit', 'shop', 'consent', 'shop-section', 'shop']

for (const name of ['E2E_STAFF_EMAIL', 'E2E_STAFF_PASSWORD']) {
  if (!process.env[name]) {
    console.error(`order-check: set ${name}`)
    process.exit(2)
  }
}

const results = []
for (const [i, name] of SEQUENCE.entries()) {
  const run = spawnSync('npx', ['playwright', 'test', '-c', 'playwright.fullstack.config.ts', '--workers=1', '--reporter=line', ...SPECS[name]], { cwd: front, encoding: 'utf8' })
  const ok = run.status === 0
  const summary = (run.stdout.match(/^\s+\d+ (passed|failed|flaky).*$/gm) ?? []).map(s => s.trim()).join(', ')
  results.push({ name, ok })
  console.log(`${String(i + 1).padStart(2)}. ${name.padEnd(14)} ${ok ? 'ok  ' : 'FAIL'} ${summary}${i ? `   (after ${SEQUENCE[i - 1]})` : ''}`)
  if (!ok) console.log(run.stdout.split('\n').filter(l => /✘|Error:|Expected|Received/.test(l)).slice(0, 12).join('\n'))
}

const pairs = new Set()
for (let i = 1; i < SEQUENCE.length; i++) pairs.add(`${SEQUENCE[i - 1]} → ${SEQUENCE[i]}`)
const failed = results.filter(r => !r.ok)
console.log(`\n${pairs.size} ordered pairs covered; ${results.length - failed.length}/${results.length} runs passed.`)
process.exit(failed.length ? 1 : 0)
