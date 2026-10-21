import * as THREE from "./vendor/three.module.js";
import { houses } from "./rules.js";
import { enhanceVillage } from "./village-details.js";
export function createWorld(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (e) {
    throw e;
  }
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#263448");
  scene.fog = new THREE.FogExp2("#263448", 0.011);
  const camera = new THREE.PerspectiveCamera(
    57,
    innerWidth / innerHeight,
    0.15,
    180,
  );
  scene.add(new THREE.HemisphereLight("#c2d6ed", "#5f3f40", 2.3));
  const moonlight = new THREE.DirectionalLight("#b3c4eb", 3);
  moonlight.position.set(-22, 40, -18);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(2048, 2048);
  Object.assign(moonlight.shadow.camera, {
    left: -48,
    right: 48,
    top: 48,
    bottom: -48,
    near: 1,
    far: 110,
  });
  moonlight.shadow.bias = -0.001;
  scene.add(moonlight);
  const mat = (color, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: 0.95, ...extra });
  const M = {
    ground: mat("#263934"),
    road: mat("#3b4844"),
    wall: mat("#4d5650"),
    wall2: mat("#41484b"),
    roof: mat("#202d35"),
    wood: mat("#292f2c"),
    stone: mat("#596663"),
    metal: mat("#19262a"),
    orange: mat("#cd712f"),
    glow: mat("#ffc47e", { emissive: "#ffa249", emissiveIntensity: 2.1 }),
    dark: mat("#081416"),
    coat: mat("#304749"),
    skin: mat("#b79b81"),
  };
  function mesh(geo, m, x, y, z, parent = scene) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  }
  function box(w, h, d, m, x = 0, y = 0, z = 0, p = scene) {
    return mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, p);
  }
  function sphere(r, m, x, y, z, p = scene) {
    return mesh(new THREE.SphereGeometry(r, 24, 16), m, x, y, z, p);
  }
  function cyl(r1, r2, h, m, x, y, z, p = scene, n = 8) {
    return mesh(new THREE.CylinderGeometry(r1, r2, h, n), m, x, y, z, p);
  }
  function branch(a, b, r, p = scene) {
    const v = new THREE.Vector3().subVectors(b, a),
      o = cyl(r * 0.65, r, v.length(), M.wood, 0, 0, 0, p, 6);
    o.position.copy(a).add(b).multiplyScalar(0.5);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize());
    return o;
  }
  let seed = 831;
  function rand() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  }
  box(180, 0.25, 180, M.ground, 0, -0.2, 0);
  box(16, 0.04, 84, M.road, 0, -0.035, 0);
  for (const z of [-36, -17, -1, 15, 34])
    box(68, 0.045, 5, M.road, 0, -0.025, z);
  for (const x of [-29, 29]) box(6, 0.04, 76, M.road, x, -0.03, 0);
  const pebbleGeo = new THREE.DodecahedronGeometry(0.18, 0),
    pebbles = new THREE.InstancedMesh(pebbleGeo, M.stone, 1200);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 1200; i++) {
    dummy.position.set((rand() - 0.5) * 80, 0.015, (rand() - 0.5) * 82);
    dummy.scale.set(1 + rand() * 2, 0.22, 1 + rand());
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.updateMatrix();
    pebbles.setMatrixAt(i, dummy.matrix);
  }
  pebbles.receiveShadow = true;
  scene.add(pebbles);
  function pumpkin(x, z, s = 1, p = scene, y = 0) {
    let g = new THREE.Group();
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    p.add(g);
    let body = sphere(0.42, M.orange, 0, 0.38, 0, g);
    body.scale.set(1, 0.85, 1);
    cyl(0.055, 0.075, 0.22, M.wood, 0, 0.77, 0, g);
    for (const ex of [-0.15, 0.15]) {
      const eye = box(0.12, 0.11, 0.04, M.glow, ex, 0.46, 0.38, g);
      eye.rotation.z = ex > 0 ? -0.25 : 0.25;
    }
    box(0.22, 0.055, 0.04, M.glow, 0, 0.25, 0.4, g);
    return g;
  }
  function lantern(x, y, z, p = scene, light = false) {
    box(0.3, 0.44, 0.3, M.metal, x, y, z, p);
    box(0.22, 0.28, 0.23, M.glow, x, y, z, p);
    cyl(0.01, 0.24, 0.18, M.metal, x, y + 0.3, z, p);
    if (light) {
      const l = new THREE.PointLight("#ffad61", 12, 10, 2);
      l.position.set(x, y, z);
      p.add(l);
    }
  }
  const doors = [],
    windows = [];
  const names = [
    "THE CANDLE HOUSE",
    "WIDOW’S REST",
    "THE APOTHECARY",
    "THE OLD INN",
    "THE BELLKEEPER",
    "SUGAR & ASH",
    "THE SILENT HOUSE",
    "THE LAST POST",
  ];
  houses.forEach((h, i) => {
    const g = new THREE.Group();
    g.position.set(h.x, 0, h.z);
    scene.add(g);
    const height = 5.3 + (i % 3) * 0.7;
    box(12, height, 10, i % 2 ? M.wall : M.wall2, 0, height / 2, 0, g);
    box(12.4, 0.35, 10.4, M.stone, 0, 0.18, 0, g);
    // A steep gable roof, with a ridge along the village street.
    const verts = new Float32Array([
      -6.8, 0, -5.8, 6.8, 0, -5.8, 0, 4.1, -5.8, -6.8, 0, 5.8, 0, 4.1, 5.8, 6.8,
      0, 5.8, -6.8, 0, -5.8, 0, 4.1, -5.8, 0, 4.1, 5.8, -6.8, 0, -5.8, 0, 4.1,
      5.8, -6.8, 0, 5.8, 6.8, 0, -5.8, 6.8, 0, 5.8, 0, 4.1, 5.8, 6.8, 0, -5.8,
      0, 4.1, 5.8, 0, 4.1, -5.8,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();
    mesh(geo, M.roof, 0, height, 0, g);
    box(0.8, 3, 0.9, M.wall, 2, height + 2, -2, g);
    box(1, 0.2, 1.1, M.stone, 2, height + 3.5, -2, g);
    for (const z of [-4.8, 4.8])
      box(0.16, height, 0.22, M.wood, h.side * 6.04, height / 2, z, g);
    for (const y of [1, 3.6, height - 0.1])
      box(0.18, 0.15, 10, M.wood, h.side * 6.05, y, 0, g);
    box(0.22, 2.6, 1.65, M.wood, h.side * 6.12, 1.35, 0, g);
    box(0.25, 2.9, 0.16, M.stone, h.side * 6.1, 1.45, -0.96, g);
    box(0.25, 2.9, 0.16, M.stone, h.side * 6.1, 1.45, 0.96, g);
    box(0.26, 0.2, 2.1, M.stone, h.side * 6.12, 2.9, 0, g);
    sphere(0.07, M.glow, h.side * 6.27, 1.25, 0.55, g);
    for (const z of [-3.2, 3.2]) {
      box(0.12, 1.45, 1.2, M.wood, h.side * 6.13, 2.1, z, g);
      const win = box(0.13, 1.22, 1, M.glow, h.side * 6.22, 2.1, z, g);
      windows.push(win);
      box(0.14, 0.09, 1.25, M.wood, h.side * 6.31, 2.1, z, g);
      box(0.14, 1.4, 0.08, M.wood, h.side * 6.31, 2.1, z, g);
    }
    lantern(h.side * 6.6, 3.1, -1.5, g, true);
    pumpkin(h.side * 7.05, 0.8, 0.9, g);
    pumpkin(h.side * 7.3, 1.6, 0.6, g);
    const d = {
      x: h.x + h.side * 7.3,
      z: h.z,
      index: i,
      name: names[i],
      used: false,
    };
    doors.push(d);
    const marker = cyl(0.06, 0.06, 1, M.glow, d.x, 3.9, d.z);
    marker.visible = false;
    d.marker = marker;
  });
  // Perimeter silhouettes, crooked bare trees, cemetery and iron gate.
  function tree(x, z, s = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
    branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.3, 5, 0), 0.25, g);
    for (let j = 0; j < 5; j++) {
      const a = new THREE.Vector3(0.1, 2 + j * 0.6, 0),
        b = new THREE.Vector3(
          (j % 2 ? 1 : -1) * (1.1 + rand()),
          4 + j * 0.5,
          (rand() - 0.5) * 2,
        );
      branch(a, b, 0.12, g);
      branch(
        b,
        b.clone().add(new THREE.Vector3((j % 2 ? 1 : -1) * 0.5, 1, 0.3)),
        0.06,
        g,
      );
    }
  }
  for (let i = 0; i < 45; i++) {
    const a = (i / 45) * Math.PI * 2,
      r = 44 + rand() * 12;
    tree(Math.cos(a) * r, Math.sin(a) * r, 0.8 + rand() * 1.3);
  }
  for (const [x, z] of [
    [-5, -17],
    [6, 15],
    [-32, 5],
    [32, -12],
    [-7, 32],
  ])
    tree(x, z, 0.65);
  for (let i = 0; i < 16; i++) {
    const x = -36 + (i % 3) * 1.8,
      z = -24 + Math.floor(i / 3) * 2.3;
    const grav = box(0.8, 1.1, 0.22, M.stone, x, 0.55, z);
    grav.rotation.z = (rand() - 0.5) * 0.16;
    sphere(0.4, M.stone, x, 1.1, z).scale.z = 0.3;
    box(0.07, 0.48, 0.03, M.dark, x, 0.8, z + 0.13);
    box(0.3, 0.06, 0.03, M.dark, x, 0.85, z + 0.14);
  }
  for (const x of [-42, 42]) {
    for (let z = -42; z < 43; z += 2) {
      cyl(0.045, 0.045, 2.3, M.metal, x, 1.15, z, scene, 5);
    }
    box(0.07, 0.08, 84, M.metal, x, 0.7, 0);
    box(0.07, 0.08, 84, M.metal, x, 1.7, 0);
  }
  for (const z of [-42, 39]) {
    for (let x = -42; x < 43; x += 2) {
      if (z === 39 && Math.abs(x) < 4) continue;
      cyl(0.045, 0.045, 2.3, M.metal, x, 1.15, z, scene, 5);
    }
    for (const x of [-23, 23]) {
      box(38, 0.08, 0.07, M.metal, x, 0.7, z);
      box(38, 0.08, 0.07, M.metal, x, 1.7, z);
    }
  }
  for (const x of [-4.5, 4.5]) {
    box(1, 7, 1, M.stone, x, 3.5, 38);
    cyl(0.1, 0.85, 0.8, M.roof, x, 7.4, 38);
    lantern(x, 4.4, 37.3, scene, true);
  }
  const gate = new THREE.Group();
  gate.position.set(0, 0, 38);
  scene.add(gate);
  for (let x = -3.6; x < 4; x += 0.5)
    cyl(0.04, 0.04, 3.7, M.metal, x, 1.85, 0, gate, 5);
  box(8, 0.12, 0.12, M.metal, 0, 0.8, 0, gate);
  box(8, 0.12, 0.12, M.metal, 0, 2.6, 0, gate);
  box(10, 0.3, 1, M.wood, 0, 7.2, 38);
  function label(text, x, y, z) {
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const cx = c.getContext("2d");
    cx.fillStyle = "#1d2929";
    cx.fillRect(0, 0, 512, 128);
    cx.strokeStyle = "#a48761";
    cx.strokeRect(10, 10, 492, 108);
    cx.fillStyle = "#dec195";
    cx.font = "28px Georgia";
    cx.textAlign = "center";
    cx.fillText(text, 256, 76);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
    return mesh(new THREE.PlaneGeometry(6.5, 1.625), m, x, y, z);
  }
  label("TRICK TOWN", 0, 7.3, 37.4);
  for (const x of [-5, 5])
    for (const z of [-33, -17, -1, 15, 31]) {
      cyl(0.06, 0.09, 3.4, M.metal, x, 1.7, z);
      lantern(x, 3.55, z);
      pumpkin(x + 0.5, z, 0.65);
    }
  // Clock tower at the northern end.
  box(5, 12, 5, M.wall, 0, 6, -39);
  cyl(0, 4, 5, M.roof, 0, 14.5, -39, scene, 4);
  const clockFace = cyl(1, 1, 0.12, M.glow, 0, 10, -36.43, scene, 32);
  clockFace.rotation.x = Math.PI / 2;
  box(0.07, 0.85, 0.15, M.wood, 0, 10.4, -36.3);
  const hand = box(0.7, 0.06, 0.15, M.wood, -0.3, 10, -36.28);
  hand.rotation.z = -0.2;
  const moon = sphere(
    4,
    new THREE.MeshBasicMaterial({ color: "#d9e8d2" }),
    -32,
    46,
    -65,
  );
  moon.castShadow = false;
  const starsGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 400; i++)
    starPos.push((rand() - 0.5) * 180, 35 + rand() * 45, (rand() - 0.5) * 180);
  starsGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(starPos, 3),
  );
  scene.add(
    new THREE.Points(
      starsGeo,
      new THREE.PointsMaterial({
        color: "#d9e1cc",
        size: 0.12,
        transparent: true,
        opacity: 0.5,
      }),
    ),
  );
  const moteGeo = new THREE.BufferGeometry(),
    motePos = [];
  for (let i = 0; i < 160; i++)
    motePos.push((rand() - 0.5) * 78, rand() * 7, (rand() - 0.5) * 78);
  moteGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(motePos, 3),
  );
  const motes = new THREE.Points(
    moteGeo,
    new THREE.PointsMaterial({
      color: "#cbbd87",
      size: 0.055,
      transparent: true,
      opacity: 0.5,
    }),
  );
  scene.add(motes);

  enhanceVillage(scene, houses, M, doors);
  return { renderer, scene, camera, doors, gate, motes, moonlight };
}
