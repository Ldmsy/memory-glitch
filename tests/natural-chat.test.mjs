import test from 'node:test';
import assert from 'node:assert/strict';
import {freshChat,CHAT_CHAR_BUDGET,buildNaturalContext,referenceSources,validateFindings,confirmFindings} from '../netlify/lib/natural-core.mjs';
import {getMemeTemplates} from '../netlify/lib/meme-templates.mjs';

const source={id:'user-1',text:'我已报名 UNSW 黑客松，收到确认邮件。'};
const reply='你还没有报名 UNSW 黑客松，先去报名。';
const context={includedMessageIds:[],restoredSourceIds:[]};
const finding=(extra={})=>({kind:'contradiction',sourceId:source.id,sourceQuote:'我已报名 UNSW 黑客松',replyQuote:'你还没有报名 UNSW 黑客松',confidence:0.97,explanation:'报名状态与用户原话冲突。',correction:'按用户原话，已经报名。',...extra});
const check=(extra={},ctx=context)=>validateFindings({status:'issue',issues:[finding(extra)]},[source],reply,ctx);

test('natural context really omits old messages at the configured boundary and retains the current question',()=>{
 const state=freshChat();
 state.chat=[{id:'old',role:'user',text:'EARLY-FACT-'+ 'a'.repeat(3000)},{id:'recent',role:'user',text:'b'.repeat(14000)}];
 const result=buildNaturalContext(state,'现在的问题');
 assert.deepEqual(result.audit.includedMessageIds,['recent']);
 assert.equal(result.input.message,'现在的问题');
 assert.equal(JSON.stringify(result.input).includes('EARLY-FACT'),false);
 assert.ok(result.audit.characters<=CHAT_CHAR_BUDGET);
 assert.equal(result.audit.omittedMessages,1);
});

test('confirmed wrong replies, demos, and meme payloads cannot repollute the next chat prompt',()=>{
 const state=freshChat();
 state.chat=[
  {id:'u',role:'user',text:'用户真实记录'},
  {id:'bad',role:'assistant',text:'CONFIRMED-WRONG-REPLY',check:{status:'issue'}},
  {id:'demo',role:'assistant',text:'DEMO-WRONG-REPLY',demo:true},
  {id:'meme',role:'assistant',text:'FICTION-ONLY',memeOnly:true},
  {id:'good',role:'assistant',text:'可保留的正常回复',check:{status:'clear'},meme:{caption:'SECRET-MEME-CAPTION'},haunt:{character:'spider',line:'SECRET-HAUNT-LINE',admission:'SECRET-ADMISSION'},correction:'SECRET-CORRECTION'}
 ];
 const result=buildNaturalContext(state,'继续');
 assert.deepEqual(result.audit.includedMessageIds,['u','good']);
 const payload=JSON.stringify(result.input);
 for(const secret of ['CONFIRMED-WRONG-REPLY','DEMO-WRONG-REPLY','FICTION-ONLY','SECRET-MEME-CAPTION','SECRET-HAUNT-LINE','SECRET-ADMISSION','SECRET-CORRECTION'])assert.equal(payload.includes(secret),false,secret);
});

test('only explicit user-source restoration enters restored evidence',()=>{
 const state=freshChat();state.sources=[source,{id:'private-history',text:'NOT-RESTORED'}];state.pinnedSourceIds=[source.id,'missing-source'];
 const result=buildNaturalContext(state,'继续');
 assert.deepEqual(result.input.restoredEvidence,[{sourceId:source.id,text:source.text}]);
 assert.equal(JSON.stringify(result.input).includes('NOT-RESTORED'),false);
});

test('detector references remain chronological, include the current revision, and disclose truncated coverage',()=>{
 const state=freshChat();state.sources=[{id:'old',text:'a'.repeat(30000)},{id:'recent',text:'b'.repeat(28000)}];
 const current={id:'current',text:'最新更正：'+ 'c'.repeat(4000)};
 const result=referenceSources(state,current);
 assert.deepEqual(result.sources.map(s=>s.id),['recent','current']);
 assert.equal(result.total,3);assert.equal(result.complete,false);
 const complete=referenceSources({...freshChat(),sources:[source]},current);
 assert.deepEqual(complete.sources.map(s=>s.id),[source.id,'current']);assert.equal(complete.complete,true);
});

test('valid findings require both a real source quote and an exact quote of the actual answer',()=>{
 assert.equal(check().status,'issue');
 for(const extra of [{sourceId:'invented'},{sourceQuote:'我已领取比赛冠军'},{replyQuote:'你已经报名了'},{sourceQuote:''}]){
  const result=check(extra);assert.equal(result.status,'uncertain');assert.deepEqual(result.issues,[]);
 }
});

