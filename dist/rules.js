export const LIMIT = 42;
export const houses = Array.from({ length: 8 }, (_, i) => ({
  x: i < 4 ? -16 : 16,
  z: [-25, -9, 7, 23][i % 4],
  w: 12,
  d: 10,
  side: i < 4 ? 1 : -1,
}));
export const obstacles = houses.map((h) => ({
  x: h.x,
  z: h.z,
  w: h.w,
  d: h.d,
}));
export function blocked(x, z, r = 0.45) {
  return (
    Math.abs(x) > LIMIT - r ||
    Math.abs(z) > LIMIT - r ||
    obstacles.some(
      (o) => Math.abs(x - o.x) < o.w / 2 + r && Math.abs(z - o.z) < o.d / 2 + r,
    )
  );
}
export function clearLine(a, b) {
  const n = Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) * 3);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (blocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.1))
      return false;
  }
  return true;
}
export function move(pos, dx, dz, r = 0.45) {
  if (!blocked(pos.x + dx, pos.z, r)) pos.x += dx;
  if (!blocked(pos.x, pos.z + dz, r)) pos.z += dz;
}
export function route(start, end) {
  const step = 2,
    size = 41,
    toCell = (v) =>
      Math.max(0, Math.min(size - 1, Math.round((v + 40) / step))),
    key = (x, z) => z * size + x;
  const sx = toCell(start.x),
    sz = toCell(start.z),
    ex = toCell(end.x),
    ez = toCell(end.z),
    goal = key(ex, ez),
    first = key(sx, sz);
  let open = [first],
    seen = new Set([first]),
    parent = new Map();
  while (open.length) {
    const k = open.shift(),
      x = k % size,
      z = Math.floor(k / size);
    if (k === goal) {
      let p = [],
        v = k;
      while (v !== first) {
        p.push({
          x: (v % size) * step - 40,
          z: Math.floor(v / size) * step - 40,
        });
        v = parent.get(v);
      }
      return p.reverse();
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        nz = z + dz,
        nk = key(nx, nz);
      if (
        nx < 0 ||
        nz < 0 ||
        nx >= size ||
        nz >= size ||
        seen.has(nk) ||
        blocked(nx * step - 40, nz * step - 40, 0.7)
      )
        continue;
      seen.add(nk);
      parent.set(nk, k);
      open.push(nk);
    }
  }
  return [];
}
export function doorReward(kind, candies) {
  return Math.min(5, candies + (kind === "trick" ? 2 : 1));
}
