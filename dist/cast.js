import * as THREE from "./vendor/three.module.js";
import { CAST, createCharacter, animateCharacter } from "./characters.js";
import { move, clearLine, route, blocked } from "./rules.js";

const HOMES = {
  chiikawa: [2, 30],
  nailong: [-4, 23],
  sahur: [0, -28],
  cappuccina: [4, 7],
  tralalero: [-3, -9],
  crocodilo: [4, -24],
};
export function createCast(scene, keeper) {
  const actors = CAST.map((info) => {
    const actor = info.id === "sahur" ? keeper : createCharacter(info.id);
    if (actor !== keeper) scene.add(actor.g);
    return {
      ...actor,
      info,
      home: HOMES[info.id],
      laugh: 0,
      used: false,
      cooldown: 0,
      charge: null,
      followPath: [],
      repath: 0,
    };
  });
  const pieces = [],
    geometry = new THREE.SphereGeometry(0.09, 8, 6),
    colors = ["#f7bc53", "#eb8aab", "#9ccfba", "#baace6"];
  const candyGroup = new THREE.Group();
  scene.add(candyGroup);
  for (let i = 0; i < 48; i++) {
    const o = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: colors[i % 4], roughness: 0.35 }),
    );
    o.visible = false;
    scene.add(o);
    pieces.push({ o, v: new THREE.Vector3(), life: 0 });
  }
  const target = new THREE.Mesh(
    new THREE.RingGeometry(1.5, 1.58, 64),
    new THREE.MeshBasicMaterial({
      color: "#f3b669",
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    }),
  );
  target.rotation.x = -Math.PI / 2;
  target.visible = false;
  scene.add(target);
  let time = 0,
    events = [],
    beat = null,
    bomb = null,
    chain = 0,
    score = 0;
  function burst(pos) {
    let i = 0;
    for (const p of pieces) {
      const a = (i++ / pieces.length) * Math.PI * 2;
      p.o.position.copy(pos).y = 1.2;
      p.v.set(
        Math.cos(a) * (2 + (i % 3)),
        3 + (i % 4),
        Math.sin(a) * (2 + (i % 3)),
      );
      p.life = 2.5;
      p.o.visible = true;
    }
  }
  function celebrate(actor) {
    actor.laugh = 4;
    burst(actor.g.position);
    let count = 1;
    for (const other of actors) {
      if (
        other !== actor &&
        other.g.position.distanceTo(actor.g.position) < 11
      ) {
        other.laugh = 3.5;
        count++;
      }
    }
    score += count;
    chain = count;
  }
  function reset() {
    time = 0;
    events = [];
    beat = null;
    bomb = null;
    score = 0;
    chain = 0;
    target.visible = false;
    pieces.forEach((p) => {
      p.life = 0;
      p.o.visible = false;
    });
    actors.forEach((a) => {
      a.g.position.set(a.home[0], 0, a.home[1]);
      a.g.rotation.y = Math.PI;
      a.body.scale.setScalar(1);
      a.laugh = 0;
      a.cooldown = 0;
      a.used = false;
      a.charge = null;
      a.followPath = [];
      a.repath = 0;
    });
  }
  function nearest(p) {
    let result = null,
      distance = 3;
    for (const a of actors) {
      const d = Math.hypot(a.g.position.x - p.x, a.g.position.z - p.z);
      if (d < distance && clearLine(p, a.g.position)) {
        result = a;
        distance = d;
      }
    }
    return result;
  }
  function reward(a, message, effect) {
    const candy = a.used ? 0 : 1;
    a.used = true;
    celebrate(a);
    events.push({ message, candy, effect, chain });
  }
  function interact(a, p) {
    if (a.cooldown > 0) {
      events.push({ message: "它还在上一场闹剧里缓不过来…" });
      return;
    }
    a.cooldown = 8;
    if (a.id === "chiikawa")
      reward(a, "吉伊：哇…！它鼓起勇气，帮你挡住下一次追击。", "shield");
    if (a.id === "nailong")
      reward(a, "奶龙笑到糖纸乱飞：这、这真的不是我偷吃的！", "laugh");
    if (a.id === "sahur") {
      beat = { actor: a, remaining: 3.5, origin: p.clone(), moved: 0, last: 4 };
      events.push({
        message: "TUNG × 3！站稳别动，等三个节拍结束。",
        effect: "beat",
      });
    }
    if (a.id === "cappuccina")
      reward(a, "咖啡伯爵：逃命也要有仪态。全员芭蕾，开始！", "dance");
    if (a.id === "tralalero") {
      a.charge = { phase: "ready", t: 0.9, target: p.clone(), direction: null };
      events.push({ message: "三脚鲨鱼准备起跑！往侧面躲，它不会转弯。" });
    }
    if (a.id === "crocodilo") {
      bomb = { actor: a, t: 3, point: p.clone() };
      target.position.set(p.x, 0.08, p.z);
      target.visible = true;
      events.push({ message: "南瓜空投还有 3 秒。离开金色圈，别用头接！" });
    }
  }
  function update(dt, p, speed) {
    time += dt;
    for (const a of actors) {
      a.laugh = Math.max(0, a.laugh - dt);
      a.cooldown = Math.max(0, a.cooldown - dt);
      animateCharacter(
        a,
        time,
        speed > 0 && a.id === "chiikawa" ? 2 : 0,
        a.laugh > 0 ? "laugh" : "idle",
      );
      if (a.id === "chiikawa") {
        const d = a.g.position.distanceTo(p);
        if (d > 2.5) {
          a.repath -= dt;
          if (a.repath <= 0) {
            a.followPath = route(a.g.position, p);
            a.repath = 0.6;
          }
          const dest = clearLine(a.g.position, p) ? p : a.followPath[0];
          if (dest) {
            const dx = dest.x - a.g.position.x,
              dz = dest.z - a.g.position.z,
              len = Math.hypot(dx, dz);
            if (len < 0.4) a.followPath.shift();
            else {
              move(
                a.g.position,
                (dx / len) * dt * Math.min(6, d),
                (dz / len) * dt * Math.min(6, d),
                0.45,
              );
              a.g.rotation.y = Math.atan2(-dx, -dz);
            }
          }
        }
      } else if (a.id !== "sahur" && !a.charge) {
        const d = a.g.position.distanceTo(p);
        if (d < 10) {
          const angle = Math.atan2(a.g.position.x - p.x, a.g.position.z - p.z);
          const delta = Math.atan2(
            Math.sin(angle - a.g.rotation.y),
            Math.cos(angle - a.g.rotation.y),
          );
          a.g.rotation.y += delta * dt * 3;
        }
      }
      if (a.id === "crocodilo") a.g.position.y = 0.5 + Math.sin(time) * 0.2;
      if (a.charge) {
        const c = a.charge;
        c.t -= dt;
        if (c.phase === "ready" && c.t <= 0) {
          c.phase = "run";
          c.t = 1.4;
          c.direction = c.target.clone().sub(a.g.position).setY(0).normalize();
          a.g.rotation.y = Math.atan2(-c.direction.x, -c.direction.z);
        }
        if (c.phase === "run") {
          const before = a.g.position.clone();
          move(
            a.g.position,
            c.direction.x * dt * 10,
            c.direction.z * dt * 10,
            0.65,
          );
          animateCharacter(a, time, 8);
          if (a.g.position.distanceTo(p) < 1.5) {
            events.push({
              message: "三只鞋撞成一团！你被撞得原地打滑。",
              effect: "slip",
            });
            c.t = 0;
          }
          if (c.t <= 0 || before.distanceTo(a.g.position) < 0.001) {
            a.charge = null;
            reward(a, "鲨鱼刹车失败。裁判宣布：你赢了，它在热身。", "laugh");
          }
        }
      }
    }
    if (beat) {
      beat.remaining -= dt;
      beat.moved = Math.max(beat.moved, p.distanceTo(beat.origin));
      const number = Math.ceil(beat.remaining);
      if (number !== beat.last && number > 0) {
        beat.last = number;
        beat.actor.laugh = 0.4;
        events.push({ message: `TUNG！还剩 ${number} 拍，别动。`, sound: 110 });
      }
      if (beat.remaining <= 0) {
        if (beat.moved < 0.8)
          reward(
            beat.actor,
            "三拍全对！Sahur 给你一颗糖，并假装自己没输。",
            "laugh",
          );
        else {
          events.push({
            message: "抢拍了！Sahur 罚你原地蹦迪三秒。",
            effect: "dance",
          });
          beat.actor.cooldown = 2;
        }
        beat = null;
      }
    }
    if (bomb) {
      bomb.t -= dt;
      target.scale.setScalar(1 + Math.sin(time * 10) * 0.06);
      if (bomb.t <= 0) {
        const hit = p.distanceTo(bomb.point) < 2.2;
        burst(bomb.point);
        reward(
          bomb.actor,
          hit
            ? "南瓜爆米花糊了一身。鳄鱼：精准投放！"
            : "空投落地，你成功躲开，顺手捡到了糖。",
          hit ? "slip" : "laugh",
        );
        bomb = null;
        target.visible = false;
      }
    }
    for (const p of pieces)
      if (p.life > 0) {
        p.life -= dt;
        p.v.y -= dt * 9;
        p.o.position.addScaledVector(p.v, dt);
        if (p.o.position.y < 0.12) {
          p.o.position.y = 0.12;
          p.v.y = Math.abs(p.v.y) * 0.3;
          p.v.x *= 0.9;
          p.v.z *= 0.9;
        }
        p.o.visible = p.life > 0;
      }
    const result = events;
    events = [];
    return result;
  }
  reset();
  return {
    actors,
    reset,
    nearest,
    interact,
    update,
    get score() {
      return score;
    },
    get chain() {
      return chain;
    },
    isBusy: (a) => a?.laugh > 0 || (!!beat && beat.actor === a),
  };
}
