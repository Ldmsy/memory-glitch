import * as THREE from "./vendor/three.module.js";

function texture(kind) {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const x = c.getContext("2d");
  let seed = 123;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  x.fillStyle = kind === "road" ? "#374649" : "#705e64";
  x.fillRect(0, 0, 512, 512);
  if (kind === "road") {
    for (let row = 0; row < 10; row++)
      for (let col = -1; col < 8; col++) {
        const px = col * 74 + (row % 2) * 37,
          py = row * 52;
        x.fillStyle = ["#657171", "#707b78", "#596868", "#74817b"][
          Math.floor(random() * 4)
        ];
        x.beginPath();
        x.roundRect(px + 3, py + 3, 67, 44, 8);
        x.fill();
        x.strokeStyle = "#8b93866a";
        x.lineWidth = 2;
        x.stroke();
      }
  } else {
    for (let row = 0; row < 16; row++)
      for (let col = -1; col < 9; col++) {
        x.fillStyle = ["#9c8078", "#937a78", "#a68b7f", "#8e7472"][
          Math.floor(random() * 4)
        ];
        x.fillRect(col * 64 + (row % 2) * 32 + 2, row * 32 + 2, 60, 28);
      }
  }
  for (let i = 0; i < 6000; i++) {
    x.fillStyle = i % 2 ? "#fff1" : "#0001";
    x.fillRect(
      random() * 512,
      random() * 512,
      1 + random() * 2,
      1 + random() * 2,
    );
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
export function enhanceVillage(scene, houses, M, doors) {
  const road = texture("road");
  road.repeat.set(2, 10);
  M.road.map = road;
  M.road.bumpMap = road;
  M.road.bumpScale = 0.12;
  M.road.color.set("#b5b8ad");
  M.road.needsUpdate = true;
  scene.traverse((o) => {
    if (o.material !== M.road || !o.geometry?.parameters) return;
    const { width, depth } = o.geometry.parameters;
    const map = road.clone();
    map.repeat.set(width / 8, depth / 8);
    map.needsUpdate = true;
    o.material = M.road.clone();
    o.material.map = map;
    o.material.bumpMap = map;
  });

  const brick = texture("brick");
  brick.repeat.set(2, 2);
  M.wall.map = brick;
  M.wall.bumpMap = brick;
  M.wall.bumpScale = 0.06;
  M.wall.color.set("#c1a5a5");
  M.wall2.color.set("#6a7c84");
  M.ground.color.set("#405052");
  const materials = {};
  const mat = (c) =>
    materials[c] ||
    (materials[c] = new THREE.MeshStandardMaterial({
      color: c,
      roughness: 0.75,
    }));
  const mesh = (geo, c, x, y, z, p = scene) => {
    const m = new THREE.Mesh(geo, typeof c === "string" ? mat(c) : c);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    p.add(m);
    return m;
  };
  const box = (w, h, d, c, x, y, z, p) =>
    mesh(new THREE.BoxGeometry(w, h, d), c, x, y, z, p);
  const sphere = (r, c, x, y, z, p) =>
    mesh(new THREE.SphereGeometry(r, 16, 12), c, x, y, z, p);
  const curve = (points, c, r = 0.035, p = scene) =>
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((a) => new THREE.Vector3(...a))),
        30,
        r,
        6,
        false,
      ),
      c,
      0,
      0,
      0,
      p,
    );
  // One instanced tile mesh gives the roofs visible overlapping courses without thousands of draw calls.
  const tiles = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.96, 0.14, 0.83),
      mat("#485468"),
      houses.length * 2 * 9 * 12,
    ),
    obj = new THREE.Object3D();
  let n = 0;
  const tilesColors = ["#435164", "#536076", "#465267", "#657080"];
  houses.forEach((h, i) => {
    const height = 5.3 + (i % 3) * 0.7;
    for (const side of [-1, 1])
      for (let row = 0; row < 9; row++)
        for (let col = 0; col < 12; col++) {
          const x = side * (0.42 + row * 0.76);
          obj.position.set(
            h.x + x,
            height + 4.15 - (Math.abs(x) * 4.1) / 6.8,
            h.z - 5.3 + col * 0.96,
          );
          obj.rotation.set(0, 0, -side * Math.atan(4.1 / 6.8));
          obj.updateMatrix();
          tiles.setMatrixAt(n, obj.matrix);
          tiles.setColorAt(
            n,
            new THREE.Color(tilesColors[(row + col + i) % 4]),
          );
          n++;
        }
    const face = h.x + h.side * 6.3;
    for (const z of [-4.7, 4.7])
      for (let q = 0; q < 3; q++)
        box(0.36, 0.24, 0.6, "#b9a18a", face, 0.45 + q * 0.3, h.z + z);
    // Door stairs, paneled shutters, curved lintel, welcome mat and warm shop awning.
    for (let step = 0; step < 3; step++)
      box(
        0.6 + step * 0.4,
        0.13,
        2.4,
        "#8c8b80",
        h.x + h.side * (6.5 + step * 0.2),
        0.2 - step * 0.055,
        h.z,
      );
    box(0.75, 0.02, 1.55, "#91674d", h.x + h.side * 7.7, 0.025, h.z);
    for (const s of [-1, 1]) {
      box(
        0.16,
        1.6,
        0.44,
        "#3b5960",
        face + h.side * 0.1,
        2.1,
        h.z + s * 3.2 - 0.85,
      );
      box(
        0.16,
        1.6,
        0.44,
        "#3b5960",
        face + h.side * 0.1,
        2.1,
        h.z + s * 3.2 + 0.85,
      );
      box(0.8, 0.24, 2, "#685b55", face + h.side * 0.25, 1.1, h.z + s * 3.2);
      for (let j = 0; j < 5; j++)
        sphere(
          0.15,
          j % 2 ? "#d3a4bd" : "#d9a859",
          face + h.side * 0.3,
          1.35,
          h.z + s * 3.2 - 0.7 + j * 0.35,
        );
    }
    const arch = [];
    for (let k = 0; k <= 20; k++) {
      let a = (k / 20) * Math.PI;
      arch.push([
        face + h.side * 0.04,
        2.65 + Math.sin(a) * 0.8,
        h.z + Math.cos(a) * 1.1,
      ]);
    }
    curve(arch, "#b69e7e", 0.09);
    for (let j = 0; j < 6; j++) {
      const strip = box(
        1.3,
        0.08,
        0.45,
        j % 2 ? "#c9936c" : "#e9c18f",
        face + h.side * 0.65,
        3.6,
        h.z - 1.13 + j * 0.45,
      );
      strip.rotation.z = h.side * -0.13;
    }
    // Projecting store sign with hand-painted numbers.
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 128;
    const cx = c.getContext("2d");
    cx.fillStyle = "#273e45";
    cx.fillRect(0, 0, 256, 128);
    cx.strokeStyle = "#bd9562";
    cx.lineWidth = 6;
    cx.strokeRect(6, 6, 244, 116);
    cx.fillStyle = "#efd4a3";
    cx.textAlign = "center";
    cx.font = "bold 30px Georgia";
    cx.fillText(
      [
        "SWEET TOOTH",
        "THE DRUM CLUB",
        "MOON BREW",
        "BOO BAKERY",
        "CANDY POST",
        "ODD SOLES",
        "NIGHT MAIL",
        "PUMPKIN AIR",
      ][i],
      128,
      53,
    );
    cx.font = "18px Georgia";
    cx.fillText(`TRICK OR TREAT · 0${i + 1}`, 128, 93);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    const sign = mesh(
      new THREE.PlaneGeometry(2, 0.95),
      new THREE.MeshStandardMaterial({
        map: t,
        roughness: 0.7,
        side: THREE.DoubleSide,
      }),
      face + h.side * 0.4,
      4.7,
      h.z,
    );
    sign.rotation.y = (h.side * Math.PI) / 2;
  });
  tiles.castShadow = true;
  tiles.receiveShadow = true;
  scene.add(tiles);
  // Overhead festoon lights follow a sagging cable. Only emissive bulbs, no extra shadow lights.
  const bulbM = new THREE.MeshStandardMaterial({
    color: "#ffdb8f",
    emissive: "#f9b85f",
    emissiveIntensity: 2,
  });
  for (const z of [-29, -13, 3, 19, 32]) {
    curve(
      [
        [-9, 5.7, z],
        [-4, 4.9, z],
        [0, 4.7, z],
        [4, 4.9, z],
        [9, 5.7, z],
      ],
      "#283943",
      0.024,
    );
    for (let i = 0; i < 13; i++) {
      const x = -8 + i * 1.33,
        y = 4.7 + x * x * 0.015;
      const b = sphere(0.075, bulbM, x, y - 0.15, z);
      box(0.07, 0.12, 0.07, "#293945", x, y - 0.02, z);
    }
    // Pennant triangles bring a festival silhouette into the street.
    for (let i = 0; i < 9; i++) {
      const x = -6.8 + i * 1.7,
        y = 4.7 + x * x * 0.015;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(
          [-0.25, 0, 0, 0.25, 0, 0, 0, -0.45, 0],
          3,
        ),
      );
      geo.computeVertexNormals();
      const m = new THREE.MeshStandardMaterial({
        color: ["#c3794d", "#b2a5cc", "#687f85"][i % 3],
        side: THREE.DoubleSide,
      });
      mesh(geo, m, x, y - 0.1, z);
    }
  }
  // Sidewalk edging, planted grasses, barrels and candy-crate clusters.
  const edge = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.55, 0.17, 0.95),
    mat("#7d8b87"),
    170,
  );
  let k = 0;
  for (const x of [-8, 8])
    for (let z = -40; z < 40; z += 0.95) {
      obj.position.set(x, 0.04, z);
      obj.rotation.set(0, 0, 0);
      obj.updateMatrix();
      edge.setMatrixAt(k++, obj.matrix);
    }
  edge.count = k;
  edge.receiveShadow = true;
  scene.add(edge);
  for (const h of houses) {
    const x = h.x + h.side * 7.8,
      z = h.z + 3.8;
    mesh(
      new THREE.CylinderGeometry(0.47, 0.42, 1.1, 14),
      "#785943",
      x,
      0.55,
      z,
    );
    for (const y of [0.15, 0.8]) {
      const r = mesh(
        new THREE.TorusGeometry(0.465, 0.035, 6, 20),
        "#39484b",
        x,
        y,
        z,
      );
      r.rotation.x = Math.PI / 2;
    }
    box(0.65, 0.65, 0.65, "#997658", x + h.side * 0.7, 0.33, z + 0.6);
    for (let j = 0; j < 4; j++)
      box(
        0.7,
        0.045,
        0.04,
        "#513f38",
        x + h.side * 0.7,
        0.1 + j * 0.16,
        z + 0.94,
      );
  }
  const grassG = new THREE.ConeGeometry(0.12, 0.6, 3),
    grass = new THREE.InstancedMesh(grassG, mat("#73847a"), 350);
  for (let i = 0; i < 350; i++) {
    const z = ((i * 31.71) % 80) - 40,
      x = (i % 2 ? -1 : 1) * (30 + (i % 13) * 0.57);
    obj.position.set(x, 0.15, z);
    obj.rotation.set(0, i * 2, Math.sin(i) * 0.15);
    obj.scale.set(1, 0.5 + (i % 7) / 7, 1);
    obj.updateMatrix();
    grass.setMatrixAt(i, obj.matrix);
  }
  scene.add(grass);
  const moonHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: haloTexture(),
      color: "#c7d3e2",
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  moonHalo.position.set(-32, 46, -65);
  moonHalo.scale.set(28, 28, 1);
  scene.add(moonHalo);
}
function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d"),
    g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "#fff");
  g.addColorStop(0.25, "#fff9");
  g.addColorStop(1, "#fff0");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
