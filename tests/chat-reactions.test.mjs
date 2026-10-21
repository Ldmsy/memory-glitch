import test from 'node:test';
import assert from 'node:assert/strict';
import {createChatReaction, CHAT_REACTION_LINES, planChaosTurn} from '../netlify/lib/chat-reactions.mjs';
import {HAUNT_CATS, createHaunt} from '../netlify/lib/haunt-reactions.mjs';
import {freshChat, buildNaturalContext} from '../netlify/lib/natural-core.mjs';
import {NATURAL_PROMPT, CHAOS_PROMPT, PLAIN_TURN_PROMPT} from '../netlify/lib/natural-ai.mjs';

test('successful enabled turns follow plain, plain, chaos for repeated three-turn cycles', () => {
 let counter=0;
 const due=[],turns=[];
 for (let i=0;i<6;i++) {
  const plan=planChaosTurn(counter,true);
  due.push(plan.due);turns.push(plan.turn);counter=plan.nextCounter;
 }
 assert.deepEqual(due,[false,false,true,false,false,true]);
 assert.deepEqual(turns,[1,2,3,1,2,3]);
 assert.equal(counter,0);
 assert.match(PLAIN_TURN_PROMPT,/Do not imitate absurd or Halloween jokes from earlier assistant turns/);
 assert.match(PLAIN_TURN_PROMPT,/explicit current request for creative writing or humor/);
});

test('legacy counters begin at the first plain turn and disabled chat resets the cycle', () => {
 for (const counter of [undefined,null,-1,3,Infinity,'2']) {
  const plan=planChaosTurn(counter,true);
  assert.equal(plan.turn,1);assert.equal(plan.due,false);assert.equal(plan.nextCounter,1);
 }
 const off=planChaosTurn(2,false);
 assert.deepEqual(off,{enabled:false,due:false,interval:3,turn:0,nextCounter:0});
 assert.equal(planChaosTurn(off.nextCounter,true).turn,1);
 assert.equal(freshChat().chaosCounter,0);
});

test('planning a failed or unsaved attempt cannot advance persisted cadence', () => {
 const state={chaosCounter:2};
 assert.equal(planChaosTurn(state.chaosCounter,true).due,true);
 assert.equal(state.chaosCounter,2);
 assert.equal(planChaosTurn(state.chaosCounter,true).turn,3);
});

test('a verified memory alert is immediate on either plain or scheduled chaos turns', () => {
 const check={status:'issue',issues:[{kind:'missing'}]};
 for (const counter of [0,1,2]) {
  const plan=planChaosTurn(counter,true);
  assert.ok(createHaunt(check,()=>0));
  assert.equal(createChatReaction({check},{reactionCaption:'Fiction.'},{chaos:plan.due}),null);
 }
});

test('a correctly checked reply gets a clearly fictional ordinary cat without changing the detector verdict', () => {
 const annotation = {check:{status:'clear',issues:[]},haunt:null,meme:null};
 const before = JSON.stringify(annotation);
 const reaction = createChatReaction(annotation,{reactionCaption:'The pumpkin has hired a lawyer. The meeting is cancelled.'},{choose:()=>0});
 assert.equal(reaction.label,'CHAT REACTION');
 assert.equal(reaction.fictional,true);
 assert.equal(reaction.captionSource,'ai');
 assert.equal(reaction.caption,'The pumpkin has hired a lawyer. The meeting is cancelled.');
 assert.equal(JSON.stringify(annotation),before);
 assert.equal(annotation.haunt,null);
 assert.ok(HAUNT_CATS.includes(reaction.catId));
 const selectable = HAUNT_CATS.map((_,index) => createChatReaction(annotation,{reactionCaption:'A pumpkin has hired a lawyer.'},{choose:() => index}).catId);
 assert.deepEqual(selectable,HAUNT_CATS);
});

