import * as THREE from '../vendor/three.module.js';
import { createFestival, createGhost } from './world.js';
import { createNailoong } from './character.js';
import { GOAL, newRun, advance, collect, visit, laugh, hit, escape, canEscape, moveWithinArena } from './rules.js';
import { ControllerInput, controllerCommands } from './controller.js';

const $ = id => document.getElementById(id);
const canvas = $('game-canvas');
const show = (id, visible) => { if ($(id)) $(id).hidden = !visible; };
let renderer, scene, camera, festival, hero;
let mode = 'loading', run = newRun(), time = 0, last = performance.now();
let destination = null, destinationStation = null, route = [], nearest = null;
let laughing = 0, toastUntil = 0, sound = true, audio;
const controller = new ControllerInput();
let lastControllerStatus = '';
let endShown = false, escapeAnnounced = false, lastFootstep = 0;
let overview = false;
const cameraCenter = new THREE.Vector3(0,0,3);
const keys = new Set(), moving = new THREE.Vector3(), lookAt = new THREE.Vector3();
const pickups = [], ghosts = [], bursts = [], labels = [];
let stage, ring, ringAge = 100, targetMarker, homeLight;
const pointer = new THREE.Vector2(), raycaster = new THREE.Raycaster();
const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const colors = ['#ff9a42', '#ee6388', '#79d8b0', '#ede39c'];
const ghostStarts = [[-8,-1],[9,-1],[-5,-8],[7,9]];
const quips = ['BOO? ...BRO.', 'I QUIT HAUNTING.', 'YOUR BELLY IS A JUMPSCARE.', 'THIS WAS NOT IN MY CONTRACT.', 'I AM CALLING GHOST HR.'];

function toast(text, seconds = 3) {
  $('toast').textContent = text;
  $('toast').classList.add('visible');
  toastUntil = time + seconds;
}

function soundNote(freq, delay = 0, duration = .13, type = 'sine', volume = .045) {
  if (!sound || !audio) return;
  const osc = audio.createOscillator(), gain = audio.createGain(), t = audio.currentTime + delay;
  osc.type = type; osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * .7, t + duration);
  gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(volume, t + .012);
  gain.gain.exponentialRampToValueAtTime(.001, t + duration);
  osc.connect(gain); gain.connect(audio.destination); osc.start(t); osc.stop(t + duration + .02);
}

function updateHUD() {
  $('timer').textContent = `${Math.floor(run.seconds / 60)}:${String(Math.ceil(run.seconds % 60)).padStart(2,'0')}`;
  if (run.seconds > 0 && Math.ceil(run.seconds % 60) === 60) $('timer').textContent = `${Math.ceil(run.seconds / 60)}:00`;
  $('timer').classList.toggle('urgent', run.seconds < 20);
  $('candy-count').textContent = `${run.candies} / ${GOAL.candies}`;
  $('house-count').textContent = `${run.visited.length} / ${GOAL.houses}`;
  $('hearts').textContent = '♥'.repeat(GOAL.hearts - run.hits) + '♡'.repeat(run.hits);
  $('hearts').setAttribute('aria-label', `${GOAL.hearts - run.hits} lives remaining`);
  $('laugh-fill').style.width = `${100 * (1 - run.laughCooldown / 6)}%`;
  $('laugh-label').textContent = run.laughCooldown > .05 ? `RECHARGING ${Math.ceil(run.laughCooldown)}s` : 'BELLY LAUGH · READY';
  document.querySelectorAll('[data-station]').forEach(button => {
    const done = run.visited.includes(button.dataset.station);
    button.classList.toggle('visited', done);
    button.setAttribute('aria-label', `${done ? 'Visited' : 'Walk to'} ${button.textContent.trim()}`);
  });
  if ($('go-exit')) $('go-exit').disabled = !canEscape(run);
  if ($('dash-fill')) $('dash-fill').style.width = `${run.stamina}%`;
}

