import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

let asset;
// Read once; each scene gets its own hierarchy and animation mixer.
export async function preloadNailong(bytes) {
  const loader = new GLTFLoader();
  asset = bytes
    ? await loader.parseAsync(bytes, '')
    : await loader.loadAsync(new URL('./assets/nailoong.glb', import.meta.url).href);
}

export function buildReferenceNailong(body) {
  if (!asset) throw new Error('Nailoong model must finish loading first');
  const model = asset.scene.clone(true);
  model.name = 'ReferenceNailoong';
  model.scale.setScalar(.74);
  model.traverse(o => {
    if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; }
  });
  body.add(model);
  const mixer = new THREE.AnimationMixer(model);
  const actions = {
    idle: mixer.clipAction(asset.animations.find(c => c.name === 'Idle_Breathe')),
    laugh: mixer.clipAction(asset.animations.find(c => c.name === 'Laugh_Belly')),
  };
  let mode = 'idle', lastTime;
  actions.idle.play();
  return {
    height: 4.125 * .74,
    legs: [], arms: [],
    referenceModel: model,
    animateReference(time, emotion) {
      const next = emotion === 'laugh' ? 'laugh' : 'idle';
      if (next !== mode) {
        actions[mode].stop();
        mode = next;
        actions[mode].reset().play();
      }
      const dt = lastTime === undefined ? 0 : Math.max(0, Math.min(.1, time - lastTime));
      lastTime = time;
      mixer.update(dt);
    },
  };
}
