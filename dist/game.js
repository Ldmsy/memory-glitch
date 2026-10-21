import { createWorld } from "./world.js";
import { createCharacter, animateCharacter, CAST } from "./characters.js";
import { createCast } from "./cast.js";
import { createShowcase } from "./showcase.js";
import { preloadNailong } from "./nailong-reference.js";
import * as THREE from "./vendor/three.module.js";
import {
  houses,
  obstacles,
  blocked,
  clearLine,
  move,
  route,
  doorReward,
} from "./rules.js";
const $ = (id) => document.getElementById(id),
  show = (id, v) => ($(id).hidden = !v);
const canvas = $("world");
try {
  $("loading").textContent = "正在载入奶龙模型…";
  await preloadNailong();
} catch (error) {
  $("loading").textContent = "奶龙模型未能载入，请刷新页面重试。";
  throw error;
}
const { renderer, scene, camera, doors, gate, motes, moonlight } =
  createWorld(canvas);
const player = createCharacter("explorer"),
  keeper = createCharacter("sahur");
scene.add(player.g, keeper.g);
player.g.visible = false;
keeper.g.position.set(1, 0, -18);
keeper.g.rotation.y = Math.PI;
const playerLight = new THREE.PointLight("#ffbc75", 9, 10, 2);
player.g.add(playerLight);
playerLight.position.set(0.5, 1.2, -0.3);
const cast = createCast(scene, keeper);
const showcase = createShowcase(renderer);
let nearNPC = null,
  shield = 0,
  dance = 0,
  slip = 0,
  bumps = 0;
let mode = "intro",
  candies = 0,
  seconds = 480,
  stamina = 100,
  crouch = false,
  baits = 3,
  yaw = 0,
  pitch = 0.22,
  near = null,
  toastTime = 0,
  elapsed = 0,
  noise = null,
  noiseTime = 0,
  invuln = 0;
let ai = {
    state: "patrol",
    target: { x: 0, z: -28 },
    path: [],
    repath: 0,
    lost: 0,
    search: 0,
    patrolIndex: 0,
  },
  patrol = [
    { x: 0, z: -27 },
    { x: 28, z: -17 },
    { x: 28, z: 32 },
    { x: 0, z: 33 },
    { x: -28, z: 15 },
    { x: -28, z: -33 },
  ];
const keys = new Set();
let dragging = false,
  lastMouse = null,
  gamepad = false,
  oldButtons = [],
  hapticTime = 0,
  lastFrame = performance.now(),
  runningSpeed = 0,
  audioCtx = null,
  sound = true,
  ambientGain = null;