test('evidence presence is audited separately from correctness and duplicate incidents are collapsed',()=>{
 assert.equal(check().issues[0].inContext,false);
 assert.equal(check({}, {includedMessageIds:[source.id],restoredSourceIds:[]}).issues[0].inContext,true);
 assert.equal(check({}, {includedMessageIds:[],restoredSourceIds:[source.id]}).issues[0].inContext,true);
 const result=validateFindings({status:'issue',issues:[finding(),finding()]},[source],reply,context);
 assert.equal(result.issues.length,1);
});

test('missing, nonnumeric, nonfinite, and out-of-range confidence never trigger an incident',()=>{
 for(const confidence of [undefined,null,'0.99',NaN,Infinity,-1,0.89,1.01]){
  const result=check({confidence});assert.equal(result.status,'uncertain',String(confidence));assert.deepEqual(result.issues,[]);
 }
 assert.equal(check({confidence:0.9}).status,'issue');
 assert.equal(check({confidence:1}).status,'issue');
 assert.equal(check({kind:'hallucination'}).status,'uncertain');
});

test('malformed checker schemas never become clear or confirmed issues',()=>{
 for(const result of [null,{}, {status:'clear'}, {status:'clear',issues:'bad'}, {status:'garbage',issues:[finding()]}]){
  const checked=validateFindings(result,[source],reply,context);assert.equal(checked.status,'uncertain');assert.deepEqual(checked.issues,[]);
 }
 const clear=validateFindings({status:'clear',issues:[]},[source],reply,context);
 assert.equal(clear.status,'clear');assert.deepEqual(clear.issues,[]);
});

test('an independent high-confidence approval is mandatory and can only approve an existing issue index',()=>{
 const first=check();
 for(const confirmed of [[],[{index:0,valid:false,confidence:1}],[{index:1,valid:true,confidence:1}],[{index:0,valid:'true',confidence:1}],[{index:0,valid:true,confidence:0.89}],[{index:0,valid:true,confidence:'0.99'}],[{index:0,valid:true,confidence:Infinity}],[{index:0,valid:true,confidence:1.1}]]){
  const reviewed=confirmFindings(first,{confirmed});assert.equal(reviewed.status,'uncertain');assert.deepEqual(reviewed.issues,[]);
 }
 assert.equal(confirmFindings(first,{confirmed:[{index:0,valid:true,confidence:0.99}]}).status,'issue');
 assert.equal(confirmFindings(first,{}).status,'uncertain');
});

const template=(extra={})=>({id:'181913649',name:'Drake Hotline Bling',url:'https://i.imgflip.com/30b1gx.jpg',width:1200,height:1200,...extra});
test('template retrieval uses only the public read API and returns curated, host-validated images with provenance',async t=>{
 let requested;
 t.mock.method(globalThis,'fetch',async (url,options)=>{requested={url,options};return {ok:true,json:async()=>({success:true,data:{memes:[template(),template({id:'not-curated'}),template({url:'https://attacker.test/image.jpg'}),template({url:'https://i.imgflip.com.evil.test/x.jpg'}),template({url:'https://i.imgflip.com/x.jpg?redirect=evil'})]}})};});
 const result=await getMemeTemplates();
 assert.equal(requested.url,'https://api.imgflip.com/get_memes');assert.equal(requested.options.body,undefined);
 assert.equal(result.length,1);assert.equal(result[0].provider,'Imgflip');assert.equal(result[0].id,'181913649');
 assert.match(result[0].sourceUrl,/^https:\/\/imgflip\.com\//);assert.equal(result[0].layout,'drake');
});

test('failed provider responses and invalid image dimensions never yield usable templates',async t=>{
 const payloads=[{success:false,data:{memes:[template()]}},{success:true,data:{memes:[template({width:0}),template({height:-5}),template({width:Infinity})]}},{success:true,data:{memes:[]}}];
 t.mock.method(globalThis,'fetch',async()=>({ok:true,json:async()=>payloads.shift()}));
 for(let i=0;i<3;i++)await assert.rejects(()=>getMemeTemplates());
});

test('Drake rejects the verified source and accepts the wrong reply, never the reverse',async()=>{
 const {memeOverlay}=await import('../netlify/lib/natural-core.mjs');
 const out=memeOverlay({layout:'drake'},{topText:'wrong mapping',bottomText:'wrong mapping'},[{sourceQuote:'I have already registered.',replyQuote:'You have not registered.'}]);
 assert.equal(out.topText,'AI rejects:\nI have already registered.');assert.equal(out.bottomText,'AI insists:\nYou have not registered.');
});
