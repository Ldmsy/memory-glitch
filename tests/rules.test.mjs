import test from 'node:test';
import assert from 'node:assert/strict';
import {houses,blocked,clearLine,move,route,doorReward} from '../dist/rules.js';
test('all eight doors and the exit are reachable from spawn without entering walls',()=>{
 const start={x:0,z:32};
 for(const h of houses){const door={x:h.x+h.side*7.3,z:h.z};assert.equal(blocked(door.x,door.z),false);const path=route(start,door);assert.ok(path.length>0);for(const point of path)assert.equal(blocked(point.x,point.z,.7),false);assert.ok(Math.hypot(path.at(-1).x-door.x,path.at(-1).z-door.z)<1.5)}
 assert.ok(route({x:0,z:-27},{x:0,z:36}).length>0);
});
test('buildings block sight but the main street is visible',()=>{
 assert.equal(clearLine({x:-26,z:7},{x:-6,z:7}),false);
 assert.equal(clearLine({x:0,z:32},{x:0,z:-28}),true);
});
test('collision stops movement into buildings and world edges',()=>{
 const p={x:-9,z:7};move(p,-1,0);assert.equal(p.x,-9);
 const edge={x:41.5,z:0};move(edge,1,0);assert.equal(edge.x,41.5);
 move(p,0,1);assert.equal(p.z,8);
});
test('five safe choices always unlock escape; rewards never exceed five',()=>{
 let candy=0;for(let i=0;i<5;i++)candy=doorReward('treat',candy);assert.equal(candy,5);
 assert.equal(doorReward('trick',4),5);assert.equal(doorReward('trick',0),2);
});
