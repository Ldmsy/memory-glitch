import * as THREE from '../vendor/three.module.js';

// All scenery is local geometry. Repeated stones, lights and pumpkins are batched.
const C = { grass: 0x183c38, edge: 0x102d31, wood: 0x49372e, pale: 0xe9d8ac, orange: 0xf69437, violet: 0x514568, mint: 0x8cddb0, ink: 0x19252b };
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: .82, ...extra });
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(1, 20, 14),
  cylinder: new THREE.CylinderGeometry(1, 1, 1, 12),
  cone: new THREE.ConeGeometry(1, 1, 12),
  stone: new THREE.DodecahedronGeometry(1, 0),
};
const tri = new THREE.Shape(); tri.moveTo(-.5, 0); tri.lineTo(.5, 0); tri.lineTo(0, 1); tri.closePath();
G.triangle = new THREE.ShapeGeometry(tri);
const mouth = new THREE.Shape(); mouth.moveTo(-.5, .15); mouth.lineTo(-.3, -.08); mouth.lineTo(-.12, .04); mouth.lineTo(0, -.14); mouth.lineTo(.14, .04); mouth.lineTo(.32, -.08); mouth.lineTo(.5, .15); mouth.lineTo(.32, -.3); mouth.lineTo(-.3, -.3); mouth.closePath();
G.mouth = new THREE.ShapeGeometry(mouth);
G.pumpkin = new THREE.SphereGeometry(1, 32, 20);
const pp = G.pumpkin.attributes.position;
for (let i = 0; i < pp.count; i++) {
  const x = pp.getX(i), y = pp.getY(i), z = pp.getZ(i), k = 1 + .065 * Math.cos(Math.atan2(z, x) * 9);
  pp.setXYZ(i, x * k, y * .82, z * k);
}
G.pumpkin.computeVertexNormals();

function mesh(geo, material, parent, p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, material); m.position.set(...p); m.scale.set(...s); m.rotation.set(...r); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
}
function beam(parent, material, a, b, radius = .1) {
  const v1 = new THREE.Vector3(...a), v2 = new THREE.Vector3(...b), delta = v2.clone().sub(v1);
  const m = mesh(G.cylinder, material, parent, v1.clone().add(v2).multiplyScalar(.5).toArray(), [radius, delta.length(), radius]);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()); return m;
}
function sign(text, subtitle, width = 3.6, height = 1.05) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 256;
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#ead7a3'; ctx.fillRect(0, 0, 768, 256);
  ctx.strokeStyle = '#63432e'; ctx.lineWidth = 12; ctx.strokeRect(13, 13, 742, 230);
  ctx.fillStyle = '#3c2b32'; ctx.textAlign = 'center'; ctx.font = '900 72px Georgia, serif'; ctx.fillText(text, 384, 118);
  ctx.fillStyle = '#8d4e31'; ctx.font = 'bold 29px sans-serif'; ctx.fillText(subtitle, 384, 181);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, roughness: .95, emissive: 0x735027, emissiveIntensity: .13 })); return m;
}
function seeded(seed) { let n = seed >>> 0; return () => { n = (1664525 * n + 1013904223) >>> 0; return n / 4294967296; }; }

