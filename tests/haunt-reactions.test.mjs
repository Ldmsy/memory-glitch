import test from 'node:test';
import assert from 'node:assert/strict';
import {HAUNT_LINES,HAUNT_CATS,createHaunt} from '../netlify/lib/haunt-reactions.mjs';
import {annotateReply} from '../netlify/lib/natural-ai.mjs';
import {freshChat,buildNaturalContext,DEMOS,memeOverlay} from '../netlify/lib/natural-core.mjs';

const issue = kind => ({status:'issue',issues:[{kind,sourceId:'source',sourceQuote:'I registered.',replyQuote:'You did not register.',correction:'You already registered.'}]});

test('uncertain, clear, unavailable, empty, and unsupported findings never roll a random reaction', () => {
 const shouldNotRun = () => assert.fail('Non-incidents must not choose a reaction');
 for(const check of [null,{},...['clear','uncertain','unavailable'].map(status=>({...issue('contradiction'),status})),{status:'issue',issues:[]},issue('hallucination')]) {
  assert.equal(createHaunt(check,shouldNotRun),null);
 }
});

test('every Halloween character has a finite curated line; randomness changes style without changing the admission', () => {
 const characters = ['candy','spider','ghost','pumpkin','trump'];
 assert.deepEqual(Object.keys(HAUNT_LINES),characters);
 characters.forEach((character,index)=>{
  for(let phrase=0;phrase<HAUNT_LINES[character].length;phrase++){
   const choices=[index,phrase,phrase % HAUNT_CATS.length];
   const result=createHaunt(issue('contradiction'), max=>{
    const n=choices.shift();assert.ok(n>=0&&n<max);return n;
   });
   assert.equal(result.character,character);
   assert.equal(result.line,HAUNT_LINES[character][phrase]);
   assert.equal(result.catId,HAUNT_CATS[phrase % HAUNT_CATS.length]);
   assert.equal(result.admission,'I got that wrong.');
   assert.ok(result.line.length<100);
   assert.equal(choices.length,0);
  }
 });
 assert.equal(createHaunt(issue('missing'),()=>0).admission,'I lost the thread.');
 assert.equal(createHaunt({status:'issue',issues:[{kind:'missing'},{kind:'contradiction'}]},()=>0).admission,'I got that wrong.');
});

test('cat selection is independent of the Halloween persona and remains on the stored annotation', () => {
 assert.deepEqual(HAUNT_CATS,['chaos','calico','polite','dinner','grumpy','crying','confused','surprised','trump-1','trump-2','trump-3','trump-4','trump-5']);
 for (let character=0;character<Object.keys(HAUNT_LINES).length;character++) {
  const photos=new Set();
  for (let cat=0;cat<HAUNT_CATS.length;cat++) {
   const choices=[character,0,cat];
   const result=createHaunt(issue('missing'),max=>{const n=choices.shift();assert.ok(n<max);return n;});
   photos.add(result.catId);
   assert.deepEqual(JSON.parse(JSON.stringify(result)),result);
  }
  assert.deepEqual([...photos],HAUNT_CATS);
 }
});

test('a confirmed issue retains evidence, correction, and reaction when the meme provider fails', async () => {
 const confirmed=issue('missing');
 const result=await annotateReply([], 'question', 'reply', {}, {
  inspect:async()=>confirmed,
  makeMeme:async()=>{throw new Error('Provider unavailable');}
 });
 assert.equal(result.check,confirmed);
 assert.equal(result.check.issues[0].correction,'You already registered.');
 assert.ok(result.haunt);
 assert.ok(HAUNT_CATS.includes(result.haunt.catId));
 assert.equal(JSON.parse(JSON.stringify(result)).haunt.catId,result.haunt.catId);
 assert.equal(result.haunt.admission,'I lost the thread.');
 assert.equal(result.meme,null);
 assert.match(result.memeError,/evidence and correction/);
 assert.equal(result.memeError.includes('Provider unavailable'),false);
});

test('a failed or inconclusive detector never produces a reaction or calls the meme service', async () => {
 const makeMeme=async()=>assert.fail('No meme may be created without an issue');
 for(const inspect of [async()=>{throw new Error('timeout');},async()=>({status:'uncertain',issues:[]}),async()=>({status:'clear',issues:[]})]){
  const result=await annotateReply([], 'question','reply',{}, {inspect,makeMeme});
  assert.equal(result.haunt,null);assert.equal(result.meme,null);assert.equal(result.memeError,null);
  assert.notEqual(result.check.status,'issue');
 }
 const unavailable=await annotateReply([], '', '', {}, {inspect:async()=>{throw new Error('timeout');},makeMeme});
 assert.equal(unavailable.check.status,'unavailable');
});

test('chat can continue after a confirmed incident without replaying the error or its reaction fiction', () => {
 const state=freshChat();
 const first={id:'source',role:'user',text:'I registered for the event.'};
 state.sources=[first];
 state.chat=[first,{id:'bad',role:'assistant',text:'You have not registered.',check:issue('contradiction'),haunt:createHaunt(issue('contradiction'),()=>0),meme:{story:'SECRET-FICTION'}}];
 const result=buildNaturalContext(state,'What should I bring to the event?');
 assert.equal(result.input.message,'What should I bring to the event?');
 assert.deepEqual(result.input.conversation,[first]);
 assert.equal(JSON.stringify(result.input).includes('SECRET-FICTION'),false);
 assert.equal(JSON.stringify(result.input).includes('wrapper'),false);
 assert.equal(JSON.stringify(result.input).includes('You have not registered.'),false);
});

test('English demos retain the same reference while correct and incorrect replies remain distinct', () => {
 assert.equal(DEMOS.missing.source,DEMOS.contradiction.source);
 assert.equal(DEMOS.clear.source,DEMOS.contradiction.source);
 assert.ok(DEMOS.clear.reply.includes('PUMPKIN-204'));
 assert.ok(!DEMOS.missing.reply.includes('PUMPKIN-204'));
 assert.ok(DEMOS.contradiction.reply.includes('not registered'));
 for(const demo of Object.values(DEMOS))for(const value of Object.values(demo))assert.doesNotMatch(value,/\p{Script=Han}/u);
});

test('Drake excerpts preserve English word boundaries and the verified-source vs incorrect-reply mapping', () => {
 const sourceQuote='I have already registered for the Halloween hackathon and received the confirmation email for the event yesterday.';
 const replyQuote='You have not registered for the Halloween hackathon.';
 const output=memeOverlay({layout:'drake'}, {}, [{sourceQuote,replyQuote}]);
 assert.ok(output.topText.startsWith('AI rejects:\nI have already registered for the Halloween hackathon'));
 assert.ok(output.topText.endsWith('…'));
 assert.ok(output.topText.length<=112);
 assert.equal(output.bottomText,'AI insists:\n'+replyQuote);
 assert.equal(output.topText.includes('Ihavealready'),false);
});
