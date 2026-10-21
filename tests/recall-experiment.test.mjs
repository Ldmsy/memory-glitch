import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState, questions, makeFixture} from '../netlify/lib/memory-core.mjs';
import {prepareRecallExperiment, makeEnglishFixture, ENGLISH_RECALL_PROMPT} from '../netlify/lib/recall-experiment.mjs';

const batchId='d42e13c0-284f-4cff-a1cb-58ef0661de47';
const request=(extra={})=>({level:100,repeat:1,batchId,locale:'en',...extra});

test('English experiments physically send 20, 10, and 0 synthetic facts at the three console settings',()=>{
 const state=emptyState();state.facts=[{answer:'PRIVATE-USER-FACT'}];state.cards=[{text:'PRIVATE-USER-CARD'}];state.chat=[{text:'PRIVATE-USER-CHAT'}];
 const unchanged=structuredClone(state);
 for (const [level,count] of [[100,20],[50,10],[0,0]]) {
  const prepared=prepareRecallExperiment(state,request({level}));
  assert.equal(prepared.fixture.facts.length,20);
  assert.equal(prepared.context.input.length,count);
  const input={context:prepared.context.input,questions:questions(prepared.fixture.facts)};
  const serialized=JSON.stringify(input);
  for(const privateValue of ['PRIVATE-USER-FACT','PRIVATE-USER-CARD','PRIVATE-USER-CHAT'])assert.equal(serialized.includes(privateValue),false);
  for(const fact of prepared.fixture.facts.filter(f=>!prepared.context.includedFactIds.includes(f.id)))assert.equal(serialized.includes(fact.answer),false,fact.answer);
  assert.equal(input.questions.length,20);
  assert.equal(prepared.generateMeme,false);
 }
 assert.deepEqual(state,unchanged);
});

test('the English recall prompt and questions never leak absent ground truth',()=>{
 const f=makeEnglishFixture();
 const text=JSON.stringify({system:ENGLISH_RECALL_PROMPT,context:[],questions:questions(f.facts)});
 for(const fact of f.facts)assert.equal(text.includes(fact.answer),false,fact.answer);
 assert.doesNotMatch(text,/\p{Script=Han}/u);
});

test('batch grouping ignores legacy results, rejects duplicates, and permits the next distinct retention sample',()=>{
 const state=emptyState();state.experiments=Array.from({length:15},()=>({level:100,repeat:1}));
 assert.equal(prepareRecallExperiment(state,request()).batchId,batchId);
 state.experiments.push({batchId,locale:'en',level:100,repeat:1});
 assert.throws(()=>prepareRecallExperiment(state,request()),/already saved/);
 assert.equal(prepareRecallExperiment(state,request({level:50})).context.input.length,10);
 assert.throws(()=>prepareRecallExperiment(state,request({level:50,locale:'zh'})),/one language/);
});

test('new batched runs validate identifiers and bound sample counts before any model call',()=>{
 for(const invalid of ['',1,{},'not-a-uuid','d42e13c0-284f-4cff-a1cb-58ef0661de47/escape'])assert.throws(()=>prepareRecallExperiment(emptyState(),request({batchId:invalid})),/UUID/);
 assert.throws(()=>prepareRecallExperiment(emptyState(),request({level:42})),/retention/);
 assert.throws(()=>prepareRecallExperiment(emptyState(),request({repeat:4})),/repeat/);
 assert.throws(()=>prepareRecallExperiment(emptyState(),request({locale:'xx'})),/language/);
 const full=emptyState();full.experiments=Array.from({length:15},(_,index)=>({batchId,locale:'en',level:999,repeat:index}));
 assert.throws(()=>prepareRecallExperiment(full,request()),/15-sample/);
 const session=emptyState();session.experiments=Array.from({length:150},()=>({batchId:'some-other-batch'}));
 assert.throws(()=>prepareRecallExperiment(session,request()),/150 batched/);
});

test('legacy requests retain the original Chinese fixture and separate creative step',()=>{
 const legacy=prepareRecallExperiment(emptyState(),{level:50,repeat:1});
 assert.equal(legacy.batchId,null);assert.equal(legacy.locale,'zh');assert.equal(legacy.generateMeme,true);
 assert.deepEqual(legacy.fixture,makeFixture('experiment'));
 assert.equal(legacy.context.input.length,10);
});
