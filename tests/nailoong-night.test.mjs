import test from 'node:test';
import assert from 'node:assert/strict';
import { newRun, advance, collect, visit, laugh, hit, escape, moveWithinArena } from '../dist/nailoong-night/rules.js';

test('escape needs both candy and all three houses; houses cannot be farmed', () => {
  const run = newRun();
  collect(run, 12);
  assert.equal(escape(run), false);
  for (const id of ['candy', 'potion', 'costume']) {
    assert.equal(visit(run, id), true);
    assert.equal(visit(run, id), false);
  }
  assert.equal(run.candies, 21);
  assert.equal(escape(run), true);
  assert.equal(collect(run), false);
});
test('laughter cannot spam and paused time does not consume its cooldown or clock', () => {
  const run = newRun();
  assert.equal(laugh(run), true);
  assert.equal(laugh(run), false);
  run.phase = 'paused';
  advance(run, 30);
  assert.equal(run.seconds, 120);
  assert.equal(run.laughCooldown, 6);
  run.phase = 'playing';
  advance(run, 6);
  assert.equal(laugh(run), true);
});
test('contact has a grace period and three separated hits end a run', () => {
  const run = newRun();
  assert.equal(hit(run), false);
  for (let i = 0; i < 3; i++) {
    advance(run, 3.1);
    assert.equal(hit(run), true);
    assert.equal(hit(run), false);
  }
  assert.equal(run.phase, 'lost');
});
test('timeout and stamina remain bounded, and finished state is immutable through ticks', () => {
  const run = newRun();
  advance(run, 150, true);
  assert.equal(run.seconds, 0);
  assert.equal(run.stamina, 0);
  assert.equal(run.phase, 'lost');
  const snapshot = structuredClone(run);
  advance(run, 2);
  assert.deepEqual(run, snapshot);
});
test('movement slides along obstacles and cannot leave the arena', () => {
  const p = {x: 0, z: 0};
  moveWithinArena(p, 1, 1, [{x: 1, z: 0, r: .5}]);
  assert.equal(p.x, 0);
  assert.equal(p.z, 1);
  moveWithinArena(p, -100, 100);
  assert.equal(p.x, -16.8);
  assert.equal(p.z, 14.3);
});
