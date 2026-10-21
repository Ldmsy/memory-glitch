export const GOAL = Object.freeze({ candies: 12, houses: 3, seconds: 120, hearts: 3 });

export function newRun() {
  return { phase: 'playing', seconds: GOAL.seconds, elapsed: 0, candies: 0,
    visited: [], hits: 0, invulnerable: 2.5, laughCooldown: 0, laughs: 0,
    scared: 0, stamina: 100 };
}

export function advance(run, dt, dashing = false) {
  if (run.phase !== 'playing') return;
  run.elapsed += dt;
  run.seconds = Math.max(0, run.seconds - dt);
  run.laughCooldown = Math.max(0, run.laughCooldown - dt);
  run.invulnerable = Math.max(0, run.invulnerable - dt);
  run.stamina = Math.max(0, Math.min(100, run.stamina + dt * (dashing ? -36 : 21)));
  if (run.seconds === 0) run.phase = 'lost';
}

export function collect(run, amount = 1) {
  if (run.phase !== 'playing' || !Number.isFinite(amount) || amount <= 0) return false;
  run.candies += Math.floor(amount);
  return true;
}

export function visit(run, id) {
  if (run.phase !== 'playing' || run.visited.includes(id)) return false;
  run.visited.push(id);
  collect(run, 3);
  return true;
}

export function laugh(run) {
  if (run.phase !== 'playing' || run.laughCooldown > 0) return false;
  run.laughCooldown = 6;
  run.laughs++;
  return true;
}

export function hit(run) {
  if (run.phase !== 'playing' || run.invulnerable > 0) return false;
  run.hits++;
  run.invulnerable = 3;
  if (run.hits >= GOAL.hearts) run.phase = 'lost';
  return true;
}

export function canEscape(run) {
  return run.candies >= GOAL.candies && run.visited.length >= GOAL.houses;
}

export function escape(run) {
  if (run.phase !== 'playing' || !canEscape(run)) return false;
  run.phase = 'won';
  return true;
}

export function moveWithinArena(position, dx, dz, colliders = [], radius = .65) {
  const blocked = (x, z) => colliders.some(c => Math.hypot(x - c.x, z - c.z) < c.r + radius);
  const x = Math.max(-16.8, Math.min(16.8, position.x + dx));
  const z = Math.max(-12.8, Math.min(14.3, position.z + dz));
  if (!blocked(x, position.z)) position.x = x;
  if (!blocked(position.x, z)) position.z = z;
  return position;
}
