import * as T from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
const canvas=document.querySelector('#nailoong');
let renderer,scene,camera,mixer,actions,mode='idle',raf;
export async function initModel(){
 try{
  renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
  scene=new T.Scene();camera=new T.PerspectiveCamera(35,1,.1,30);camera.position.set(.25,2.2,8);camera.lookAt(0,2.05,0);
  scene.add(new T.HemisphereLight(0xfff5dc,0x6e5b96,2));const key=new T.DirectionalLight(0xfff0cc,3);key.position.set(-3,5,6);scene.add(key);const rim=new T.DirectionalLight(0xb3a2ff,2);rim.position.set(4,3,-2);scene.add(rim);
  const gltf=await new GLTFLoader().loadAsync('../assets/nailoong.glb');scene.add(gltf.scene);mixer=new T.AnimationMixer(gltf.scene);actions={idle:mixer.clipAction(gltf.animations.find(a=>a.name==='Idle_Breathe')),laugh:mixer.clipAction(gltf.animations.find(a=>a.name==='Laugh_Belly'))};actions.idle.play();
  const resize=()=>{const r=canvas.parentElement.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();};new ResizeObserver(resize).observe(canvas.parentElement);resize();
  let last=0;const frame=t=>{const dt=Math.min((t-last)/1000,.05);last=t;if(!document.hidden){mixer.update(dt);renderer.render(scene,camera);}raf=requestAnimationFrame(frame)};raf=requestAnimationFrame(frame);
 }catch{canvas.hidden=true;document.querySelector('#model-fallback').hidden=false;}
}
export function setLaugh(laugh){if(!actions)return;const next=laugh?'laugh':'idle';if(next!==mode){actions[mode].stop();mode=next;actions[mode].reset().play()}}
export function snapshotModel(){if(!renderer)return null;renderer.render(scene,camera);return canvas;}