function setMode(next) {
  mode = next;
  document.body.classList.toggle('playing', ['playing','paused','end'].includes(next));
  show('intro', next === 'intro' || next === 'loading');
  show('hud', !['intro','loading'].includes(next));
  show('pause-panel', next === 'paused');
  show('end-panel', next === 'end');
  show('mobile-controls', next === 'playing');
  show('prompt', false);
  if (next !== 'playing') { keys.clear(); moving.set(0,0,0); }
}

const candyMaterials = colors.map(color => new THREE.MeshStandardMaterial({color, roughness: .35, metalness: .08}));
const candyGeometry = new THREE.DodecahedronGeometry(.22, 0);
const wrapperGeometry = new THREE.ConeGeometry(.17, .2, 4);
function makeCandy(x,z,i) {
  const g = new THREE.Group(), mat = candyMaterials[i % colors.length];
  const sweet = new THREE.Mesh(candyGeometry, mat); sweet.scale.set(1.3,.8,.8); g.add(sweet);
  for (const s of [-1,1]) {
    const wrap = new THREE.Mesh(wrapperGeometry,mat); wrap.rotation.z = -s*Math.PI/2;
    wrap.position.x = s*.37; g.add(wrap);
  }
  g.position.set(x,.65,z); scene.add(g);
  pickups.push({g, x, z, active:true, seed:i});
}

function burst(position, amount = 14, palette = colors) {
  for (let i=0;i<amount;i++) {
    const material = new THREE.MeshBasicMaterial({color:palette[i%palette.length],transparent:true});
    const mesh = new THREE.Mesh(candyGeometry, material);
    mesh.scale.setScalar(.35+Math.random()*.5); mesh.position.copy(position); mesh.position.y+=1;
    scene.add(mesh);
    bursts.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*5,2+Math.random()*4,(Math.random()-.5)*5),life:.9+Math.random()*.5,max:1.4});
  }
}

function bubble(text, position, color='#fff0c9') {
  const c = document.createElement('canvas'); c.width=768; c.height=180;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#102522'; ctx.beginPath(); ctx.roundRect(5,5,758,150,28); ctx.fill();
  ctx.strokeStyle=color; ctx.lineWidth=4;ctx.stroke();
  ctx.fillStyle=color;ctx.font='800 36px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  const words=text.split(' '); let lines=[''];
  for(const word of words) { let i=lines.length-1; if(ctx.measureText(lines[i]+word).width>700) lines.push(word+' '); else lines[i]+=word+' '; }
  lines.slice(0,2).forEach((line,i)=>ctx.fillText(line.trim(),384,lines.length===1?80:53+i*48));
  const texture=new THREE.CanvasTexture(c), material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
  const sprite=new THREE.Sprite(material); sprite.position.copy(position);sprite.position.y=4;
  sprite.scale.set(5.4,1.27,1);sprite.renderOrder=10;scene.add(sprite);labels.push({sprite,texture,life:2.3});
}

function clearTransient() {
  for(const b of bursts) {scene.remove(b.mesh);b.mesh.material.dispose();} bursts.length=0;
  for(const l of labels) {scene.remove(l.sprite);l.texture.dispose();l.sprite.material.dispose();} labels.length=0;
}

