import * as THREE from "./vendor/three.module.js";
import { buildReferenceNailong } from "./nailong-reference.js";

// Every actor is assembled from smooth, reusable meshes with separately animated joints.
const surfaces = new Map();
function material(color, roughness = 0.62, metalness = 0) {
  const key = `${color}/${roughness}/${metalness}`;
  if (!surfaces.has(key))
    surfaces.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness, metalness }),
    );
  return surfaces.get(key);
}
const C = {
  white: "#fff8e9",
  ink: "#302936",
  pink: "#f4a5aa",
  orange: "#ef883e",
  purple: "#684c83",
  yellow: "#f8cb42",
  cream: "#fff0b2",
  green: "#639c80",
  blue: "#70a6bb",
  red: "#b84b60",
};
const sphereGeometry = new THREE.SphereGeometry(1, 32, 24);
function part(parent, geometry, color, xyz = [0, 0, 0]) {
  const o = new THREE.Mesh(
    geometry,
    typeof color === "string" ? material(color) : color,
  );
  o.position.set(...xyz);
  o.castShadow = true;
  o.receiveShadow = true;
  parent.add(o);
  return o;
}
function oval(parent, color, xyz, scale) {
  const o = part(parent, sphereGeometry, color, xyz);
  o.scale.set(...scale);
  return o;
}
function tube(parent, points, r, color) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
  );
  return part(
    parent,
    new THREE.TubeGeometry(curve, Math.max(12, points.length * 6), r, 8, false),
    color,
  );
}
function ring(
  parent,
  color,
  xyz,
  r,
  thickness,
  rotation = [Math.PI / 2, 0, 0],
) {
  const o = part(
    parent,
    new THREE.TorusGeometry(r, thickness, 10, 48),
    color,
    xyz,
  );
  o.rotation.set(...rotation);
  return o;
}
function joint(parent, xyz) {
  const g = new THREE.Group();
  g.position.set(...xyz);
  parent.add(g);
  return g;
}
function capsule(parent, color, xyz, r, length) {
  return part(parent, new THREE.CapsuleGeometry(r, length, 6, 16), color, xyz);
}
function cone(parent, color, xyz, r, h) {
  return part(parent, new THREE.ConeGeometry(r, h, 32), color, xyz);
}
function disk(parent, color, xyz, r, h) {
  return part(parent, new THREE.CylinderGeometry(r, r, h, 40), color, xyz);
}
function eyes(parent, y, z, x = 0.3, size = 0.095, white = false) {
  const out = [];
  for (const side of [-1, 1]) {
    const g = joint(parent, [side * x, y, z]);
    if (white)
      oval(g, "#fffcec", [0, 0, 0], [size * 1.55, size * 1.8, size * 0.75]);
    const eye = oval(
      g,
      material(C.ink, 0.18),
      [0, 0, white ? size * 0.65 : 0],
      [size, size * 1.15, size * 0.5],
    );
    oval(
      g,
      "#ffffff",
      [-size * 0.25, size * 0.38, size * 0.47 + (white ? size * 0.65 : 0)],
      [size * 0.25, size * 0.25, size * 0.15],
    );
    out.push(eye);
  }
  return out;
}
function pumpkin(parent, xyz, s = 1) {
  const g = joint(parent, xyz);
  g.scale.setScalar(s);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    oval(
      g,
      i % 2 ? "#e77c27" : "#f39936",
      [Math.sin(a) * 0.19, 0.25, Math.cos(a) * 0.19],
      [0.21, 0.28, 0.21],
    );
  }
  capsule(g, "#517d52", [0, 0.57, 0], 0.035, 0.13).rotation.z = -0.3;
  for (const x of [-0.13, 0.13])
    cone(g, C.ink, [x, 0.31, 0.36], 0.075, 0.13).rotation.z =
      x > 0 ? -0.25 : 0.25;
  tube(
    g,
    [
      [-0.16, 0.17, 0.36],
      [0, 0.1, 0.4],
      [0.16, 0.17, 0.36],
    ],
    0.024,
    C.ink,
  );
  ring(g, "#463342", [0, 0.66, 0], 0.29, 0.025, [0, 0, 0]);
  return g;
}
function cape(parent, color, y, r, height) {
  const geo = new THREE.CylinderGeometry(
    r * 0.6,
    r,
    height,
    40,
    5,
    true,
    Math.PI * 0.15,
    Math.PI * 1.7,
  );
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(pos, i);
    const a = Math.atan2(v.x, v.z);
    pos.setXYZ(
      i,
      v.x * (1 + 0.05 * Math.sin(a * 12)),
      v.y + 0.045 * Math.cos(a * 12),
      v.z * (1 + 0.05 * Math.sin(a * 12)),
    );
  }
  geo.computeVertexNormals();
  const m = material(color).clone();
  m.side = THREE.DoubleSide;
  return part(parent, geo, m, [0, y, 0]);
}
function wing(parent, side, color, xyz, scale = 1) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(0.7, 0.9, 1.5, 0.65);
  shape.lineTo(1.25, -0.15);
  shape.quadraticCurveTo(0.85, 0.22, 0.7, -0.3);
  shape.quadraticCurveTo(0.3, 0.05, 0, -0.35);
  const g = part(
    parent,
    new THREE.ExtrudeGeometry(shape, {
      depth: 0.045,
      bevelEnabled: true,
      bevelSize: 0.025,
      bevelThickness: 0.03,
      bevelSegments: 2,
      steps: 1,
    }),
    color,
    xyz,
  );
  g.scale.set(side * scale, scale, scale);
  return g;
}
export const CAST = [
  {
    id: "chiikawa",
    name: "吉伊",
    english: "CHIIKAWA",
    role: "怕归怕，也要讨到糖。",
    color: "#f4ddbd",
    description: "南瓜披风 / 小小勇气",
    action: "给吉伊打气",
  },
  {
    id: "nailong",
    name: "捧腹奶龙",
    english: "NAILOONG",
    role: "糖没丢，只是在它肚子里。",
    color: "#f6c646",
    description: "参考图重建 / 绿眼睛与捧腹大笑",
    action: "挠奶龙痒痒",
  },
  {
    id: "sahur",
    name: "Tung Tung Sahur",
    english: "THE MIDNIGHT DRUMMER",
    role: "今晚的静音键，失踪了。",
    color: "#b78662",
    description: "木乃伊绷带 / 南瓜木棒",
    action: "跟它打个节拍",
  },
  {
    id: "cappuccina",
    name: "咖啡芭蕾",
    english: "BALLERINA CAPPUCCINA",
    role: "追逐暂停，先跳一段。",
    color: "#d8a7c4",
    description: "吸血鬼杯沿 / 午夜芭蕾",
    action: "加入午夜舞会",
  },
  {
    id: "tralalero",
    name: "三脚鲨鱼",
    english: "TRALALERO TRALALA",
    role: "有三只鞋，刹车一只没有。",
    color: "#7ab6ce",
    description: "科学怪鲨 / 荧光运动鞋",
    action: "发起急转弯挑战",
  },
  {
    id: "crocodilo",
    name: "南瓜轰炸鳄",
    english: "BOMBARDIRO CROCODILO",
    role: "投放的是糖，准头另算。",
    color: "#8fa477",
    description: "蝙蝠机翼 / 南瓜空投",
    action: "呼叫南瓜空投",
  },
];