export function createGhost(color = 0xc6e7e4) {
  const group = new THREE.Group(); const cloth = mat(color, { roughness: .53 }); const eyes = mat(0x152833);
  const body = new THREE.LatheGeometry([
    new THREE.Vector2(0, 1.8), new THREE.Vector2(.3, 1.76), new THREE.Vector2(.52, 1.55),
    new THREE.Vector2(.62, 1.15), new THREE.Vector2(.61, .65), new THREE.Vector2(.72, .23), new THREE.Vector2(.3, .24), new THREE.Vector2(0, .25),
  ], 28);
  mesh(body, cloth, group);
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    mesh(G.sphere, cloth, group, [Math.cos(angle) * .45, .25, Math.sin(angle) * .45], [.29, .16, .29]);
  }
  mesh(G.sphere, eyes, group, [-.22, 1.25, .546], [.075, .115, .045]);
  mesh(G.sphere, eyes, group, [.22, 1.25, .546], [.075, .115, .045]);
  mesh(G.sphere, eyes, group, [0, .95, .603], [.09, .115, .022]);
  const armL = mesh(G.sphere, cloth, group, [-.7, .96, .05], [.35, .15, .18], [0, 0, -.55]);
  const armR = mesh(G.sphere, cloth, group, [.7, .96, .05], [.35, .15, .18], [0, 0, .55]);
  const hat = new THREE.Group(); hat.position.set(.12, 1.72, 0); hat.rotation.z = -.22; group.add(hat);
  const plum = mat(0x564064); mesh(G.cylinder, plum, hat, [0, .01, 0], [.5, .07, .5]);
  mesh(G.cone, plum, hat, [0, .36, 0], [.31, .75, .31]); mesh(G.cylinder, mat(C.orange), hat, [0, .1, 0], [.285, .12, .285]);
  group.userData.arms = [armL, armR]; return group;
}