function start() {
  if (!hero) return;
  if (!audio) { try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
  audio?.resume().catch(()=>{});
  run = newRun(); endShown=false;escapeAnnounced=false; laughing=0; ringAge=100;
  destination=null;destinationStation=null;route=[];nearest=null; keys.clear(); clearTransient();
  hero.group.scale.setScalar(1.15);hero.group.position.set(0,0,6);hero.group.rotation.set(0,Math.PI,0);hero.group.visible=true;
  cameraCenter.set(0,0,3);overview=false;
  if($('camera-button'))$('camera-button').textContent='OVERVIEW';
  stage.visible=false;festival.reset();festival.exit.setOpen(false);homeLight.visible=false;
  pickups.forEach(p=>{p.active=true;p.g.visible=true;});
  ghosts.forEach((g,i)=>{g.mesh.position.set(...[ghostStarts[i][0],.4,ghostStarts[i][1]]);g.stun=0;g.scareReady=0;g.mesh.visible=true;});
  targetMarker.visible=false;setMode('playing');resize();updateHUD();
  toast('Visit 3 houses. Collect 12 sweets. Laugh at anything suspicious.',5);
  canvas.focus();
}

function pause() {
  if(mode==='playing') {run.phase='paused';setMode('paused');$('resume').focus();}
  else if(mode==='paused') {run.phase='playing';setMode('playing');canvas.focus();}
}

function finish() {
  if(endShown) return; endShown=true;
  const won=run.phase==='won';setMode('end');
  $('end-eyebrow').textContent=won?'CASE CLOSED · CANDY SECURED':'A MINOR HAUNTING INCIDENT';
  $('end-title').textContent=won?'BOO. YOU ATE.':run.seconds===0?'MIDNIGHT CALLED.':'GHOSTED. LITERALLY.';
  $('end-copy').textContent=won?'The ghosts need therapy. You need a bigger candy bucket.':'Your belly laugh is your superpower. Get close, press Space, and turn the scare around.';
  const best = Math.round(run.candies*100+run.scared*50+(won?run.seconds*10:0));
  let record=best;try {record=Math.max(best,Number(localStorage.getItem('nailoong-night-best')||0));localStorage.setItem('nailoong-night-best',String(record));}catch{}
  $('end-stats').replaceChildren();
  for(const [value,label] of [[run.candies,'SWEETS'],[run.scared,'GHOSTS HUMBLED'],[best.toLocaleString(),'SCORE'],[record.toLocaleString(),'YOUR BEST']]) {
    const el=document.createElement('div'), strong=document.createElement('strong'),span=document.createElement('span');strong.textContent=value;span.textContent=label;el.append(strong,span);$('end-stats').append(el);
  }
  destination=null;route=[];targetMarker.visible=false;
  if(won) { laughing=20;burst(hero.group.position,45);[392,494,587,784].forEach((f,i)=>soundNote(f,i*.13,.3)); }
  else soundNote(110,0,.5,'triangle');
  $('play-again').focus();
}

function doLaugh() {
  if(mode!=='playing'||!laugh(run)) return;
  laughing=2.1;ringAge=0; ring.position.set(hero.group.position.x,.06,hero.group.position.z);
  burst(hero.group.position,10,['#f4c95f','#fff0bc']);
  [240,320,240,390,310].forEach((f,i)=>soundNote(f,i*.1,.16,'triangle',.05));
  let scared=0;
  for(const g of ghosts) {
    if(g.mesh.position.distanceTo(hero.group.position)<6.2 && g.stun<=0) {
      g.stun=4.8;g.scareReady=10;run.scared++;scared++;collect(run,1);
      bubble(quips[(run.scared-1)%quips.length],g.mesh.position);burst(g.mesh.position,14);
      g.away.copy(g.mesh.position).sub(hero.group.position).setY(0).normalize();
      if(g.away.length()<.1)g.away.set(1,0,0);
    }
  }
  toast(scared?`${scared} ghost${scared>1?'s':''} humbled. +${scared} candy. Emotional damage: unlimited.`:'HA HA HA! Get closer to a ghost to laugh the candy out of it.',3);
  updateHUD();
}

function interact(station = nearest) {
  if(mode!=='playing')return;
  if(station==='exit') {if(escape(run))finish(); else toast(`One last snack run: ${Math.max(0,12-run.candies)} sweets and ${3-run.visited.length} houses left.`);return;}
  if(!station||hero.group.position.distanceTo(station.position)>3.3)return;
  if(!visit(run,station.id)){destination=null;destinationStation=null;route=[];targetMarker.visible=false;toast('This house has already paid the belly tax.');return;}
  station.setUsed(true);burst(station.position,24);laughing=1.2;
  run.invulnerable=Math.max(run.invulnerable,5);
  for(const g of ghosts)if(g.mesh.position.distanceTo(hero.group.position)<5){g.stun=Math.max(g.stun,3);g.away.copy(g.mesh.position).sub(hero.group.position).setY(0).normalize();}
  const lines={candy:'CANDY TAX: PAID.',potion:'POTION? THAT IS SOUP.',costume:'I CAME AS MYSELF. TERRIFYING.'};
  bubble(lines[station.id]||'TRICK? TREAT. OBVIOUSLY.',hero.group.position);
  toast(`${station.label} · +3 sweets. ${run.visited.length}/3 houses. Safe on the doorstep.`);
  [523,659,784].forEach((f,i)=>soundNote(f,i*.09,.2));
  destination=null;destinationStation=null;route=[];targetMarker.visible=false;updateHUD();
}

// A small navigation grid makes click-to-walk slide around stalls, rather than stick on them.
function pathTo(goal) {
  const start={x:Math.round(hero.group.position.x),z:Math.round(hero.group.position.z)};
  const end={x:Math.max(-16,Math.min(16,Math.round(goal.x))),z:Math.max(-12,Math.min(14,Math.round(goal.z)))};
  const key=p=>`${p.x},${p.z}`, pass=(x,z)=>x>=-16&&x<=16&&z>=-12&&z<=14&&!festival.colliders.some(c=>Math.hypot(x-c.x,z-c.z)<c.r+.76);
  const queue=[start], previous=new Map([[key(start),null]]);let found=false;
  for(let i=0;i<queue.length;i++) {
    const p=queue[i];if(key(p)===key(end)){found=true;break;}
    for(const [dx,dz]of[[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]]) {
      const q={x:p.x+dx,z:p.z+dz};
      if(!pass(q.x,q.z)||previous.has(key(q))||(dx&&dz&&(!pass(p.x+dx,p.z)||!pass(p.x,p.z+dz))))continue;
      previous.set(key(q),p);queue.push(q);
    }
  }
  if(!found)return [];
  const result=[];for(let p=end;previous.get(key(p));p=previous.get(key(p)))result.unshift(new THREE.Vector3(p.x,0,p.z));
  result.push(goal.clone());return result;
}

function navigate(position, station = null) {
  if(mode!=='playing')return;
  destination=position.clone();destination.y=0;destinationStation=station;
  route=pathTo(destination);
  if(!route.length) {destination=null;destinationStation=null;toast('That patch is haunted. Try the cobblestone path.');return;}
  targetMarker.position.set(position.x,.045,position.z);targetMarker.visible=true;
}

function resize() {
  if(!renderer)return;
  const width=innerWidth,height=innerHeight,aspect=width/height;
  renderer.setSize(width,height);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
  if(mode==='intro'||mode==='loading') {
    const view=aspect<.8?15:12.6;
    if(hero){hero.group.scale.setScalar(aspect<.8?1.4:1.65);hero.group.position.set(aspect<.8?1.6:4.3,.35,3);}
    if(stage){stage.scale.setScalar(aspect<.8?.85:1);stage.position.set(aspect<.8?1.6:4.3,0,3);}
    camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;
    camera.position.set(9,8,22);lookAt.set(0,1.7,1);camera.lookAt(lookAt);
  } else {
    const view=overview?Math.max(31,39/aspect):Math.max(19.5,15/aspect);
    camera.left=-view*aspect/2;camera.right=view*aspect/2;camera.top=view/2;camera.bottom=-view/2;
    if(overview){camera.position.set(0,29,30);lookAt.set(0,0,0);camera.lookAt(lookAt);}
  }
  camera.updateProjectionMatrix();
}

function toggleCamera() {
  overview=!overview;
  $('camera-button').textContent=overview?'FOLLOW CAM':'OVERVIEW';
  $('camera-button').setAttribute('aria-label',overview?'Camera follow':'Camera overview');
  resize();
}

function controllerSnapshot() {
  try { return navigator.getGamepads?.() || []; } catch { return []; }
}

function readPad() {
  const focused = !document.hidden && document.hasFocus();
  const input = controller.poll(controllerSnapshot(), {focused});
  if(input.disconnected && mode==='playing') {
    pause(); toast('CONTROLLER DISCONNECTED · Reconnect, then press A to resume.',5);
  }
  const status = !input.enabled ? 'Controller disabled. Enable it in the pause menu.'
    : input.mapping==='unsupported' ? 'Controller detected, but its button layout is unsupported. Use keyboard or touch.'
    : input.active ? (focused ? 'Controller ready · A knock / resume · X belly laugh · B / RT dash' : 'Game paused while this tab is in the background. Return, then press A.')
    : input.connected ? 'Controller connected · Press A to play or resume.'
    : !navigator.getGamepads ? 'This browser does not expose controller input. Keyboard and touch are available.'
    : 'Xbox controller? Connect it, click this page, then press A.';
  const statusKey = `${status}|${input.id}`;
  if(statusKey!==lastControllerStatus) {
    lastControllerStatus=statusKey;
    $('controller-status').textContent=status;
    $('controller-hint').textContent=input.active ? 'XBOX · Left stick / D-pad move · A knock · X laugh · B / RT dash · Y camera · Menu pause' : status;
    const badge=$('controller-badge');
    badge.hidden=!input.connected;
    badge.textContent=!input.enabled?'CONTROLLER OFF':input.mapping==='unsupported'?'UNSUPPORTED PAD':input.active?'CONTROLLER READY':'CONTROLLER · PRESS A';
    badge.title=input.id;
    $('controller-toggle').textContent=input.enabled?'CONTROLLER AUTO · ON':'CONTROLLER OFF · ENABLE';
    $('controller-toggle').setAttribute('aria-pressed',String(input.enabled));
  }
  for(const command of controllerCommands(input, mode)) {
    if(command==='start')start();
    else if(command==='pause')pause();
    else if(command==='interact')interact();
    else if(command==='laugh')doLaugh();
    else if(command==='camera')toggleCamera();
  }
  return input;
}

function tick(dt) {
  time+=dt; const pad=readPad();festival.update(time,dt);
  if(time>toastUntil)$('toast').classList.remove('visible');
  laughing=Math.max(0,laughing-dt);
  if(mode==='intro') {
    hero.group.rotation.y=Math.sin(time*.22)*.18-.17;
    hero.update(dt,time,{laughing:Math.floor(time/9)%2===1,moving:false});
  } else {
    moving.set(0,0,0);
    if(mode==='playing') {
      moving.set((keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+pad.x,0,(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+pad.z);
      if(moving.length()>.1) {destination=null;destinationStation=null;route=[];targetMarker.visible=false;}
      else if(route.length) {
        const next=route[0];moving.copy(next).sub(hero.group.position).setY(0);
        if(moving.length()<.3){route.shift();moving.set(0,0,0);}
      }
      if(moving.length()>1)moving.normalize();
      const dashing=(keys.has('shift')||pad.dash)&&run.stamina>4&&moving.length()>.1;
      const speed= laughing>.8?2.8:dashing?8.8:5.2;
      advance(run,dt,dashing);
      if(moving.length()>.05) {
        moveWithinArena(hero.group.position,moving.x*speed*dt,moving.z*speed*dt,festival.colliders);
        const target=Math.atan2(moving.x,moving.z),difference=Math.atan2(Math.sin(target-hero.group.rotation.y),Math.cos(target-hero.group.rotation.y));
        hero.group.rotation.y+=difference*Math.min(1,dt*11);
        if(dashing&&time-lastFootstep>.13){burst(hero.group.position,1,['#b6ccad']);lastFootstep=time;}
      }
      hero.update(dt,time,{moving:moving.length()>.05,laughing:laughing>0,speed});
      hero.group.visible=run.hits===0||run.invulnerable<2.4||Math.floor(time*12)%2===0;
      for(const p of pickups)if(p.active&&Math.hypot(p.x-hero.group.position.x,p.z-hero.group.position.z)<1.05) {
        p.active=false;p.g.visible=false;collect(run);burst(p.g.position,5);soundNote(700+run.candies*14,0,.09);
      }
      nearest=null;let min=3.3;
      for(const station of festival.stations) {const d=hero.group.position.distanceTo(station.position);if(d<min&&!run.visited.includes(station.id)){nearest=station;min=d;}}
      if(hero.group.position.distanceTo(festival.exit.position)<2.5)nearest='exit';
      show('prompt',!!nearest);
      if(nearest) $('prompt-text').textContent=nearest==='exit'?(canEscape(run)?'Your getaway is ready. Go home!':'Return here with 12 sweets + all 3 houses.'):`${nearest.label} · Trick or treat?`;
      if(destinationStation&&hero.group.position.distanceTo(destinationStation.position)<2.0)interact(destinationStation);
      if(destination&&hero.group.position.distanceTo(destination)<.4){destination=null;route=[];targetMarker.visible=false;}
      if(canEscape(run)) {
        festival.exit.setOpen(true);homeLight.visible=true;
        if(!escapeAnnounced){escapeAnnounced=true;toast('THE GETAWAY IS OPEN! Follow the mint glow back to the gate.',5);soundNote(880,0,.5);}
        if(nearest==='exit')escape(run);
      }
      const sheltered=festival.stations.some(s=>hero.group.position.distanceTo(s.position)<3);
      for(let i=0;i<ghosts.length;i++) {
        const g=ghosts[i],pos=g.mesh.position;g.stun=Math.max(0,g.stun-dt);g.scareReady=Math.max(0,g.scareReady-dt);
        if(g.stun>0) {moveWithinArena(pos,g.away.x*dt*2.1,g.away.z*dt*2.1,festival.colliders,.45);g.mesh.rotation.z=Math.sin(time*12)*.2;}
        else {
          g.mesh.rotation.z=Math.sin(time*2+i)*.06;
          const chase=!sheltered&&pos.distanceTo(hero.group.position)<7.2&&run.elapsed>7;
          const target=chase?hero.group.position:new THREE.Vector3(ghostStarts[i][0]+Math.sin(time*.35+i)*2,0,ghostStarts[i][1]+Math.cos(time*.3+i)*2);
          const direction=target.clone().sub(pos).setY(0),d=direction.length();direction.normalize();
          if(d>.3)moveWithinArena(pos,direction.x*dt*(chase?1.65+Math.min(.6,run.elapsed/180):1),direction.z*dt*(chase?1.65+Math.min(.6,run.elapsed/180):1),festival.colliders,.5);
          g.mesh.rotation.y=Math.atan2(direction.x,direction.z);
          if(chase&&Math.hypot(pos.x-hero.group.position.x,pos.z-hero.group.position.z)<1.05&&hit(run)) {
            bubble('PERSONAL SPACE, PLEASE.',hero.group.position,'#ffad7b');toast('Boo! One heart down. Space = belly laugh.');soundNote(110,0,.25,'sawtooth',.022);
            g.stun=1.8;g.away.copy(pos).sub(hero.group.position).setY(0).normalize();
          }
        }
        pos.y=.55+Math.sin(time*2+i)*.24;
      }
      updateHUD(); if(run.phase==='won'||run.phase==='lost')finish();
    } else if(mode==='end')hero.update(dt,time,{laughing:run.phase==='won'});
    if(!overview) {
      const center=new THREE.Vector3(hero.group.position.x,0,hero.group.position.z-2.5);
      cameraCenter.lerp(center,Math.min(1,dt*4));
      camera.position.copy(cameraCenter).add(new THREE.Vector3(0,19,23));
      camera.lookAt(cameraCenter.x,.8,cameraCenter.z);
    }
  }
  for(const p of pickups)if(p.active) {p.g.position.y=.62+Math.sin(time*2.5+p.seed)*.12;p.g.rotation.y=time*.9+p.seed;}
  ringAge+=dt;ring.visible=ringAge<.75;
  if(ring.visible){ring.scale.setScalar(1+ringAge*8);ring.material.opacity=.85*(1-ringAge/.75);}
  targetMarker.rotation.z=time*.5;
  for(let i=bursts.length-1;i>=0;i--){const b=bursts[i];b.life-=dt;b.velocity.y-=9*dt;b.mesh.position.addScaledVector(b.velocity,dt);b.mesh.rotation.x+=dt*4;b.mesh.material.opacity=Math.min(1,b.life*2);if(b.life<=0){scene.remove(b.mesh);b.mesh.material.dispose();bursts.splice(i,1);}}
  for(let i=labels.length-1;i>=0;i--){const l=labels[i];l.life-=dt;l.sprite.position.y+=dt*.25;l.sprite.material.opacity=Math.min(1,l.life*2);if(l.life<=0){scene.remove(l.sprite);l.texture.dispose();l.sprite.material.dispose();labels.splice(i,1);}}
  renderer.render(scene,camera);
}

function frame(now) {
  const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;
  if(hero)tick(dt);
  requestAnimationFrame(frame);
}

function bind() {
  canvas.tabIndex=0;
  $('sound-button').textContent='SOUND ON';$('sound-button').setAttribute('aria-pressed','true');
  $('play').addEventListener('click',start);$('play-again').addEventListener('click',start);
  $('pause-button').addEventListener('click',pause);$('resume').addEventListener('click',pause);$('restart').addEventListener('click',start);
  $('interact').addEventListener('click',()=>interact());
  $('camera-button')?.addEventListener('click',toggleCamera);
  $('controller-toggle').addEventListener('click',()=>controller.setEnabled(!controller.enabled));
  $('sound-button').addEventListener('click',()=>{sound=!sound;$('sound-button').textContent=sound?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(sound));});
  window.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(e.target.closest('input,textarea,select'))return;
    if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(key)&&mode==='playing')e.preventDefault();
    if(!e.repeat){if(key==='escape')pause();if(key===' '&&mode==='playing')doLaugh();if(key==='e')interact();if(key==='c'&&mode==='playing')toggleCamera();}
    keys.add(key);
  });
  window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  const loseFocus=()=>{keys.clear();controller.poll(controllerSnapshot(),{focused:false});if(mode==='playing')pause();};
  window.addEventListener('blur',loseFocus);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});
  window.addEventListener('gamepaddisconnected',()=>{if(controller.selected&&mode==='playing'){readPad();}});
  window.addEventListener('resize',resize);
  for(const button of document.querySelectorAll('[data-move]')) {
    const key={up:'w',down:'s',left:'a',right:'d'}[button.dataset.move];
    button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);keys.add(key);});
    for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(key));
  }
  $('touch-laugh').addEventListener('click',doLaugh);$('touch-interact').addEventListener('click',()=>interact());
  $('touch-dash').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);keys.add('shift');});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])$('touch-dash').addEventListener(event,()=>keys.delete('shift'));
  document.querySelectorAll('[data-station]').forEach(button=>button.addEventListener('click',()=>{const s=festival.stations.find(s=>s.id===button.dataset.station);if(s)navigate(s.position,s);}));
  $('go-exit')?.addEventListener('click',()=>navigate(festival.exit.position));
  canvas.addEventListener('pointerdown',e=>{
    if(mode!=='playing'||e.button!==0)return;
    pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);
    const p=new THREE.Vector3();if(!raycaster.ray.intersectPlane(floor,p))return;
    const station=festival.stations.find(s=>Math.hypot(p.x-s.position.x,p.z-s.position.z)<4.2&&!run.visited.includes(s.id));
    navigate(station?station.position:p,station||null);
  });
}