function buildChiikawa(body) {
  const feet = [joint(body, [-0.28, 0.18, 0]), joint(body, [0.28, 0.18, 0])];
  feet.forEach((f) => oval(f, C.white, [0, 0, 0.06], [0.25, 0.19, 0.32]));
  oval(body, C.white, [0, 0.78, 0], [0.65, 0.72, 0.5]);
  const cloth = cape(body, C.orange, 0.92, 0.77, 0.78);
  cloth.rotation.y = 0;
  ring(body, "#e9bc60", [0, 1.3, 0], 0.37, 0.045);
  const head = joint(body, [0, 1.65, 0.04]);
  oval(head, C.white, [0, 0, 0], [1, 0.83, 0.67]);
  for (const s of [-1, 1]) {
    oval(head, C.white, [s * 0.72, 0.65, -0.02], [0.28, 0.32, 0.24]);
    oval(head, "#edc7c1", [s * 0.72, 0.68, 0.18], [0.135, 0.17, 0.04]);
  }
  const eyeParts = eyes(head, 0.08, 0.65, 0.29, 0.065);
  for (const s of [-1, 1]) {
    oval(head, "#efb2b4", [s * 0.57, -0.12, 0.56], [0.21, 0.105, 0.035]);
    for (let i = 0; i < 3; i++)
      tube(
        head,
        [
          [s * (0.47 + i * 0.06), -0.13, 0.605],
          [s * (0.49 + i * 0.06), -0.06, 0.605],
        ],
        0.009,
        "#dc8e98",
      );
  }
  tube(
    head,
    [
      [-0.11, -0.1, 0.68],
      [-0.07, -0.18, 0.68],
      [0, -0.13, 0.69],
      [0.07, -0.18, 0.68],
      [0.11, -0.1, 0.68],
    ],
    0.018,
    C.ink,
  );
  const arms = [
    joint(body, [-0.58, 0.98, 0.12]),
    joint(body, [0.58, 0.98, 0.12]),
  ];
  arms.forEach((a, i) => {
    oval(a, C.white, [i ? 0.1 : -0.1, -0.13, 0.14], [0.18, 0.3, 0.18]);
  });
  const bucket = pumpkin(arms[1], [0.08, -0.46, 0.27], 0.9);
  return { legs: feet, arms, head, eyeParts, cloth, bucket, height: 2.7 };
}

