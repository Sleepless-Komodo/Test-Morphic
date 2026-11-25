import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { setStaggeredInterval } from './staggered-interval';

/** Callbacks see the clock at the end of each step, so they run up to `stepMs` late. */
function fakeClock(t: TestContext) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  return {
    now: () => now,
    advance(totalMs: number, stepMs: number) {
      for (const end = now + totalMs; now < end; ) {
        now += stepMs;
        t.mock.timers.tick(stepMs);
      }
    },
  };
}

test('jobs with the same interval keep their offset on every tick', (t) => {
  const clock = fakeClock(t);
  const a: number[] = [];
  const b: number[] = [];
  setStaggeredInterval(() => a.push(clock.now()), 60_000, 5_000, clock.now);
  setStaggeredInterval(() => b.push(clock.now()), 60_000, 15_000, clock.now);
  clock.advance(200_000, 1_000);
  assert.deepEqual(a, [65_000, 125_000, 185_000]);
  assert.deepEqual(b, [75_000, 135_000, 195_000]);
});

test('late ticks do not accumulate into drift', (t) => {
  const clock = fakeClock(t);
  const ticks: number[] = [];
  setStaggeredInterval(() => ticks.push(clock.now()), 60_000, 10_000, clock.now);
  clock.advance(1_000 * 60_000, 7_000);
  assert.ok(ticks.length >= 998);
  ticks.forEach((at, i) => {
    const late = at - (10_000 + (i + 1) * 60_000);
    assert.ok(late >= 0 && late < 7_000, `tick ${i} late by ${late}`);
  });
});

test('ticks missed during a freeze are skipped, and the schedule stays aligned', (t) => {
  const clock = fakeClock(t);
  const ticks: number[] = [];
  setStaggeredInterval(() => ticks.push(clock.now()), 60_000, 0, clock.now);
  clock.advance(330_000, 330_000);
  assert.deepEqual(ticks, [330_000]);
  clock.advance(60_000, 1_000);
  assert.equal(ticks.length, 2);
  assert.ok(Math.abs(ticks[1]! - 360_000) <= 1_000);
});

test('an interval plus offset beyond the timer limit does not fire early', (t) => {
  const clock = fakeClock(t);
  let runs = 0;
  setStaggeredInterval(() => (runs += 1), 2 ** 31 - 1, 60_000, clock.now);
  clock.advance(60_000, 1_000);
  assert.equal(runs, 0);
});