function audioInit() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    ambientGain = audioCtx.createGain();
    ambientGain.gain.value = 0.018;
    ambientGain.connect(audioCtx.destination);
    for (const f of [55, 82.4, 110.3]) {
      const o = audioCtx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(ambientGain);
      o.start();
    }
  } catch {}
}
function tone(freq = 160, duration = 0.2, volume = 0.08, type = "sine") {
  if (!sound || !audioCtx) return;
  const o = audioCtx.createOscillator(),
    g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, audioCtx.currentTime);
  o.frequency.exponentialRampToValueAtTime(
    freq * 0.65,
    audioCtx.currentTime + duration,
  );
  g.gain.setValueAtTime(volume, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  o.connect(g);
  g.connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + duration);
}
function toast(t) {
  $("toast").textContent = t;
  $("toast").style.opacity = 1;
  toastTime = 4;
}
function setMode(m) {
  mode = m;
  show("intro", m === "intro");
  show("sceneCaption", m === "intro");
  show("hud", m !== "intro");
  show("pause", m === "paused");
  show("doorPanel", m === "door");
  show("ending", m === "end");
  show("pauseButton", m !== "intro" && m !== "end");
  document.body.classList.toggle("playing", m !== "intro");
  if (ambientGain)
    ambientGain.gain.value = sound ? (m === "playing" ? 0.018 : 0.009) : 0;
}
function reset() {
  cast.reset();
  shield = 0;
  dance = 0;
  slip = 0;
  bumps = 0;
  nearNPC = null;
  audioInit();
  audioCtx?.resume();
  candies = 0;
  seconds = 480;
  stamina = 100;
  crouch = false;
  baits = 3;
  elapsed = 0;
  noise = null;
  noiseTime = 0;
  invuln = 12;
  keys.clear();
  yaw = 0;
  pitch = 0.22;
  player.g.position.set(0, 0, 32);
  player.g.rotation.y = 0;
  player.g.visible = true;
  keeper.g.position.set(0, 0, -28);
  ai = {
    state: "patrol",
    target: { x: 0, z: -27 },
    path: [],
    repath: 0,
    lost: 0,
    search: 0,
    patrolIndex: 0,
  };
  doors.forEach((d) => {
    d.used = false;
    d.marker.visible = false;
  });
  gate.rotation.y = 0;
  show("map", false);
  setMode("playing");
  camera.position.set(1.1, 4.4, 38);
  toast("吉伊来陪你讨糖了！靠近角色按 F / X 整活，门前按 E / A。");
  updateHUD();
}
function pause() {
  if (mode === "playing") setMode("paused");
  else if (mode === "paused") setMode("playing");
  else if (mode === "door") setMode("playing");
}
function interact() {
  if (mode !== "playing") return;
  if (near === "exit") {
    if (candies >= 5) finish(true);
    else toast(`大门还需要 ${5 - candies} 颗糖果。`);
  } else if (near) {
    $("doorName").textContent = near.name;
    setMode("door");
    tone(110, 0.12);
  } else if (nearNPC) npcInteract();
}
function npcInteract() {
  if (mode === "playing" && nearNPC) cast.interact(nearNPC, player.g.position);
}
function handleCastEvent(e) {
  if (e.message) toast(e.message);
  if (e.candy) {
    candies = Math.min(5, candies + e.candy);
    updateHUD();
    tone(520, 0.3, 0.06, "triangle");
  }
  if (e.sound) tone(e.sound, 0.12, 0.08, "triangle");
  if (e.effect === "shield") shield = 25;
  if (e.effect === "dance") dance = 4;
  if (e.effect === "slip") slip = 3;
  if (e.chain > 1) toast(e.message + ` · 连锁整活 ×${e.chain}`);
}
function reward(kind) {
  if (mode !== "door" || !near || near === "exit") return;
  near.used = true;
  candies = doorReward(kind, candies);
  noise = { x: player.g.position.x, z: player.g.position.z };
  noiseTime = kind === "trick" ? 8 : 2;
  if (kind === "trick") {
    ai.state = "investigate";
    ai.target = { ...noise };
    ai.repath = 0;
    invuln = 0;
  }
  setMode("playing");
  tone(kind === "trick" ? 190 : 440, 0.5, 0.08, "triangle");
  toast(
    candies === 5
      ? "五颗糖齐了。返回南侧大门，按 E / A 逃离！"
      : kind === "trick"
        ? "拿到了两颗糖。Sahur 被响声叫来了！"
        : "得到一颗糖果。甜味更浓了。",
  );
  updateHUD();
}
function bait() {
  if (mode !== "playing") return;
  if (!baits) {
    toast("诱饵已经用完了。");
    return;
  }
  baits--;
  const p = player.g.position;
  let target = { x: p.x - Math.sin(yaw) * 9, z: p.z - Math.cos(yaw) * 9 };
  if (blocked(target.x, target.z, 0.5))
    target = { x: p.x - Math.sin(yaw) * 3, z: p.z - Math.cos(yaw) * 3 };
  noise = target;
  noiseTime = 7;
  if (ai.state !== "chase" || !clearLine(keeper.g.position, p)) {
    ai.state = "investigate";
    ai.target = { ...target };
    ai.repath = 0;
  }
  toast(`投出了糖纸诱饵 · 剩余 ${baits} 个`);
  tone(650, 0.16, 0.04);
}
function finish(win) {
  setMode("end");
  show("interact", false);
  $("endLabel").textContent = win ? "SWEET ESCAPE" : "FOREVER HALLOWEEN";
  $("endTitle").textContent = win ? "全镇事故主要责任人。" : "今晚先笑到这里。";
  $("endCopy").textContent = win
    ? "你和吉伊抱着糖果溜出小镇。身后，奶龙还在笑，Sahur 还在敲，鲨鱼还没刹住车。"
    : seconds <= 0
      ? "午夜已至。最后一盏南瓜灯熄灭了。下次，别让犹豫耗尽时间。"
      : "你今晚摔了三次，吉伊把你拖回家了。下次找伙伴帮忙，把追逐变成连锁闹剧。";
  $("endStats").textContent =
    `整活分 ${cast.score} · 糖果 ${candies} / 5 · 探索 ${Math.floor((480 - seconds) / 60)} 分 ${Math.floor((480 - seconds) % 60)} 秒`;
  tone(win ? 660 : 70, 1, 0.12, "triangle");
}
function updateHUD() {
  $("candySlots").innerHTML = Array.from(
    { length: 5 },
    (_, i) => `<i class="candy ${i < candies ? "filled" : ""}"></i>`,
  ).join("");
  $("scent").textContent = ["微弱", "微弱", "渐浓", "明显", "浓烈", "无法忽视"][
    candies
  ];
  $("scentBar").style.width = 8 + candies * 18 + "%";
  $("objectiveText").textContent =
    candies >= 5 ? "返回南侧大门 · E / A 逃离" : "寻找亮着橙灯的门";
}
function updateAI(dt) {
  if (cast.isBusy(cast.actors.find((a) => a.id === "sahur"))) {
    $("keeperStatus").textContent = "Sahur 正在认真整活…";
    $("danger").style.opacity = 0;
    return;
  }
  const k = keeper.g.position,
    p = player.g.position,
    dist = k.distanceTo(p);
  const look = new THREE.Vector3(
      -Math.sin(keeper.g.rotation.y),
      0,
      -Math.cos(keeper.g.rotation.y),
    ),
    toP = p.clone().sub(k).normalize();
  const visible =
    invuln <= 0 &&
    dist < (crouch ? 7 : 12) + candies * 1.5 &&
    clearLine(k, p) &&
    (dist < 4.5 || look.dot(toP) > -0.05);
  const heard = invuln <= 0 && runningSpeed > 4 && dist < 11 + candies;
  if (visible) {
    if (ai.state !== "chase") {
      toast("Sahur：站住！你刚才是不是没跟上拍子？");
      tone(70, 0.7, 0.1, "sawtooth");
    }
    ai.state = "chase";
    ai.target = { x: p.x, z: p.z };
    ai.lost = 0;
  } else if (ai.state === "chase") {
    ai.lost += dt;
    if (ai.lost > 2.3) {
      ai.state = "search";
      ai.search = 6;
    }
  } else if (heard) {
    ai.state = "investigate";
    ai.target = { x: p.x, z: p.z };
    ai.search = 5;
  } else if (
    noise &&
    noiseTime > 0 &&
    dist < 35 &&
    ai.state !== "investigate"
  ) {
    ai.state = "investigate";
    ai.target = { ...noise };
    ai.search = 6;
    ai.repath = 0;
  }
  if (ai.state === "patrol") {
    ai.target = patrol[ai.patrolIndex];
    if (Math.hypot(k.x - ai.target.x, k.z - ai.target.z) < 2)
      ai.patrolIndex = (ai.patrolIndex + 1) % patrol.length;
  }
  if (ai.state === "search" || ai.state === "investigate") {
    ai.search -= dt;
    if (
      ai.search <= 0 &&
      Math.hypot(k.x - ai.target.x, k.z - ai.target.z) < 3
    ) {
      ai.state = "patrol";
      ai.repath = 0;
    }
  }
  ai.repath -= dt;
  if (ai.repath <= 0) {
    ai.path = route(k, ai.target);
    ai.repath = 0.7;
  }
  let target = clearLine(k, ai.target) ? ai.target : ai.path[0];
  if (target) {
    const dx = target.x - k.x,
      dz = target.z - k.z,
      d = Math.hypot(dx, dz);
    if (d < 0.6) ai.path.shift();
    else {
      let speed =
        ai.state === "chase" ? 4.1 : ai.state === "patrol" ? 1.65 : 2.7;
      move(k, (dx / d) * speed * dt, (dz / d) * speed * dt, 0.6);
      keeper.g.rotation.y = Math.atan2(-dx, -dz);
      keeper.legs.forEach(
        (l, i) =>
          (l.rotation.x = Math.sin(elapsed * speed * 3 + i * Math.PI) * 0.35),
      );
    }
  }
  if (dist < 1.4 && invuln <= 0 && clearLine(k, p)) {
    if (shield > 0) {
      shield = 0;
      invuln = 6;
      toast("吉伊：哇——！它把 Sahur 吓得后退了。");
      k.z -= 3;
    } else {
      bumps++;
      invuln = 10;
      player.g.position.set(0, 0, 30);
      ai.state = "patrol";
      ai.target = { x: 0, z: -27 };
      ai.repath = 0;
      toast(`Sahur 把你送回起点。糖还在！摔跤 ${bumps} / 3`);
      if (bumps >= 3) finish(false);
    }
  }
  $("keeperStatus").textContent = {
    patrol: "敲钟人正在散步",
    investigate: "Sahur 来凑热闹了…",
    chase: "Sahur 要给你打节拍",
    search: "Sahur：人呢？",
  }[ai.state];
  $("keeperStatus").style.color = ai.state === "chase" ? "#ee9d77" : "#b1b8a7";
  $("danger").style.opacity =
    ai.state === "chase" ? 0.45 : Math.max(0, (10 - dist) / 30);
  if (
    ai.state === "chase" &&
    Math.floor(elapsed * 1.8) !== Math.floor((elapsed - dt) * 1.8)
  )
    tone(65, 0.15, 0.06);
  if (gamepad && $("haptics").checked && dist < 12 && elapsed > hapticTime) {
    const pad = navigator.getGamepads?.()[gamepad.index];
    pad?.vibrationActuator
      ?.playEffect("dual-rumble", {
        duration: 130,
        strongMagnitude: Math.min(0.6, (12 - dist) / 15),
        weakMagnitude: 0.15,
      })
      .catch(() => {});
    hapticTime = elapsed + 0.8;
  }
}
function mapDraw() {
  if ($("map").hidden) return;
  const cx = $("map").getContext("2d"),
    s = 2.3,
    coord = (v) => 110 + v * s;
  cx.clearRect(0, 0, 220, 220);
  cx.strokeStyle = "#9f997a66";
  cx.strokeRect(13, 13, 194, 194);
  cx.fillStyle = "#536663";
  obstacles.forEach((o) =>
    cx.fillRect(coord(o.x - o.w / 2), coord(o.z - o.d / 2), o.w * s, o.d * s),
  );
  doors.forEach((d) => {
    cx.fillStyle = d.used ? "#647165" : "#efa966";
    cx.beginPath();
    cx.arc(coord(d.x), coord(d.z), 3, 0, 7);
    cx.fill();
  });
  cx.fillStyle = candies >= 5 ? "#b5d7a0" : "#a29e86";
  cx.fillRect(101, 195, 18, 4);
  cx.fillStyle = "#e8f2dd";
  cx.beginPath();
  cx.arc(coord(player.g.position.x), coord(player.g.position.z), 4, 0, 7);
  cx.fill();
  cx.font = "9px sans-serif";
  cx.fillText("N", 106, 12);
  cx.fillText("南门 / EXIT", 80, 214);
}
function readPad() {
  const pad = Array.from(navigator.getGamepads?.() || []).find(
    (p) => p && p.connected,
  );
  if (!pad) {
    if (gamepad) {
      gamepad = false;
      oldButtons = [];
      $("inputMode").textContent = "键鼠模式";
      if (mode === "playing") {
        setMode("paused");
        toast("手柄已断开，游戏已暂停。");
      }
    }
    return null;
  }
  gamepad = pad;
  $("inputMode").textContent = "Xbox / 手柄已连接";
  const pressed = (i) => pad.buttons[i]?.pressed && !oldButtons[i];
  if (pressed(9)) pause();
  if (mode === "intro" && pressed(0)) reset();
  else if (mode === "door") {
    if (pressed(0)) reward("treat");
    else if (pressed(2)) reward("trick");
    else if (pressed(1)) setMode("playing");
  } else if (mode === "paused" && pressed(0)) setMode("playing");
  else if (mode === "end" && pressed(0)) reset();
  else if (mode === "playing") {
    if (pressed(0)) interact();
    if (pressed(2)) npcInteract();
    if (pressed(1)) crouch = !crouch;
    if (pressed(3)) bait();
    show("map", !!pad.buttons[4]?.pressed);
  }
  oldButtons = pad.buttons.map((b) => b.pressed);
  return pad;
}
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  const pad = readPad();
  motes.rotation.y += dt * 0.006;
  if (mode === "intro") {
    const t = now * 0.00004;
    camera.position.set(2 + Math.sin(t) * 0.8, 5.8, 33);
    camera.lookAt(0, 4, -14);
    keeper.g.visible = true;
    keeper.g.position.set(-2, 0, -7);
    keeper.g.rotation.y = Math.PI * 0.9;
    cast.actors.forEach((a) => animateCharacter(a, now * 0.001, 0));
  }
  if (mode === "playing") {
    elapsed += dt;
    shield = Math.max(0, shield - dt);
    dance = Math.max(0, dance - dt);
    slip = Math.max(0, slip - dt);
    seconds = Math.max(0, seconds - dt);
    invuln -= dt;
    noiseTime -= dt;
    toastTime -= dt;
    if (toastTime <= 0) $("toast").style.opacity = 0;
    let ax = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      az = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
    let sprint = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const dead = (v) => (Math.abs(v || 0) > 0.16 ? v : 0);
    if (pad) {
      ax += dead(pad.axes[0]);
      az -= dead(pad.axes[1]);
      yaw -= dead(pad.axes[2]) * dt * 2.4;
      pitch = Math.max(-0.15, Math.min(0.8, pitch + dead(pad.axes[3]) * dt));
      sprint = pad.buttons[7]?.value > 0.35 || sprint;
    }
    yaw +=
      ((keys.has("ArrowLeft") ? 1 : 0) - (keys.has("ArrowRight") ? 1 : 0)) *
      dt *
      2;
    pitch = Math.max(
      -0.15,
      Math.min(
        0.8,
        pitch +
          ((keys.has("ArrowDown") ? 1 : 0) - (keys.has("ArrowUp") ? 1 : 0)) *
            dt,
      ),
    );
    const length = Math.hypot(ax, az);
    if (length > 1) {
      ax /= length;
      az /= length;
    }
    const isRunning = sprint && stamina > 2 && !crouch && length > 0.1;
    runningSpeed =
      length > 0.1
        ? (crouch ? 1.8 : isRunning ? 6 : 3.5) * (slip > 0 ? 0.45 : 1)
        : 0;
    stamina = Math.max(0, Math.min(100, stamina + (isRunning ? -23 : 15) * dt));
    const dx = (ax * Math.cos(yaw) - az * Math.sin(yaw)) * runningSpeed * dt,
      dz = (-ax * Math.sin(yaw) - az * Math.cos(yaw)) * runningSpeed * dt;
    move(player.g.position, dx, dz);
    if (length > 0.1) {
      const target = Math.atan2(-dx, -dz);
      let dif = target - player.g.rotation.y;
      dif = Math.atan2(Math.sin(dif), Math.cos(dif));
      player.g.rotation.y += dif * Math.min(1, dt * 13);
    }
    player.body.scale.y = THREE.MathUtils.lerp(
      player.body.scale.y,
      crouch ? 0.67 : 1,
      dt * 12,
    );
    player.legs.forEach(
      (l, i) =>
        (l.rotation.x =
          length > 0.1
            ? Math.sin(elapsed * runningSpeed * 3 + i * Math.PI) * 0.45
            : 0),
    );
    animateCharacter(player, elapsed, runningSpeed);
    if (dance > 0) {
      player.body.rotation.y = Math.PI + elapsed * 6;
      player.body.position.y = Math.abs(Math.sin(elapsed * 9)) * 0.18;
    } else player.body.rotation.y = Math.PI;
    cast.update(dt, player.g.position, runningSpeed).forEach(handleCastEvent);
    updateAI(dt);
    const p = player.g.position;
    nearNPC = cast.nearest(p);
    show("actorAction", !!nearNPC);
    if (nearNPC)
      $("actorAction").innerHTML =
        `<kbd>${gamepad ? "X" : "F"}</kbd> ${nearNPC.info.action}${nearNPC.used ? "" : " · +1 糖"}`;
    $("chaosCount").textContent = cast.score;
    $("companionStatus").textContent =
      shield > 0 ? "吉伊护盾已就绪" : "吉伊跟着你 · 靠近按 F 打气";
    near = null;
    let nd = 3.1;
    doors.forEach((d) => {
      const distance = Math.hypot(d.x - p.x, d.z - p.z);
      d.marker.visible = !d.used && distance < 12;
      if (!d.used && distance < nd) {
        near = d;
        nd = distance;
      }
    });
    if (Math.hypot(p.x, p.z - 36) < 4) near = "exit";
    show("interact", !!near);
    if (near) {
      $("interact").innerHTML =
        `<kbd>${gamepad ? "A" : "E"}</kbd><span>${near === "exit" ? (candies >= 5 ? "推开大门 · 逃离" : "大门封印 · 需要 5 颗糖") : "敲门讨糖"}</span>`;
    }
    gate.rotation.y = THREE.MathUtils.lerp(
      gate.rotation.y,
      candies >= 5 ? 1.2 : 0,
      dt * 2,
    );
    $("time").textContent =
      `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
    $("stamina").style.width = stamina + "%";
    $("coordinates").textContent = crouch
      ? "CROUCHING · 蹲下"
      : p.z > 27
        ? "THE SOUTH GATE"
        : p.z < -20
          ? "THE CLOCK QUARTER"
          : "THE CROOKED LANE";
    if (seconds <= 0) finish(false);
    mapDraw();
    const focus = p.clone().add(new THREE.Vector3(0, crouch ? 1.05 : 1.6, 0)),
      offset = new THREE.Vector3(
        Math.sin(yaw) * 5.6 + Math.cos(yaw) * 0.75,
        2.1 + pitch * 4,
        Math.cos(yaw) * 5.6 - Math.sin(yaw) * 0.75,
      );
    let desired = focus.clone().add(offset);
    for (let t = 0.12; t < 1; t += 0.06) {
      const q = focus.clone().lerp(desired, t);
      if (blocked(q.x, q.z, 0.25)) {
        desired = focus.clone().lerp(desired, Math.max(0.12, t - 0.08));
        break;
      }
    }
    camera.position.lerp(desired, 1 - Math.exp(-dt * 12));
    camera.lookAt(
      focus
        .clone()
        .add(
          new THREE.Vector3(
            -Math.sin(yaw) * 2,
            0.3 - pitch * 2,
            -Math.cos(yaw) * 2,
          ),
        ),
    );
  }
  renderer.render(scene, camera);
  if (mode === "intro") showcase.render(now * 0.001);
}
$("start").onclick = reset;
$("resume").onclick = () => setMode("playing");
$("pauseButton").onclick = pause;
$("restart").onclick = reset;
$("again").onclick = reset;
$("backTitle").onclick = () => {
  player.g.visible = false;
  $("danger").style.opacity = 0;
  setMode("intro");
};
$("treat").onclick = () => reward("treat");
$("trick").onclick = () => reward("trick");
$("leaveDoor").onclick = () => setMode("playing");
$("sound").onclick = () => {
  sound = !sound;
  $("sound").textContent = `声音 · ${sound ? "开" : "关"}`;
  if (ambientGain) ambientGain.gain.value = sound ? 0.018 : 0;
};
$("quality").onchange = () => {
  const high = $("quality").value === "high";
  renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 1.7) : 1);
  renderer.shadowMap.enabled = high;
  scene.traverse((o) => {
    if (o.material) o.material.needsUpdate = true;
  });
};
addEventListener("keydown", (e) => {
  if (
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space",
      "Tab",
    ].includes(e.code) &&
    mode === "playing"
  )
    e.preventDefault();
  if (e.repeat) return;
  keys.add(e.code);
  if (e.code === "Escape") pause();
  if (mode === "door") {
    if (e.code === "Digit1") reward("treat");
    if (e.code === "Digit2") reward("trick");
  } else if (mode === "playing") {
    if (e.code === "KeyE") interact();
    if (e.code === "KeyF") npcInteract();
    if (e.code === "KeyC") crouch = !crouch;
    if (e.code === "KeyQ") bait();
    if (e.code === "KeyM") show("map", $("map").hidden);
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => {
  keys.clear();
  dragging = false;
  if (mode === "playing" || mode === "door") setMode("paused");
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (mode === "playing" || mode === "door"))
    setMode("paused");
});
canvas.addEventListener("pointerdown", (e) => {
  if (mode === "playing" || mode === "intro") {
    dragging = true;
    lastMouse = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging && mode === "intro") {
    showcase.turn((e.clientX - lastMouse.x) * 0.008);
    lastMouse = { x: e.clientX, y: e.clientY };
  } else if (dragging && mode === "playing") {
    yaw -= (e.clientX - lastMouse.x) * 0.004;
    pitch = Math.max(
      -0.15,
      Math.min(0.8, pitch + (e.clientY - lastMouse.y) * 0.003),
    );
    lastMouse = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});
updateHUD();
$("loading").hidden = true;
requestAnimationFrame(tick);

function selectCast(i) {
  const info = showcase.select(i);
  $("castName").textContent = info.name;
  $("castEnglish").textContent = info.english;
  $("castRole").textContent = info.role;
  $("castOutfit").textContent = info.description;
  document.querySelectorAll("[data-cast]").forEach((b, n) => {
    b.classList.toggle("selected", n === showcase.index);
    b.setAttribute("aria-pressed", String(n === showcase.index));
  });
}
$("castSelector").innerHTML = CAST.map(
  (c, i) =>
    `<button data-cast='${i}' aria-label='查看${c.name}模型' aria-pressed='${i === 0}'><i style='background:${c.color}'></i><span>${c.name}</span></button>`,
).join("");
document
  .querySelectorAll("[data-cast]")
  .forEach((b, i) => (b.onclick = () => selectCast(i)));
$("castPrev").onclick = () => selectCast(showcase.index - 1);
$("castNext").onclick = () => selectCast(showcase.index + 1);
$("castAnimate").onclick = () => showcase.animate();
$("actorAction").onclick = npcInteract;
selectCast(0);
