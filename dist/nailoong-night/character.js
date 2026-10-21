import * as THREE from '../vendor/three.module.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';

let assetPromise;
const MODEL_URL = new URL('../assets/nailoong.glb', import.meta.url).href;
const TAU = Math.PI * 2;

function material(color, roughness = .65, extra = {}) {
 return new THREE.MeshPhysicalMaterial({color, roughness, metalness:0, ...extra});
}
function mesh(geometry, surface, parent, name) {
 const object = new THREE.Mesh(geometry, surface);
 object.name = name;
 object.castShadow = true;
 object.receiveShadow = true;
 parent.add(object);
 return object;
}
function tube(points, radius, surface, parent, name) {
 const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
 return mesh(new THREE.TubeGeometry(curve, 40, radius, 7, false), surface, parent, name);
}
function frame(width, height, thickness, surface, parent, name) {
 const shape = new THREE.Shape();
 shape.moveTo(-width / 2, -height / 2);
 shape.lineTo(width / 2, -height / 2);shape.lineTo(width / 2, height / 2);
 shape.lineTo(-width / 2, height / 2);shape.closePath();
 const hole = new THREE.Path(), inset = .028;
 hole.moveTo(-width / 2 + inset, -height / 2 + inset);
 hole.lineTo(-width / 2 + inset, height / 2 - inset);
 hole.lineTo(width / 2 - inset, height / 2 - inset);
 hole.lineTo(width / 2 - inset, -height / 2 + inset);hole.closePath();
 shape.holes.push(hole);
 return mesh(new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:true,bevelSize:.006,bevelThickness:.006,bevelSegments:2,steps:1}),surface,parent,name);
}

function witchHat(torso, top) {
 const hat = new THREE.Group();hat.name = 'HalloweenWitchHat';
 hat.position.set(-.07, top - .075, -.035);hat.rotation.z = -.075;
 torso.add(hat);
 const cloth = material('#21152f',.72,{sheen:.5,sheenColor:new THREE.Color('#6b4384'),sheenRoughness:.8});
 const band = material('#d86a22',.62), gold = material('#e4ad50',.3,{metalness:.55});
 const brimGeometry = new THREE.CylinderGeometry(.61,.63,.045,64,1);
 const brimPositions = brimGeometry.attributes.position;
 for(let i=0;i<brimPositions.count;i++) {
  const x=brimPositions.getX(i),z=brimPositions.getZ(i),angle=Math.atan2(z,x);
  brimPositions.setY(i,brimPositions.getY(i)+Math.sin(angle*3+.4)*.018*Math.hypot(x,z)/.63);
 }
 brimGeometry.computeVertexNormals();
 const brim=mesh(brimGeometry,cloth,hat,'SoftWitchBrim');brim.scale.z=.84;
 // A gently bent, tapered crown; the face and eyes stay below the brim.
 const rings=[[0,.345,0],[.16,.305,-.018],[.35,.25,-.06],[.54,.18,-.09],[.71,.105,-.08],[.83,.054,.015],[.89,.021,.12],[.89,.002,.20]];
 const positions=[],indices=[],segments=48;
 for(const [y,r,x] of rings)for(let j=0;j<=segments;j++) {
  const angle=j/segments*TAU;
  positions.push(x+Math.cos(angle)*r,y,Math.sin(angle)*r*.88);
 }
 for(let i=0;i<rings.length-1;i++)for(let j=0;j<segments;j++) {
  const a=i*(segments+1)+j,b=a+segments+1;
  indices.push(a,b,a+1,a+1,b,b+1);
 }
 const crownGeometry=new THREE.BufferGeometry();
 crownGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 crownGeometry.setIndex(indices);crownGeometry.computeVertexNormals();
 mesh(crownGeometry,cloth,hat,'BentWitchCrown');
 const ribbon=mesh(new THREE.CylinderGeometry(.321,.35,.13,64,1,true),band,hat,'BurntOrangeHatRibbon');
 ribbon.position.y=.077;ribbon.scale.z=.89;
 const buckle=frame(.155,.13,.018,gold,hat,'SmallGoldHatBuckle');buckle.position.set(-.012,.088,.315);
 tube([[-.064,.088,.345],[.045,.088,.345]],.009,gold,hat,'BucklePin');
 return hat;
}

