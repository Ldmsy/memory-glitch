import * as THREE from "./vendor/three.module.js";
import { CAST, createCharacter, animateCharacter } from "./characters.js";

export function createShowcase(renderer) {
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 50);
  camera.position.set(0, 2.8, 11.5);
  camera.lookAt(0, 0.65, 0);
  scene.add(new THREE.HemisphereLight("#f2e7e3", "#6b637c", 3));
  const key = new THREE.DirectionalLight("#fff0d5", 4);
  key.position.set(-3, 5, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight("#8cbbea", 3);
  rim.position.set(3, 3, -2);
  scene.add(rim);
  const podium = new THREE.Mesh(
    new THREE.CylinderGeometry(1.7, 1.78, 0.24, 80),
    new THREE.MeshStandardMaterial({
      color: "#374958",
      roughness: 0.4,
      metalness: 0.25,
    }),
  );
  podium.position.y = 0.3;
  scene.add(podium);
  for (const r of [1.7, 1.5]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(r, 0.013, 8, 100),
      new THREE.MeshBasicMaterial({ color: "#ddb57f" }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.435;
    scene.add(ring);
  }
  const cast = CAST.map((c) => {
    const actor = createCharacter(c.id);
    actor.g.rotation.y = Math.PI;
    actor.g.scale.setScalar(0.85);
    actor.g.position.y = 0.45;
    actor.g.visible = false;
    scene.add(actor.g);
    return actor;
  });
  let index = 0,
    spin = 0,
    excited = 0;
  cast[0].g.visible = true;
  function select(i) {
    cast[index].g.visible = false;
    index = (i + CAST.length) % CAST.length;
    cast[index].g.visible = true;
    excited = 1.7;
    spin = 0;
    return CAST[index];
  }
  return {
    select,
    get index() {
      return index;
    },
    render(time) {
      const actor = cast[index];
      animateCharacter(actor, time, 0, excited > 0 ? "laugh" : "idle");
      excited -= 0.016;
      actor.g.rotation.y = Math.PI + Math.sin(time * 0.35) * 0.15 + spin;
      const w = innerWidth,
        h = innerHeight,
        x = w < 700 ? 0 : w * 0.42,
        width = w - x,
        viewHeight = w < 700 ? h * .43 : h,
        viewBottom = w < 700 ? h * .22 : 0;
      camera.position.set(0,w<700?2.2:2.8,w<700?8.8:11.5);
      camera.lookAt(0,w<700?1.2:.65,0);
      actor.g.scale.setScalar(w<700?1:.85);
      camera.aspect = width / viewHeight;
      camera.updateProjectionMatrix();
      renderer.autoClear = false;
      renderer.clearDepth();
      renderer.setViewport(x, viewBottom, width, viewHeight);
      renderer.render(scene, camera);
      renderer.setViewport(0, 0, w, h);
      renderer.autoClear = true;
    },
    turn(amount) {
      spin += amount;
    },
    animate() {
      excited = 3;
    },
  };
}