test('confirmed memory incidents keep their evidence-backed haunt and do not receive a duplicate ordinary reaction', () => {
 const check = {status:'issue',issues:[{kind:'contradiction',sourceQuote:'The budget is 50.',replyQuote:'Your budget is 80.'}]};
 const annotation = {check,haunt:createHaunt(check,()=>0)};
 const reaction = createChatReaction(annotation,{reactionCaption:'The pumpkin has a business degree.'},{choose:()=>assert.fail('No extra random reaction for a reviewed incident')});
 assert.equal(reaction,null);
 assert.equal(annotation.haunt.admission,'I got that wrong.');
 assert.equal(annotation.check,check);
});

test('ordinary reactions never immediately repeat the preceding image and unknown legacy IDs keep the full pool', () => {
 const annotation={check:{status:'clear',issues:[]}};
 const result={reactionCaption:'A raccoon has taken over the budget meeting.'};
 for (const excludeCatId of HAUNT_CATS) {
  const selectable = HAUNT_CATS.slice(1).map((_,index) => createChatReaction(annotation,result,{excludeCatId,choose:()=>index}).catId);
  assert.deepEqual(selectable,HAUNT_CATS.filter(id=>id!==excludeCatId));
  assert.ok(!selectable.includes(excludeCatId));
 }
 const selectable = HAUNT_CATS.map((_,index) => createChatReaction(annotation,result,{excludeCatId:'legacy-missing-image',choose:()=>index}).catId);
 assert.deepEqual(selectable,HAUNT_CATS);
});

test('plain mode turns off ordinary entertainment for all detector outcomes', () => {
 for (const status of ['clear','uncertain','unavailable','issue']) {
  const reaction = createChatReaction({check:{status,issues:[]}}, {reactionCaption:'Pumpkin nonsense.'},{chaos:false,choose:()=>assert.fail('Plain mode must not choose a reaction')});
  assert.equal(reaction,null);
 }
});

test('inconclusive and unavailable checking can have entertainment without pretending to be verified failures', () => {
 for (const status of ['uncertain','unavailable']) {
  const annotation = {check:{status,issues:[]},haunt:null};
  const reaction = createChatReaction(annotation,{}, {choose:()=>0});
  assert.equal(reaction.label,'CHAT REACTION');
  assert.equal(reaction.captionSource,'curated');
  assert.equal(annotation.check.status,status);
  assert.equal(annotation.haunt,null);
 }
});

test('missing, overlong, and false memory-admission captions fall back to curated harmless nonsense', () => {
 for (const reactionCaption of [null,'',' '.repeat(3),'a'.repeat(161),'I forgot your budget.','I got that wrong.','I cannot remember the project.','I am hallucinating again.']) {
  const reaction = createChatReaction({check:{status:'clear'}},{reactionCaption},{choose:()=>0});
  assert.equal(reaction.captionSource,'curated');
  assert.ok(CHAT_REACTION_LINES.includes(reaction.caption));
 }
});

test('reaction captions and labels never enter future factual chat context', () => {
 const state = freshChat();
 state.chat = [
  {id:'u',role:'user',text:'My project is Pumpkin Post.'},
  {id:'a',role:'assistant',text:'Your project is Pumpkin Post.',check:{status:'clear',issues:[]},reaction:{caption:'SECRET-GOBLIN-NONSENSE',label:'CHAT REACTION',catId:'polite',fictional:true}}
 ];
 const context = buildNaturalContext(state,'What is the name?');
 assert.equal(context.input.conversation[1].text,'Your project is Pumpkin Post.');
 assert.doesNotMatch(JSON.stringify(context.input),/SECRET-GOBLIN|CHAT REACTION|fictional|catId/);
});

test('chaos and plain prompts keep factual rules while separating the optional fictional output', () => {
 for (const prompt of [NATURAL_PROMPT,CHAOS_PROMPT]) {
  assert.match(prompt,/never invent details or deliberately make errors/);
  assert.match(prompt,/never claim to have completed them/);
 }
 assert.match(CHAOS_PROMPT,/reactionCaption/);
 assert.match(CHAOS_PROMPT,/only the independent checker/);
 assert.doesNotMatch(NATURAL_PROMPT,/reactionCaption/);
});