function shortCape(torso) {
 const cape=new THREE.Group();cape.name='HalloweenShortCape';cape.position.y=3.12;torso.add(cape);
 const cloth=material('#4d1e5a',.8,{side:THREE.DoubleSide,sheen:.65,sheenColor:new THREE.Color('#a8508c'),sheenRoughness:.85});
 const trim=material('#e2a85d',.45,{metalness:.18});
 const positions=[],indices=[],rows=24,columns=48;
 const profile=[[0,.77,.56],[.35,1.11,.80],[.65,1.29,.94],[1,1.22,1.00]];
 function point(t,u) {
  let i=0;while(i<profile.length-2&&t>profile[i+1][0])i++;
  const a=profile[i],b=profile[i+1],f=(t-a[0])/(b[0]-a[0]);
  const radiusX=THREE.MathUtils.lerp(a[1],b[1],f),radiusZ=THREE.MathUtils.lerp(a[2],b[2],f),angle=u*1.43;
  const pleat=Math.cos(u*Math.PI*5)*.025*t;
  return [Math.sin(angle)*(radiusX+pleat),-1.38*t+Math.pow(t,8)*.045*(1+Math.cos(u*Math.PI*5)),-Math.cos(angle)*(radiusZ+pleat)-.035];
 }
 for(let i=0;i<=rows;i++)for(let j=0;j<=columns;j++)positions.push(...point(i/rows,j/columns*2-1));
 for(let i=0;i<rows;i++)for(let j=0;j<columns;j++) {
  const a=i*(columns+1)+j,b=a+columns+1;indices.push(a,b,a+1,a+1,b,b+1);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 mesh(geometry,cloth,cape,'PleatedCapeCloth');
 for(const side of [-1,1])tube(Array.from({length:12},(_,i)=>point(i/11,side)),.012,trim,cape,'CapeGoldEdge');
 tube(Array.from({length:33},(_,i)=>point(1,i/16-1)),.013,trim,cape,'ScallopedCapeHem');
 // The neck cord sits below the mouth; the actual hands remain uncovered.
 tube([[-.58,-.015,.1],[-.36,-.055,.355],[0,-.09,.405],[.36,-.055,.355],[.58,-.015,.1]],.017,trim,cape,'CapeNeckCord');
 const clasp=mesh(new THREE.SphereGeometry(.075,16,12),material('#ed9141',.42),cape,'PumpkinCapeClasp');
 clasp.scale.set(1,.85,.48);clasp.position.set(0,-.09,.43);
 return cape;
}

function pumpkinBucket(hand) {
 const swing=new THREE.Group();swing.name='HalloweenBucketGrip';hand.add(swing);
 const bucket=new THREE.Group();bucket.name='PumpkinCandyBucket';bucket.position.set(.23,-.56,.34);swing.add(bucket);
 const orange=material('#e77125',.4,{clearcoat:.35,clearcoatRoughness:.5});
 const dark=material('#271b27',.64),gold=material('#c59a5c',.4,{metalness:.5});
 const profile=[new THREE.Vector2(.02,-.25),new THREE.Vector2(.18,-.24),new THREE.Vector2(.29,-.16),new THREE.Vector2(.34,-.015),new THREE.Vector2(.315,.12),new THREE.Vector2(.25,.225),new THREE.Vector2(.218,.225),new THREE.Vector2(.285,.105),new THREE.Vector2(.302,-.01),new THREE.Vector2(.255,-.15),new THREE.Vector2(.15,-.205),new THREE.Vector2(.02,-.205)];
 const geometry=new THREE.LatheGeometry(profile,64),position=geometry.attributes.position;
 for(let i=0;i<position.count;i++) {
  const x=position.getX(i),z=position.getZ(i),rib=1+.035*Math.cos(Math.atan2(z,x)*10);
  position.setX(i,x*rib);position.setZ(i,z*rib);
 }
 geometry.computeVertexNormals();mesh(geometry,orange,bucket,'RibbedOpenPumpkinPail');
 const rim=mesh(new THREE.TorusGeometry(.239,.018,10,64),orange,bucket,'PumpkinBucketRim');rim.rotation.x=Math.PI/2;rim.position.y=.223;
 const inside=mesh(new THREE.CircleGeometry(.214,48),dark,bucket,'DarkBucketInterior');inside.rotation.x=-Math.PI/2;inside.position.y=.07;
 tube([[-.29,.14,0],[-.34,.39,-.12],[-.23,.56,-.34],[.12,.53,-.22],[.31,.14,0]],.022,gold,bucket,'PumpkinCarryHandle');
 for(const side of [-1,1]) {
  const eye=new THREE.Shape();eye.moveTo(-.05,-.035);eye.lineTo(.05,-.035);eye.lineTo(.015,.05);eye.closePath();
  const piece=mesh(new THREE.ShapeGeometry(eye),dark,bucket,'PumpkinEye');piece.position.set(side*.105,.045,.334);piece.rotation.y=side*.19;
 }
 const grin=new THREE.Shape();
 grin.moveTo(-.145,-.025);grin.lineTo(-.09,-.072);grin.lineTo(0,-.095);grin.lineTo(.09,-.072);grin.lineTo(.145,-.025);
 grin.lineTo(.06,-.035);grin.lineTo(.06,-.06);grin.lineTo(.025,-.06);grin.lineTo(.025,-.04);grin.lineTo(-.055,-.04);grin.lineTo(-.055,-.065);grin.lineTo(-.085,-.06);grin.lineTo(-.085,-.035);grin.closePath();
 const mouth=mesh(new THREE.ShapeGeometry(grin),dark,bucket,'PumpkinGrin');mouth.position.set(0,-.065,.339);
 const candyColors=['#ef83af','#9ad6b0','#f5d276','#c7a5e7'];
 candyColors.forEach((color,i)=>{
  const sweet=mesh(new THREE.SphereGeometry(.065,14,10),material(color,.34),bucket,'WrappedCandy');
  const angle=i*2.2;sweet.position.set(Math.cos(angle)*.11,.145+(i%2)*.02,Math.sin(angle)*.1);sweet.scale.set(1,.65,.8);sweet.rotation.y=angle;
  const wrapper=mesh(new THREE.CylinderGeometry(.037,.014,.035,6),sweet.material,bucket,'CandyWrapperTwist');
  wrapper.rotation.z=Math.PI/2;wrapper.position.copy(sweet.position).add(new THREE.Vector3(.07,0,0));
 });
 return swing;
}

function legPivot(rig, leg, x) {
 if(!leg)return null;
 const pivot=new THREE.Group();pivot.name=`${leg.name}WalkingPivot`;pivot.position.set(x,1.17,0);
 rig.add(pivot);pivot.add(leg);leg.position.sub(pivot.position);
 return {pivot,baseY:pivot.position.y};
}

export async function createNailoong() {
 // One network load, but independent materials, hierarchy and mixer per actor.
 if(!assetPromise)assetPromise=new GLTFLoader().loadAsync(MODEL_URL).catch(error=>{assetPromise=null;throw error;});
 const asset=await assetPromise;
 const model=asset.scene.clone(true);model.name='NailoongOriginalGLB';
 const rig=model.getObjectByName('Nailoong'),torso=model.getObjectByName('Torso');
 if(!rig||!torso)throw new Error('The Nailoong GLB is missing its original torso rig.');
 model.traverse(object=>{
  if(!object.isMesh)return;
  object.castShadow=true;object.receiveShadow=true;
  const improve=source=>{
   const copy=source.clone();
   // Preserve original vertex colors, eyes and belly shading. No recoloring.
   if(typeof copy.roughness==='number')copy.roughness=THREE.MathUtils.clamp(copy.roughness,.15,.8);
   if(typeof copy.metalness==='number')copy.metalness=Math.min(copy.metalness,.08);
   copy.envMapIntensity=.85;return copy;
  };
  object.material=Array.isArray(object.material)?object.material.map(improve):improve(object.material);
 });
 model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),rawHeight=bounds.max.y-bounds.min.y;
 if(!Number.isFinite(rawHeight)||rawHeight<=0)throw new Error('The Nailoong model has invalid dimensions.');
 const group=new THREE.Group();group.name='NailoongCharacter';
 const motion=new THREE.Group();motion.name='NailoongBodyMotion';group.add(motion);
 const scaleRoot=new THREE.Group();scaleRoot.name='NailoongMeterScale';scaleRoot.scale.setScalar(3/rawHeight);motion.add(scaleRoot);
 model.position.y-=bounds.min.y;scaleRoot.add(model);
 const torsoSway=new THREE.Group();torsoSway.name='NailoongProceduralSway';rig.add(torsoSway);torsoSway.add(torso);
 const left=legPivot(rig,model.getObjectByName('LegL'),-.59),right=legPivot(rig,model.getObjectByName('LegR'),.59);
 const hand=model.getObjectByName('ArmR')?.getObjectByName('Hand');
 const hat=witchHat(torso,bounds.max.y),cape=shortCape(torso),bucket=hand?pumpkinBucket(hand):null;
 const accessories=[hat,cape,bucket].filter(Boolean);
 const mixer=new THREE.AnimationMixer(model),actions={};
 for(const [mode,name] of [['idle','Idle_Breathe'],['laugh','Laugh_Belly']]) {
  const clip=asset.animations.find(candidate=>candidate.name===name);
  if(!clip)throw new Error(`The original ${name} animation is missing.`);
  actions[mode]=mixer.clipAction(clip).setLoop(THREE.LoopRepeat,Infinity);
 }
 actions.idle.play();
 let mode='idle',elapsed=0,stride=0,movement=0;
 group.userData={bodyHeight:3,originalHeight:rawHeight,forward:'+Z',source:'../assets/nailoong.glb',clips:asset.animations.map(clip=>clip.name),halloween:true};

 function update(dt,time,{moving=false,laughing=false,speed=0}={}) {
  const step=Number.isFinite(dt)?THREE.MathUtils.clamp(dt,0,.1):0;
  elapsed+=step;const clock=Number.isFinite(time)?time:elapsed;
  const next=laughing?'laugh':'idle';
  if(next!==mode) {
   actions[next].reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
   actions[mode].crossFadeTo(actions[next],.22,false);mode=next;
  }
  mixer.update(step);
  const pace=Number.isFinite(speed)?Math.max(0,speed):0;
  const target=moving?THREE.MathUtils.clamp(pace/3,.45,1):0;
  movement=THREE.MathUtils.damp(movement,target,9,step);
  stride+=step*(6+Math.min(pace,6)*1.25)*(moving?1:movement);
  const strength=movement*(laughing?.35:1);
  // Keep procedural motion outside the animated nodes: constant clip tracks
  // may skip repeated property writes, so additive Euler edits would drift.
  torsoSway.rotation.z=Math.sin(stride)*.035*strength;
  torsoSway.rotation.x=.025*strength;
  motion.position.y=(1-Math.cos(stride*2))*.012*strength;
  motion.rotation.y=Math.sin(stride)*.022*strength;
  for(const [leg,sign] of [[left,1],[right,-1]])if(leg) {
   const angle=Math.sin(stride)*.20*strength*sign;
   leg.pivot.rotation.x=angle;
   // The original unskinned leg meshes have world-like vertex coordinates.
   // Hip pivots permit a modest procedural gait; lift prevents foot clipping.
   const lowest=leg.baseY-leg.baseY*Math.cos(angle)-(angle>=0?.67:-.35)*Math.sin(angle);
   leg.pivot.position.y=leg.baseY+Math.max(0,-lowest)+Math.max(0,Math.sin(stride)*sign)*.035*strength;
  }
  cape.rotation.x=.012+Math.sin(clock*1.8)*.006+.026*movement;
  cape.rotation.z=Math.sin(stride+.6)*.014*movement;
  if(bucket) {
   bucket.rotation.z=Math.sin(stride+.5)*.07*movement+Math.sin(clock*1.4)*.012;
   bucket.rotation.x=Math.sin(stride)*.04*movement;
  }
 }
 function setHalloween(enabled) {
  const visible=Boolean(enabled);accessories.forEach(accessory=>{accessory.visible=visible;});group.userData.halloween=visible;
 }
 update(0,0);
 return {group,update,setHalloween,model};
}