function woodMaterial() {
  if (surfaces.has("wood")) return surfaces.get("wood");
  let canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#a66f46";
  ctx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 65; i++) {
    ctx.strokeStyle = i % 2 ? "#845337" : "#bc8a5d";
    ctx.lineWidth = i % 3 === 0 ? 2 : 1;
    ctx.beginPath();
    for (let y = 0; y <= 512; y += 8) {
      const x = i * 4 + Math.sin(y * 0.015 + i) * 3;
      y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
  }
  for (const [x, y] of [
    [60, 130],
    [170, 350],
  ]) {
    ctx.strokeStyle = "#775139";
    for (let r = 3; r < 18; r += 4) {
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 2, 0, 0, 7);
      ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.MeshStandardMaterial({
    map,
    roughness: 0.82,
    bumpMap: map,
    bumpScale: 0.045,
  });
  surfaces.set("wood", m);
  return m;
}
function buildSahur(body) {
  const wood = woodMaterial();
  const head = joint(body, [0, 1.85, 0]);
  capsule(head, wood, [0, 0, 0], 0.58, 1.3);
  for (const y of [-0.72, -0.5, 0.54, 0.73]) {
    const band = disk(head, "#d4c5a0", [0, y, 0], 0.592, 0.12);
    band.rotation.z = y * 0.1;
  }
  const eyeParts = eyes(head, 0.23, 0.52, 0.24, 0.14, true);
  for (const s of [-1, 1])
    tube(
      head,
      [
        [s * 0.09, 0.5, 0.55],
        [s * 0.25, 0.57, 0.57],
        [s * 0.4, 0.5, 0.46],
      ],
      0.05,
      "#694734",
    );
  oval(head, "#9a603e", [0, 0.05, 0.62], [0.13, 0.21, 0.14]);
  oval(head, "#513529", [0, -0.34, 0.56], [0.24, 0.14, 0.1]);
  oval(head, "#c28c63", [0, -0.4, 0.62], [0.2, 0.045, 0.07]);
  const legs = [joint(body, [-0.28, 0.9, 0]), joint(body, [0.28, 0.9, 0])];
  legs.forEach((l) => {
    capsule(l, wood, [0, -0.37, 0], 0.105, 0.56);
    oval(l, wood, [0, -0.76, 0.13], [0.17, 0.14, 0.32]);
  });
  const arms = [joint(body, [-0.58, 1.72, 0]), joint(body, [0.58, 1.72, 0])];
  arms.forEach((a) => {
    capsule(a, wood, [0, -0.4, 0], 0.105, 0.65);
    oval(a, wood, [0, -0.85, 0.04], [0.16, 0.17, 0.15]);
  });
  const bat = joint(arms[1], [0.12, -0.82, 0.15]);
  capsule(bat, wood, [0, 0.6, 0], 0.14, 0.9);
  capsule(bat, "#563c30", [0, -0.1, 0], 0.065, 0.3);
  bat.rotation.x = -0.45;
  pumpkin(bat, [0, 1.1, 0], 0.42);
  const cloth = cape(body, C.purple, 1.65, 0.76, 0.75);
  cloth.rotation.y = 0;
  return { legs, arms, head, eyeParts, bat, cloth, height: 3.1 };
}
function buildCappuccina(body) {
  const feet = [joint(body, [-0.17, 0.77, 0]), joint(body, [0.17, 0.77, 0])];
  feet.forEach((f) => {
    capsule(f, "#f0c1b7", [0, -0.28, 0], 0.075, 0.45);
    oval(f, "#c96b91", [0, -0.64, 0.09], [0.12, 0.13, 0.27]);
    tube(
      f,
      [
        [-0.07, -0.44, 0.06],
        [0.07, -0.35, 0.06],
        [-0.07, -0.27, 0.06],
      ],
      0.014,
      "#c96b91",
    );
  });
  oval(body, "#ae5d82", [0, 1.1, 0], [0.28, 0.42, 0.24]);
  const skirt = part(
    body,
    new THREE.CylinderGeometry(0.2, 0.75, 0.4, 64, 4, true),
    material("#c886a7"),
    [0, 0.84, 0],
  );
  const arr = skirt.geometry.attributes.position;
  for (let i = 0; i < arr.count; i++) {
    const x = arr.getX(i),
      z = arr.getZ(i),
      a = Math.atan2(x, z),
      f = 1 + 0.08 * Math.sin(a * 18);
    arr.setX(i, x * f);
    arr.setZ(i, z * f);
  }
  skirt.geometry.computeVertexNormals();
  const head = joint(body, [0, 1.95, 0]);
  const porcelain = material("#f8ead5", 0.24);
  part(head, new THREE.CylinderGeometry(0.64, 0.47, 0.87, 48), porcelain);
  ring(head, porcelain, [0, 0.44, 0], 0.61, 0.065);
  disk(head, "#654238", [0, 0.435, 0], 0.565, 0.018);
  ring(head, porcelain, [0.72, 0.04, 0], 0.3, 0.085, [0, 0, 0]);
  const spiral = [];
  for (let i = 0; i < 70; i++) {
    const a = i * 0.18,
      r = 0.4 * (1 - i / 90);
    spiral.push([Math.cos(a) * r, 0.457, Math.sin(a) * r]);
  }
  tube(head, spiral, 0.022, "#ddbc8f");
  const eyeParts = eyes(head, 0.02, 0.56, 0.23, 0.075);
  for (const s of [-1, 1]) {
    tube(
      head,
      [
        [s * 0.2, 0.16, 0.57],
        [s * 0.3, 0.21, 0.55],
        [s * 0.38, 0.19, 0.49],
      ],
      0.018,
      C.ink,
    );
    oval(head, "#e8a4a7", [s * 0.39, -0.12, 0.47], [0.13, 0.055, 0.035]);
    cone(head, C.white, [s * 0.095, -0.31, 0.56], 0.04, 0.12).rotation.z =
      Math.PI;
  }
  tube(
    head,
    [
      [-0.13, -0.18, 0.58],
      [0, -0.25, 0.6],
      [0.13, -0.18, 0.58],
    ],
    0.018,
    C.ink,
  );
  const arms = [joint(body, [-0.27, 1.33, 0]), joint(body, [0.27, 1.33, 0])];
  arms.forEach((a, i) => {
    tube(
      a,
      [
        [0, 0, 0],
        [i ? 0.3 : -0.3, 0.1, 0.08],
        [i ? 0.4 : -0.4, 0.35, 0.16],
      ],
      0.06,
      "#f0c1b7",
    );
    oval(a, "#f0c1b7", [i ? 0.4 : -0.4, 0.35, 0.16], [0.09, 0.11, 0.08]);
  });
  const cloth = cape(body, "#542b57", 1.25, 0.45, 0.55);
  cloth.rotation.y = 0;
  const steam = joint(head, [0, 0.6, 0]);
  for (let i = 0; i < 3; i++)
    tube(
      steam,
      [
        [i * 0.16 - 0.16, 0, 0],
        [i * 0.16 - 0.1, 0.16, 0],
        [i * 0.16 - 0.19, 0.32, 0],
      ],
      0.012,
      "#c2a3cf",
    );
  return { legs: feet, arms, head, eyeParts, skirt, cloth, steam, height: 3 };
}
function shoe(parent, xyz) {
  const g = joint(parent, xyz);
  oval(g, "#f4eddd", [0, 0.02, 0.13], [0.26, 0.12, 0.48]);
  oval(g, "#347cc2", [0, 0.15, 0.1], [0.24, 0.2, 0.43]);
  oval(g, "#5db0e6", [0, 0.27, -0.06], [0.18, 0.13, 0.21]);
  for (let i = 0; i < 3; i++)
    tube(
      g,
      [
        [-0.12, 0.29, 0.04 + i * 0.09],
        [0.12, 0.29, 0.04 + i * 0.09],
      ],
      0.018,
      "#e8f0e8",
    );
  tube(
    g,
    [
      [-0.2, 0.16, 0.05],
      [-0.2, 0.1, 0.2],
      [-0.2, 0.21, 0.35],
    ],
    0.027,
    "#a5e2de",
  );
  return g;
}
function buildTralalero(body) {
  oval(body, "#74a2b4", [0, 1.36, 0], [0.7, 0.6, 1.18]);
  oval(body, "#d8e4da", [0, 1.15, 0.25], [0.62, 0.38, 0.91]);
  const head = joint(body, [0, 1.4, 0.63]);
  oval(head, "#74a2b4", [0, 0, 0.18], [0.67, 0.47, 0.64]);
  oval(head, "#d0e1d7", [0, -0.22, 0.38], [0.58, 0.22, 0.48]);
  const eyeParts = eyes(head, 0.13, 0.58, 0.43, 0.08, true);
  tube(
    head,
    [
      [-0.4, -0.13, 0.79],
      [0, -0.2, 0.89],
      [0.4, -0.13, 0.79],
    ],
    0.028,
    "#30474e",
  );
  for (let i = 0; i < 5; i++)
    cone(
      head,
      "#fef5dc",
      [-0.28 + i * 0.14, -0.18, 0.84],
      0.045,
      0.12,
    ).rotation.z = Math.PI;
  const fin = cone(body, "#568599", [0, 2.04, -0.24], 0.38, 0.9);
  fin.scale.z = 0.23;
  fin.rotation.x = -0.2;
  for (const s of [-1, 1]) {
    const f = oval(
      body,
      "#5c8ca1",
      [s * 0.78, 1.24, -0.05],
      [0.57, 0.11, 0.33],
    );
    f.rotation.z = s * -0.3;
    capsule(head, "#b0bac0", [s * 0.67, 0, -0.08], 0.09, 0.17).rotation.z =
      Math.PI / 2;
  }
  const tail = joint(body, [0, 1.4, -1.1]);
  for (const s of [-1, 1]) {
    const f = oval(tail, "#568599", [s * 0.3, 0, -0.28], [0.55, 0.11, 0.35]);
    f.rotation.y = s * 0.5;
  }
  const legs = [
    joint(body, [-0.48, 0.7, 0.4]),
    joint(body, [0.48, 0.7, 0.4]),
    joint(body, [0, 0.7, -0.65]),
  ];
  legs.forEach((l) => {
    capsule(l, "#70a2b4", [0, -0.22, 0], 0.12, 0.32);
    shoe(l, [0, -0.55, 0.1]);
  });
  tube(
    head,
    [
      [-0.3, 0.37, 0.55],
      [-0.17, 0.41, 0.6],
      [0.0, 0.4, 0.64],
    ],
    0.012,
    C.ink,
  );
  for (let i = 0; i < 3; i++)
    tube(
      head,
      [
        [-0.28 + i * 0.1, 0.34, 0.57],
        [-0.23 + i * 0.1, 0.44, 0.59],
      ],
      0.012,
      C.ink,
    );
  return { legs, arms: [], head, eyeParts, tail, height: 2.6 };
}
function buildCrocodilo(body) {
  oval(body, "#74885a", [0, 1.45, 0], [0.5, 0.43, 1.45]);
  const head = joint(body, [0, 1.45, 1.12]);
  oval(head, "#819660", [0, 0, 0.3], [0.43, 0.32, 0.75]);
  oval(head, "#546441", [0, -0.22, 0.44], [0.4, 0.12, 0.65]);
  const eyeParts = eyes(head, 0.23, 0.45, 0.3, 0.1, true);
  for (const s of [-1, 1]) {
    oval(head, "#3f5237", [s * 0.22, 0.06, 0.98], [0.055, 0.025, 0.045]);
    for (let i = 0; i < 4; i++)
      cone(
        head,
        "#eee6c8",
        [s * 0.34, -0.15, 0.24 + i * 0.18],
        0.04,
        0.13,
      ).rotation.z = Math.PI;
  }
  for (let i = 0; i < 5; i++)
    cone(body, "#5c7048", [0, 1.83, -0.8 + i * 0.35], 0.12, 0.23);
  const arms = [
    wing(body, 1, "#605075", [0.36, 1.43, -0.25], 1.15),
    wing(body, -1, "#605075", [-0.36, 1.43, -0.25], 1.15),
  ];
  const tail = joint(body, [0, 1.45, -1.25]);
  oval(tail, "#74885a", [0, 0, -0.38], [0.23, 0.2, 0.65]);
  cone(tail, "#51633f", [0, 0.25, -0.5], 0.28, 0.5).scale.z = 0.18;
  const propeller = joint(head, [0, 0, 1.1]);
  oval(propeller, "#614d42", [0, 0, 0], [0.08, 0.08, 0.12]);
  for (const a of [0, Math.PI / 2]) {
    const blade = oval(propeller, "#d5ba8a", [0, 0, 0], [0.08, 0.65, 0.035]);
    blade.rotation.z = a;
  }
  const bucket = pumpkin(body, [0, 0.71, -0.1], 1);
  const legs = [];
  return { legs, arms, head, eyeParts, tail, propeller, bucket, height: 2.8 };
}
function buildExplorer(body) {
  const legs = [joint(body, [-0.2, 0.75, 0]), joint(body, [0.2, 0.75, 0])];
  legs.forEach((l) => {
    capsule(l, "#454754", [0, -0.22, 0], 0.14, 0.33);
    oval(l, "#5b3540", [0, -0.55, 0.12], [0.19, 0.17, 0.3]);
    ring(l, "#b9aa95", [0, -0.39, 0], 0.14, 0.045);
  });
  oval(body, "#d4884f", [0, 1.1, 0], [0.48, 0.51, 0.34]);
  cape(body, "#cd8851", 1.08, 0.5, 0.63).rotation.y = 0;
  const head = joint(body, [0, 1.92, 0]);
  oval(head, "#efc9a4", [0, 0, 0.03], [0.44, 0.46, 0.4]);
  oval(head, "#4c3b3f", [0, 0.14, -0.1], [0.46, 0.4, 0.34]);
  for (const s of [-1, 1])
    oval(head, "#efc9a4", [s * 0.42, -0.04, 0], [0.1, 0.15, 0.09]);
  const eyeParts = eyes(head, 0, 0.4, 0.16, 0.045);
  tube(
    head,
    [
      [-0.08, -0.18, 0.4],
      [0, -0.2, 0.43],
      [0.08, -0.18, 0.4],
    ],
    0.014,
    "#80554d",
  );
  const hat = joint(head, [0, 0.38, 0]);
  disk(hat, "#594761", [0, 0, 0], 0.66, 0.065);
  cone(hat, "#594761", [0, 0.34, 0], 0.4, 0.72).rotation.z = -0.16;
  ring(hat, "#b88c65", [0, 0.06, 0], 0.38, 0.045);
  oval(hat, "#efc178", [0.18, 0.12, 0.34], [0.08, 0.08, 0.025]);
  const arms = [joint(body, [-0.43, 1.35, 0]), joint(body, [0.43, 1.35, 0])];
  arms.forEach((a) => {
    capsule(a, "#c27a45", [0, -0.22, 0], 0.14, 0.27);
    oval(a, "#efc9a4", [0, -0.5, 0.02], [0.13, 0.15, 0.13]);
  });
  const bucket = pumpkin(arms[1], [0, -0.81, 0.18], 0.8);
  oval(body, "#73684e", [0, 1.12, -0.37], [0.32, 0.36, 0.16]);
  return { legs, arms, head, eyeParts, hat, bucket, height: 2.8 };
}

export function createCharacter(id = "explorer") {
  const g = new THREE.Group(),
    body = new THREE.Group();
  g.name = id;
  g.add(body);
  body.rotation.y = Math.PI;
  const factories = {
    chiikawa: buildChiikawa,
    nailong: buildReferenceNailong,
    sahur: buildSahur,
    cappuccina: buildCappuccina,
    tralalero: buildTralalero,
    crocodilo: buildCrocodilo,
    explorer: buildExplorer,
  };
  const rig = (factories[id] || buildExplorer)(body);
  return { id, g, body, ...rig, phase: 0 };
}
export function animateCharacter(actor, time, speed = 0, emotion = "idle") {
  if (actor.animateReference) {
    actor.animateReference(time, emotion);
    return;
  }
  const { id, body, legs, arms, head, eyeParts } = actor;
  const stride = Math.sin(time * (speed > 0 ? 8 : 2));
  body.position.y =
    Math.sin(time * 2.4) * 0.025 + (speed > 0 ? Math.abs(stride) * 0.06 : 0);
  body.rotation.z =
    emotion === "laugh"
      ? Math.sin(time * 18) * 0.13
      : Math.sin(time * 2) * 0.018;
  body.rotation.x = emotion === "laugh" ? -0.15 : 0;
  legs.forEach(
    (l, i) =>
      (l.rotation.x = speed > 0 ? Math.sin(time * 8 + i * Math.PI) * 0.45 : 0),
  );
  arms.forEach((a, i) => {
    a.rotation.x =
      emotion === "laugh"
        ? -1.1
        : Math.sin(time * (speed > 0 ? 8 : 2) + i * Math.PI) *
          (speed > 0 ? 0.4 : 0.07);
  });
  if (head)
    head.rotation.z =
      emotion === "laugh"
        ? Math.sin(time * 14) * 0.1
        : Math.sin(time * 1.5) * 0.025;
  const blink = time % 4.8 > 4.64 ? 0.12 : 1;
  eyeParts?.forEach((e) => (e.scale.y = Math.abs(e.scale.x) * 1.15 * blink));
  if (id === "sahur" && emotion === "laugh") {
    arms[1].rotation.x = -1.2 + Math.sin(time * 8) * 0.8;
  }
  if (id === "cappuccina") {
    body.rotation.y =
      Math.PI + (emotion === "laugh" ? time * 3 : Math.sin(time * 0.7) * 0.18);
    actor.steam.scale.y = 1 + Math.sin(time * 2) * 0.15;
  }
  if (id === "tralalero") actor.tail.rotation.y = Math.sin(time * 5) * 0.15;
  if (id === "crocodilo") {
    body.position.y = 0.2 + Math.sin(time * 2) * 0.15;
    actor.propeller.rotation.z = time * 35;
    arms.forEach(
      (a, i) => (a.rotation.z = Math.sin(time * 3) * (i ? -0.09 : 0.09)),
    );
  }
}