export function createFestival(scene) {
  const root = new THREE.Group(); root.name = 'Halloween lantern market'; scene.add(root);
  const materials = {
    grass: mat(C.grass), edge: mat(C.edge), darkWood: mat(C.wood), cream: mat(C.pale),
    roof: mat(C.violet), orange: mat(C.orange), black: mat(C.ink), leaf: mat(0x52705a),
    stone: mat(0xb9b49b), stone2: mat(0xd1cbb1), gold: mat(0xd5a257, { metalness: .28, roughness: .5 }),
    glow: mat(0xffc773, { emissive: 0xffa348, emissiveIntensity: 1.6 }),
    mintGlow: mat(C.mint, { emissive: 0x62c798, emissiveIntensity: .8 }),
    pumpkin: mat(0xed7e2c), stem: mat(0x66543a),
  };
  const batches = new Map(); const dummy = new THREE.Object3D();
  function batch(geoKey, materialKey, p, s = [1, 1, 1], r = [0, 0, 0]) {
    const key = `${geoKey}/${materialKey}`;
    if (!batches.has(key)) batches.set(key, { geo: G[geoKey], material: materials[materialKey], matrices: [] });
    dummy.position.set(...p); dummy.scale.set(...s); dummy.rotation.set(...r); dummy.updateMatrix(); batches.get(key).matrices.push(dummy.matrix.clone());
  }
  function flush() { for (const { geo, material, matrices } of batches.values()) {
    const inst = new THREE.InstancedMesh(geo, material, matrices.length); matrices.forEach((m, i) => inst.setMatrixAt(i, m)); inst.castShadow = true; inst.receiveShadow = true; root.add(inst);
  } }
  function pumpkin(x, z, size = .65, y = 0, turn = 0) {
    const point = (dx, dy, dz) => [x + dx * Math.cos(turn) + dz * Math.sin(turn), y + dy, z - dx * Math.sin(turn) + dz * Math.cos(turn)];
    batch('pumpkin', 'pumpkin', point(0, size * .78, 0), [size, size, size]);
    batch('cylinder', 'stem', point(.04 * size, 1.65 * size, 0), [.12 * size, .38 * size, .12 * size], [0, 0, -.2]);
    for (const side of [-1, 1]) batch('triangle', 'glow', point(side * .32 * size, .87 * size, .85 * size), [.3 * size, .34 * size, 1], [0, turn, side * -.16]);
    batch('mouth', 'glow', point(0, .54 * size, .94 * size), [.8 * size, .6 * size, 1], [0, turn, 0]);
  }
  const land = new THREE.Shape(), w = 19.4, d = 17.8, rad = 4;
  land.moveTo(-w + rad, -d); land.lineTo(w - rad, -d); land.quadraticCurveTo(w, -d, w, -d + rad);
  land.lineTo(w, d - rad); land.quadraticCurveTo(w, d, w - rad, d); land.lineTo(-w + rad, d); land.quadraticCurveTo(-w, d, -w, d - rad);
  land.lineTo(-w, -d + rad); land.quadraticCurveTo(-w, -d, -w + rad, -d);
  const base = new THREE.ExtrudeGeometry(land, { depth: 1.2, bevelEnabled: true, bevelSize: .6, bevelThickness: .25, bevelSegments: 3, steps: 1 });
  mesh(base, materials.edge, root, [0, -1.4, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  const top = new THREE.ShapeGeometry(land, 20); mesh(top, materials.grass, root, [0, -.035, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  // Soft-edged slate plaza and branching cobbles keep the walking surface legible.
  mesh(new THREE.CylinderGeometry(5.1, 5.1, .06, 64), mat(0x31504a), root, [0, -.005, .8]);
  const rng = seeded(31);
  const paths = [[-11, -6], [0, -10], [11, -6], [0, 13]];
  for (const [ex, ez] of paths) {
    const length = Math.hypot(ex, ez - .8), rows = Math.ceil(length / .9);
    for (let row = 0; row <= rows; row++) for (let col = -1; col <= 1; col++) {
      const t = row / rows, x = ex * t, z = .8 + (ez - .8) * t, nx = -(ez - .8) / length, nz = ex / length;
      batch('stone', (row + col) % 3 ? 'stone' : 'stone2', [x + nx * col * .7 + (rng() - .5) * .18, .035, z + nz * col * .7 + (rng() - .5) * .18], [.38 + rng() * .12, .075, .34 + rng() * .1], [0, rng() * Math.PI, 0]);
    }
  }
  for (let i = 0; i < 42; i++) {
    const a = i / 42 * Math.PI * 2;
    batch('stone', 'stone2', [Math.cos(a) * 5, .03, .8 + Math.sin(a) * 5], [.31, .08, .24], [0, -a, 0]);
  }
  const colliders = [];
  // Perimeter pickets and low cross rails, with a clear front opening.
  for (const side of [-1, 1]) for (let z = -11; z <= 12; z += 1.5) {
    batch('box', 'darkWood', [side * 18, .7, z], [.2, 1.5, .2]);
    batch('cone', 'gold', [side * 18, 1.55, z], [.15, .24, .15]);
    if (z < 12) for (const y of [.45, 1.05]) batch('box', 'darkWood', [side * 18, y, z + .75], [.12, .13, 1.5]);
  }
  for (const side of [-1, 1]) for (let x = 5; x <= 17; x += 1.5) {
    batch('box', 'darkWood', [side * x, .7, 15.5], [.2, 1.5, .2]);
    for (const y of [.45, 1.05]) batch('box', 'darkWood', [side * (x + .7), y, 15.5], [1.4, .13, .12]);
  }
  const stations = [], lanterns = [], smoke = [];
  function house(id, label, signText, ix, iz, roofColor, number) {
    const group = new THREE.Group(); group.position.set(ix, 0, iz - 4); root.add(group);
    const wall = mat(0xb2a17d), roofMat = mat(roofColor), roofTrim = mat(0x2c3437);
    mesh(G.box, materials.darkWood, group, [0, .22, 0], [5.3, .42, 4.6]);
    mesh(G.box, wall, group, [0, 2.1, 0], [4.5, 3.8, 3.8]);
    for (const x of [-2.3, 2.3]) for (const z of [-1.95, 1.95]) mesh(G.box, materials.darkWood, group, [x, 2.15, z], [.23, 4, .23]);
    // Two pitched roof planes and exposed rafters.
    for (const side of [-1, 1]) {
      mesh(G.box, roofMat, group, [side * 1.37, 4.65, 0], [3.1, .24, 5], [0, 0, side * -.49]);
      for (const z of [-2.48, 2.48]) mesh(G.box, roofTrim, group, [side * 1.37, 4.65, z], [3.2, .22, .18], [0, 0, side * -.49]);
      for (let row = 0; row < 3; row++) mesh(G.box, roofTrim, group, [side * (.45 + row * .85), 5.16 - row * .46, 0], [.09, .08, 4.95], [0, 0, side * -.49]);
    }
    mesh(G.box, roofTrim, group, [0, 5.4, 0], [.24, .24, 5.1]);
    mesh(G.triangle, wall, group, [0, 4, 1.94], [4.5, 1.4, 1]);
    mesh(G.triangle, wall, group, [0, 4, -1.94], [4.5, 1.4, 1], [0, Math.PI, 0]);
    mesh(new THREE.CircleGeometry(.25, 20), materials.glow, group, [0, 4.65, 1.96]);
    mesh(new THREE.TorusGeometry(.28, .045, 6, 20), materials.darkWood, group, [0, 4.65, 1.99]);
    mesh(G.box, materials.darkWood, group, [0, 1.55, 1.98], [1.3, 2.9, .15]);
    mesh(G.box, mat(0x654b39), group, [0, 1.45, 2.09], [.96, 2.55, .1]);
    mesh(G.sphere, materials.gold, group, [.3, 1.4, 2.18], [.08, .08, .08]);
    for (const x of [-1.5, 1.5]) {
      mesh(G.box, materials.darkWood, group, [x, 2.25, 1.99], [1.05, 1.55, .15]);
      mesh(G.box, materials.glow, group, [x, 2.25, 2.08], [.78, 1.24, .04]);
      mesh(G.box, materials.darkWood, group, [x, 2.25, 2.13], [.08, 1.3, .05]); mesh(G.box, materials.darkWood, group, [x, 2.25, 2.13], [.85, .08, .05]);
    }
    mesh(G.box, materials.darkWood, group, [0, 3.65, 2.24], [4.2, .98, .16]);
    const plaque = sign(signText, `STALL 0${number} · ONE SWEET DEAL`, 3.92, .93); plaque.position.set(0, 3.65, 2.34); group.add(plaque);
    mesh(G.box, materials.cream, group, [0, .1, 2.6], [2.5, .2, .7]);
    mesh(G.box, materials.orange, group, [0, 3.03, 2.72], [4.2, .13, 1.35], [-.15, 0, 0]);
    for (let k = -2; k <= 2; k++) mesh(G.triangle, k % 2 ? materials.roof : materials.cream, group, [k * .68, 2.86, 3.35], [.5, -.43, 1]);
    pumpkin(ix - 2.65, iz - 1.4, .57); pumpkin(ix + 2.7, iz - 1.7, .84);
    const light = new THREE.PointLight(0xffc178, 8, 7, 2); light.position.set(ix, 2.8, iz - 1.1); root.add(light); lanterns.push(light);
    colliders.push({ x: ix, z: iz - 4, r: 2.7 });
    const markerMaterial = new THREE.MeshStandardMaterial({ color: 0xffd28a, emissive: 0xffa23f, emissiveIntensity: .8, roughness: .5, transparent: true, opacity: .9, side: THREE.DoubleSide });
    const marker = new THREE.Group(); marker.position.set(ix, .08, iz); root.add(marker);
    const ring = mesh(new THREE.RingGeometry(.95, 1.12, 40), markerMaterial, marker, [0, 0, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]); ring.castShadow = false;
    const diamond = mesh(new THREE.OctahedronGeometry(.18), materials.glow, marker, [0, 2.4, 0]);
    const station = { id, label, position: new THREE.Vector3(ix, 0, iz), group, marker, used: false,
      setUsed(value) { this.used = Boolean(value); markerMaterial.color.setHex(value ? C.mint : 0xffd28a); markerMaterial.emissive.setHex(value ? 0x69d399 : 0xffa23f); diamond.visible = !value; },
    };
    stations.push(station); return group;
  }
  const candy = house('candy', 'Sweet Tooth', 'SWEET TOOTH', -11, -6, 0x705066, 1);
  const potion = house('potion', 'Potion Post', 'POTION POST', 0, -10, 0x44545f, 2);
  const costume = house('costume', 'Boo Boutique', 'BOO BOUTIQUE', 11, -6, 0x556342, 3);
  // Shop props are deliberately outside the doorway and interaction circle.
  for (const x of [-1, 0, 1]) {
    mesh(G.cylinder, materials.cream, candy, [-2.85, 1.0 + x * .15, x * .55], [.06, 1.8 + x * .3, .06]);
    mesh(G.sphere, x % 2 ? materials.orange : materials.mintGlow, candy, [-2.85, 1.85 + x * .3, x * .55], [.32, .32, .13]);
  }
  const cauldron = new THREE.Group(); cauldron.position.set(3, 0, -11); root.add(cauldron);
  mesh(G.sphere, mat(0x263d3d, { metalness: .5, roughness: .45 }), cauldron, [0, .72, 0], [.85, .68, .85]);
  mesh(new THREE.TorusGeometry(.71, .12, 8, 28), materials.gold, cauldron, [0, 1.12, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
  mesh(new THREE.CircleGeometry(.68, 28), materials.mintGlow, cauldron, [0, 1.13, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 5; i++) { const b = mesh(G.sphere, materials.mintGlow, cauldron, [0, 1.2, 0], [.09, .09, .09]); smoke.push({ mesh: b, phase: i * 1.2 }); }
  for (const side of [-1, 1]) mesh(G.box, materials.darkWood, cauldron, [side * .47, .16, 0], [.18, .32, .95], [0, side * .3, side * -.2]);
  colliders.push({ x: 3, z: -11, r: .95 });
  const displayGhost = createGhost(0xd0ded0); displayGhost.scale.setScalar(.6); displayGhost.position.set(3, .05, 1.0); costume.add(displayGhost);
  // Irregular silhouettes and little pumpkin clusters frame the playable island.
  function tree(x, z, scale, lean) {
    const treeGroup = new THREE.Group(); treeGroup.position.set(x, 0, z); treeGroup.scale.setScalar(scale); root.add(treeGroup);
    const bark = materials.darkWood;
    beam(treeGroup, bark, [0, 0, 0], [lean, 4.8, 0], .23);
    beam(treeGroup, bark, [lean * .4, 2, 0], [-1.5, 3.7, .2], .12); beam(treeGroup, bark, [-1.5, 3.7, .2], [-1.7, 4.7, .1], .07);
    beam(treeGroup, bark, [lean * .65, 3, 0], [1.35, 4.15, .15], .11); beam(treeGroup, bark, [1.35, 4.15, .15], [2.05, 4.35, .05], .06);
    beam(treeGroup, bark, [lean * .5, 2.7, 0], [.4, 4.0, -1.1], .08);
    colliders.push({ x, z, r: .45 * scale });
  }
  [[-16, -3, 1.15, -.3], [16, -2, 1.25, .4], [-16, 9, .95, .3], [15.8, 10.5, .95, -.5], [-7, -15, .75, -.3], [7, -15, .85, .4]].forEach(a => tree(...a));
  [[-15, 5, .8], [-14, 5.4, .5], [-15.6, 6.2, .45], [15, 4, .95], [14, 4.7, .5], [-12, 12, .75], [-11, 12.7, .5], [11, 13, .85], [12.2, 12.7, .4]].forEach(a => pumpkin(...a));
  for (let i = 0; i < 60; i++) {
    const side = i % 2 ? 1 : -1, x = side * (15.7 + rng() * 1.5), z = -12 + rng() * 26;
    batch('cone', 'leaf', [x, .18, z], [.09, .4 + rng() * .25, .09], [0, rng() * 6, (rng() - .5) * .4]);
  }
  // Drooping lantern strings, bat-shaped pennants and warm little bulbs.
  const cords = mat(0x272a2b);
  function string(a, b, count = 18) {
    const mid = new THREE.Vector3().fromArray(a).lerp(new THREE.Vector3().fromArray(b), .5); mid.y -= 1.2;
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...a), mid, new THREE.Vector3(...b));
    mesh(new THREE.TubeGeometry(curve, 32, .025, 5, false), cords, root);
    for (let i = 1; i < count; i++) {
      const p = curve.getPoint(i / count); batch('sphere', i % 4 === 0 ? 'mintGlow' : 'glow', [p.x, p.y - .12, p.z], [.1, .14, .1]);
      if (i % 3 === 0) batch('triangle', i % 2 ? 'orange' : 'roof', [p.x, p.y - .28, p.z], [.4, -.42, 1]);
    }
  }
  string([-14, 6.8, -5.2], [14, 6.8, -5.2], 28);
  for (const side of [-1, 1]) {
    beam(root, materials.darkWood, [side * 15, 0, 6], [side * 15, 5.7, 6], .12);
    string([side * 14, 6.8, -5.2], [side * 15, 5.7, 6], 12);
  }
  const exitGroup = new THREE.Group(); exitGroup.position.set(0, 0, 12); root.add(exitGroup);
  const exitGlow = mat(0xd99750, { emissive: 0xa95724, emissiveIntensity: .4 });
  for (const side of [-1, 1]) {
    mesh(G.cylinder, materials.darkWood, exitGroup, [side * 3.25, 1.15, 0], [.32, 2.3, .32]);
    colliders.push({ x: side * 3.25, z: 12, r: .7 }); pumpkin(side * 3.25, 12, .95);
  }
  mesh(new THREE.TorusGeometry(3.25, .25, 10, 48, Math.PI), materials.darkWood, exitGroup, [0, 2.2, 0]);
  const exitSign = sign('MIDNIGHT GATE', 'THREE TREATS · ONE WAY HOME', 4.8, 1.15); exitSign.position.set(0, 5.4, .15); exitGroup.add(exitSign);
  const exitRing = mesh(new THREE.RingGeometry(1.35, 1.55, 48), exitGlow, exitGroup, [0, .075, 0], [1, 1, 1], [-Math.PI / 2, 0, 0]); exitRing.material.side = THREE.DoubleSide;
  for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; mesh(G.sphere, materials.glow, exitGroup, [Math.cos(a) * 3.25, 2.2 + Math.sin(a) * 3.25, .2], [.13, .13, .13]); }
  const exit = { position: new THREE.Vector3(0, 0, 12), group: exitGroup, open: false,
    setOpen(value) { this.open = Boolean(value); exitGlow.color.setHex(value ? C.mint : 0xd99750); exitGlow.emissive.setHex(value ? 0x6de4aa : 0xa95724); exitGlow.emissiveIntensity = value ? 1.2 : .4; },
  };
  flush();
  return { stations, colliders, exit,
    update(time, dt) {
      stations.forEach((station, i) => { station.marker.children[0].material.opacity = station.used ? .55 : .76 + Math.sin(time * 2.8 + i) * .14; const gem = station.marker.children[1]; gem.position.y = 2.25 + Math.sin(time * 2.5 + i) * .12; gem.rotation.y = time * .9; });
      lanterns.forEach((light, i) => { light.intensity = 7.5 + Math.sin(time * 3 + i * 2) * .5; });
      smoke.forEach(({ mesh: b, phase }) => { const t = (time * .38 + phase) % 1; b.position.set(Math.sin(phase * 7 + time) * .3, 1.2 + t * 1.8, Math.cos(phase * 5) * .25); b.scale.setScalar(.07 + Math.sin(t * Math.PI) * .1); });
      displayGhost.position.y = .12 + Math.sin(time * 1.8) * .1;
      if (exit.open) exitRing.rotation.z = time * .3;
    },
    reset() { stations.forEach(s => s.setUsed(false)); exit.setOpen(false); },
  };
}
