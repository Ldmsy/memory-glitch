import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.module.js';
import {createCharacter,animateCharacter,CAST} from '../dist/characters.js';
import {createCast} from '../dist/cast.js';
import {readFile} from 'node:fs/promises';
import {preloadNailong} from '../dist/nailong-reference.js';

const modelBytes=await readFile(new URL('../dist/assets/nailoong.glb',import.meta.url));
await preloadNailong(modelBytes.buffer.slice(modelBytes.byteOffset,modelBytes.byteOffset+modelBytes.byteLength));

// Headless simulation does not render the decorative wood texture.
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({}, {get:()=>()=>{},set:()=>true})})};
const make=()=>createCast(new THREE.Scene(),createCharacter('sahur'));
const at=(x,z)=>new THREE.Vector3(x,0,z);
const advance=(cast,seconds,p)=>{const events=[];for(let t=0;t<seconds;t+=.05)events.push(...cast.update(.05,p,0));return events;};

test('six character rigs remain finite while idling, running and reacting',()=>{
 for(const info of CAST){const a=createCharacter(info.id);for(const action of ['idle','laugh'])for(const t of [0,1,4.7,12]){animateCharacter(a,t,4,action);a.g.updateMatrixWorld(true);a.g.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}}
});
test('reference Nailoong switches expressions and keeps scene instances independent',()=>{
 const a=createCharacter('nailong'),b=createCharacter('nailong');
 animateCharacter(a,0,0,'laugh');animateCharacter(b,0,0,'idle');
 const node=(actor,name)=>actor.referenceModel.getObjectByName(name);
 assert.equal(node(a,'MouthLaugh').scale.x,1);
 assert.ok(node(a,'EyesOpen').scale.x<.01);
 assert.equal(node(b,'EyesOpen').scale.x,1);
 assert.ok(node(b,'MouthLaugh').scale.x<.01);
 animateCharacter(a,.05,0,'idle');assert.equal(node(a,'EyesOpen').scale.x,1);
 assert.ok(node(a,'MouthLaugh').scale.x<.01);
});
test('a character awards a candy once, and reset restores the encounter',()=>{
 const c=make(),a=c.actors.find(a=>a.id==='chiikawa'),p=at(0,32);
 c.interact(a,p);let e=c.update(.05,p,0);assert.equal(e.filter(e=>e.candy).reduce((s,e)=>s+e.candy,0),1);assert.ok(e.some(e=>e.effect==='shield'));
 advance(c,9,p);c.interact(a,p);assert.equal(c.update(.05,p,0).reduce((s,e)=>s+(e.candy||0),0),0);
 c.reset();assert.equal(c.score,0);assert.equal(a.used,false);c.interact(a,p);assert.ok(c.update(.05,p,0).some(e=>e.candy===1));
});
test('Sahur rewards standing still; moving fails without consuming the reward',()=>{
 const c=make(),a=c.actors.find(a=>a.id==='sahur'),p=at(1,-28);
 c.interact(a,p);const fail=advance(c,4,at(3,-28));assert.equal(a.used,false);assert.ok(fail.some(e=>e.effect==='dance'));advance(c,3,p);
 c.interact(a,p);const success=advance(c,4,p);assert.ok(success.some(e=>e.candy===1));assert.equal(a.used,true);
});
test('shark charge resolves and cannot pass through buildings',()=>{
 const c=make(),a=c.actors.find(a=>a.id==='tralalero'),p=at(-7,-9);c.interact(a,p);
 const events=advance(c,4,at(1,-9));assert.equal(a.charge,null);assert.ok(events.some(e=>e.candy===1));assert.ok(a.g.position.x>-9.5);
});
test('pumpkin warning gives time to dodge and applies slip only inside the landing zone',()=>{
 for(const hit of [true,false]){const c=make(),a=c.actors.find(a=>a.id==='crocodilo'),origin=at(4,-24);c.interact(a,origin);const early=advance(c,1,origin);assert.equal(early.some(e=>e.candy),false);const result=advance(c,3,hit?origin:at(0,-20));assert.ok(result.some(e=>e.candy===1));assert.equal(result.some(e=>e.effect==='slip'),hit);}
});
test('reset cancels pending beat and bomb effects',()=>{
 const c=make(),p=at(4,-24);c.interact(c.actors.find(a=>a.id==='crocodilo'),p);c.reset();assert.equal(advance(c,4,p).length,0);
});
