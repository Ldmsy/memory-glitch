import test from 'node:test';
import assert from 'node:assert/strict';
import {ControllerInput,controllerCommands} from '../dist/nailoong-night/controller.js';

const idleEdges=()=>({a:false,x:false,y:false,menu:false});
function pad(id='Xbox test pad',index=0,mapping='standard') {
 return {id,index,mapping,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
}
function button(gamepad,index,down=true) {
 gamepad.buttons[index]={pressed:down,touched:down,value:down?1:0};
 return gamepad;
}
function neutral(result) {
 assert.equal(result.x,0);assert.equal(result.z,0);assert.equal(result.dash,false);
 assert.deepEqual(result.pressed,idleEdges());
}
function activate(controller,gamepad) {
 controller.poll([gamepad]);button(gamepad,0);
 const result=controller.poll([gamepad]);
 assert.equal(result.active,true);assert.equal(result.justActivated,true);assert.equal(result.pressed.a,true);
 button(gamepad,0,false);controller.poll([gamepad]);return gamepad;
}

test('connected axes, trigger noise and D-pad movement cannot take control before deliberate A or Menu',()=>{
 const controller=new ControllerInput(),gamepad=pad();
 const absent=controller.poll([]);assert.equal(absent.enabled,true);assert.equal(absent.connected,false);assert.equal(absent.active,false);neutral(absent);
 for(const axes of [[.03,-.05],[.8,-.7],[1,1]]) {
  gamepad.axes=axes;button(gamepad,7);button(gamepad,15);
  const result=controller.poll([gamepad]);
  assert.equal(result.connected,true);assert.equal(result.active,false);assert.equal(result.justActivated,false);neutral(result);
 }
});

test('activation and action buttons produce one rising edge while B and RT remain held dash inputs',()=>{
 const controller=new ControllerInput(),gamepad=pad();activate(controller,gamepad);
 button(gamepad,0);button(gamepad,2);button(gamepad,3);button(gamepad,9);button(gamepad,1);
 let result=controller.poll([gamepad]);assert.deepEqual(result.pressed,{a:true,x:true,y:true,menu:true});assert.equal(result.justActivated,false);assert.equal(result.dash,true);
 result=controller.poll([gamepad]);assert.deepEqual(result.pressed,idleEdges());assert.equal(result.dash,true);
 for(const index of [0,2,3,9,1])button(gamepad,index,false);
 button(gamepad,7);result=controller.poll([gamepad]);assert.equal(result.dash,true);assert.deepEqual(result.pressed,idleEdges());
 button(gamepad,7,false);button(gamepad,2);result=controller.poll([gamepad]);assert.equal(result.pressed.x,true);assert.equal(result.dash,false);
});

test('radial deadzone suppresses drift, remaps remaining travel and clamps diagonal magnitude',()=>{
 const controller=new ControllerInput({deadzone:.22}),gamepad=pad();activate(controller,gamepad);
 for(const axes of [[0,0],[.1,.1],[.21,0]]) {
  gamepad.axes=axes;const result=controller.poll([gamepad]);assert.equal(result.x,0);assert.equal(result.z,0);
 }
 gamepad.axes=[.3,.4];let result=controller.poll([gamepad]);
 const magnitude=(.5-.22)/(1-.22);
 assert.ok(Math.abs(result.x-.6*magnitude)<1e-6);assert.ok(Math.abs(result.z-.8*magnitude)<1e-6);
 gamepad.axes=[1,1];result=controller.poll([gamepad]);
 assert.ok(Math.hypot(result.x,result.z)<=1+1e-7);assert.ok(Math.abs(result.x-Math.SQRT1_2)<1e-6);assert.ok(Math.abs(result.z-Math.SQRT1_2)<1e-6);
});

test('D-pad supports cardinal movement and normalized diagonals without stick input',()=>{
 const controller=new ControllerInput(),gamepad=pad();activate(controller,gamepad);
 button(gamepad,12);let result=controller.poll([gamepad]);assert.equal(result.x,0);assert.equal(result.z,-1);
 button(gamepad,15);result=controller.poll([gamepad]);assert.ok(Math.abs(result.x-Math.SQRT1_2)<1e-6);assert.ok(Math.abs(result.z+Math.SQRT1_2)<1e-6);
 button(gamepad,12,false);button(gamepad,15,false);button(gamepad,13);button(gamepad,14);
 result=controller.poll([gamepad]);assert.ok(Math.abs(result.x+Math.SQRT1_2)<1e-6);assert.ok(Math.abs(result.z-Math.SQRT1_2)<1e-6);
});

test('background polling stays neutral and held actions are not replayed when focus returns',()=>{
 const controller=new ControllerInput(),gamepad=pad();activate(controller,gamepad);
 gamepad.axes=[.8,0];button(gamepad,0);button(gamepad,2);button(gamepad,9);button(gamepad,7);
 neutral(controller.poll([gamepad],{focused:false}));neutral(controller.poll([gamepad],{focused:false}));
 let result=controller.poll([gamepad],{focused:true});
 assert.deepEqual(result.pressed,idleEdges());assert.equal(result.justActivated,false);
 for(const index of [0,2,9,7])button(gamepad,index,false);controller.poll([gamepad]);
 button(gamepad,2);result=controller.poll([gamepad]);assert.equal(result.pressed.x,true);
 const unclaimed=new ControllerInput(),backgroundPad=pad('Background device');button(backgroundPad,0);
 result=unclaimed.poll([backgroundPad],{focused:false});assert.equal(result.active,false);neutral(result);
 result=unclaimed.poll([backgroundPad],{focused:true});assert.equal(result.active,false);neutral(result);
 button(backgroundPad,0,false);unclaimed.poll([backgroundPad]);button(backgroundPad,0);
 assert.equal(unclaimed.poll([backgroundPad]).justActivated,true);
});

test('disconnect is reported once, other pads do not seize control, and same-index replacement is a disconnect',()=>{
 const controller=new ControllerInput(),first=pad('First Xbox',0),second=pad('Second Xbox',1);
 activate(controller,first);controller.poll([first,second]);second.axes=[1,0];
 let result=controller.poll([null,second]);assert.equal(result.disconnected,true);assert.equal(result.active,false);neutral(result);
 result=controller.poll([null,second]);assert.equal(result.disconnected,false);assert.equal(result.active,false);neutral(result);
 button(second,0);result=controller.poll([null,second]);assert.equal(result.active,true);assert.equal(result.justActivated,true);assert.equal(result.id,second.id);
 button(second,0,false);controller.poll([null,second]);
 const replacement=pad('Replacement Xbox',1);result=controller.poll([null,replacement]);
 assert.equal(result.disconnected,true);assert.equal(result.active,false);neutral(result);
 result=controller.poll([null,replacement]);assert.equal(result.disconnected,false);assert.equal(result.active,false);
 button(replacement,0);result=controller.poll([null,replacement]);assert.equal(result.active,true);assert.equal(result.id,replacement.id);
});

test('disabling immediately blocks inputs and re-enabling requires a fresh claim button edge',()=>{
 const controller=new ControllerInput(),gamepad=pad();activate(controller,gamepad);
 button(gamepad,0);gamepad.axes=[1,0];controller.setEnabled(false);
 let result=controller.poll([gamepad]);assert.equal(result.enabled,false);assert.equal(result.active,false);neutral(result);
 controller.setEnabled(true);result=controller.poll([gamepad]);assert.equal(result.enabled,true);assert.equal(result.active,false);neutral(result);
 button(gamepad,0,false);controller.poll([gamepad]);button(gamepad,0);result=controller.poll([gamepad]);
 assert.equal(result.active,true);assert.equal(result.justActivated,true);assert.equal(result.pressed.a,true);
});

test('unsupported mappings remain inactive while a standard pad can deliberately claim using Menu',()=>{
 const controller=new ControllerInput(),unsupported=pad('Generic unmapped device',0,'');
 button(unsupported,0);button(unsupported,9);
 let result=controller.poll([unsupported]);assert.equal(result.connected,true);assert.equal(result.active,false);assert.equal(result.mapping,'unsupported');neutral(result);
 const standard=pad('Standard Xbox',1);controller.poll([unsupported,standard]);button(standard,9);
 result=controller.poll([unsupported,standard]);assert.equal(result.active,true);assert.equal(result.justActivated,true);assert.equal(result.pressed.menu,true);assert.equal(result.id,standard.id);
});

test('invalid axes stay finite and valid movement still works beside a missing or nonfinite axis',()=>{
 const controller=new ControllerInput(),gamepad=pad();activate(controller,gamepad);
 for(const axes of [[NaN,Infinity],[-Infinity,undefined],[NaN,1],[1,Infinity],[],null]) {
  gamepad.axes=axes;const result=controller.poll([gamepad]);
  assert.ok(Number.isFinite(result.x));assert.ok(Number.isFinite(result.z));assert.ok(Math.hypot(result.x,result.z)<=1+1e-7);
  if(axes?.[1]===1){assert.equal(result.x,0);assert.equal(result.z,1);}
  if(axes?.[0]===1){assert.equal(result.x,1);assert.equal(result.z,0);}
 }
});

test('A resumes pause and simultaneous A plus Menu resolves one command from the original mode',()=>{
 const both={active:true,pressed:{a:true,x:true,y:true,menu:true}};
 assert.deepEqual(controllerCommands(both,'intro'),['start']);
 assert.deepEqual(controllerCommands(both,'end'),['start']);
 assert.deepEqual(controllerCommands(both,'paused'),['pause']);
 assert.deepEqual(controllerCommands(both,'playing'),['pause']);
 const aOnly={active:true,pressed:{...idleEdges(),a:true}};
 assert.deepEqual(controllerCommands(aOnly,'paused'),['pause']);
 assert.deepEqual(controllerCommands(aOnly,'playing'),['interact']);
});

test('X and Y only run while playing and an inactive controller cannot dispatch any game command',()=>{
 const actions={active:true,pressed:{...idleEdges(),x:true,y:true}};
 assert.deepEqual(controllerCommands(actions,'playing'),['laugh','camera']);
 for(const mode of ['loading','intro','paused','end'])assert.deepEqual(controllerCommands(actions,mode),[]);
 const inactive={active:false,pressed:{a:true,x:true,y:true,menu:true}};
 for(const mode of ['loading','intro','playing','paused','end'])assert.deepEqual(controllerCommands(inactive,mode),[]);
});