try {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
  scene=new THREE.Scene();scene.background=new THREE.Color('#102626');scene.fog=new THREE.Fog('#102626',48,110);
  camera=new THREE.OrthographicCamera(-20,20,16,-16,.1,160);
  scene.add(new THREE.HemisphereLight('#e1ebdb','#555434',2.3));
  const key=new THREE.DirectionalLight('#ffe2a4',3.4);key.position.set(-12,25,15);key.castShadow=true;
  key.shadow.mapSize.set(2048,2048);Object.assign(key.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:80});key.shadow.normalBias=.035;scene.add(key);
  const rim=new THREE.DirectionalLight('#7cc9ca',1.6);rim.position.set(10,8,-14);scene.add(rim);
  festival=createFestival(scene);
  stage=new THREE.Group();scene.add(stage);
  const plinth=new THREE.Mesh(new THREE.CylinderGeometry(3.2,3.5,.4,64),new THREE.MeshStandardMaterial({color:'#203d35',roughness:.5}));plinth.position.y=.1;stage.add(plinth);
  const trim=new THREE.Mesh(new THREE.TorusGeometry(3.12,.045,8,80),new THREE.MeshStandardMaterial({color:'#ffb653',emissive:'#c46e15',emissiveIntensity:.6}));trim.rotation.x=Math.PI/2;trim.position.y=.32;stage.add(trim);stage.position.set(4.3,0,3);
  ring=new THREE.Mesh(new THREE.RingGeometry(.8,1,64),new THREE.MeshBasicMaterial({color:'#ffe6a1',transparent:true,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;scene.add(ring);ring.visible=false;
  targetMarker=new THREE.Mesh(new THREE.RingGeometry(.5,.61,32),new THREE.MeshBasicMaterial({color:'#d0f0ce',transparent:true,opacity:.8,side:THREE.DoubleSide}));targetMarker.rotation.x=-Math.PI/2;scene.add(targetMarker);targetMarker.visible=false;
  homeLight=new THREE.Mesh(new THREE.CylinderGeometry(.7,1.5,9,32,1,true),new THREE.MeshBasicMaterial({color:'#95f4c2',transparent:true,opacity:.13,side:THREE.DoubleSide,depthWrite:false}));homeLight.position.copy(festival.exit.position);homeLight.position.y=4;scene.add(homeLight);homeLight.visible=false;
  for(const [i,p]of [[-8,5],[-4,2],[4,2],[8,5],[-8,-2],[8,-2],[-4,-7],[4,-7],[0,5]].entries())makeCandy(p[0],p[1],i);
  ghostStarts.forEach((p,i)=>{const mesh=createGhost(['#d6eddf','#b8dfdf','#eee0c9','#dccee8'][i]);mesh.position.set(p[0],.5,p[1]);mesh.visible=false;scene.add(mesh);ghosts.push({mesh,stun:0,scareReady:0,away:new THREE.Vector3(1,0,0)});});
  resize();renderer.render(scene,camera);
  hero=await createNailoong();hero.group.position.set(4.3,.35,3);hero.group.scale.setScalar(1.65);scene.add(hero.group);
  setMode('intro');resize();bind();$('play').disabled=false;$('load-status').textContent='All snacks accounted for. For now.';
  requestAnimationFrame(frame);
} catch(error) {
  $('load-status').textContent='The 3D scene could not load. Refresh to retry, or try a browser with WebGL enabled.';
  console.error('Nailoong Night failed to initialize:',error);
}
