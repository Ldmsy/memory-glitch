import {getStore} from '@netlify/blobs';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {MODEL,LEVELS,emptyState,buildContext,scoreRecall,questions,relevantFacts,mutationFields,assertRevision,statusChange,makeFixture} from '../lib/memory-core.mjs';
import {prepareRecallExperiment,ENGLISH_RECALL_PROMPT} from '../lib/recall-experiment.mjs';
import {callAI,RECALL_PROMPT,CHAT_PROMPT,EXTRACT_PROMPT,createMeme,cleanFields} from '../lib/ai.mjs';
const COOKIE='__Host-mg_session';
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const text=(v,max=2000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new Error(`请输入1至${max}字`);return v.trim();};
const publicState=s=>({...s,nextContext:buildContext(s)});
function sessionId(req){const token=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(token||'')?token:null;}
async function recall(facts,context,knownFacts=facts,prompt=RECALL_PROMPT){const a=await callAI(prompt,{context:context.input,questions:questions(facts,knownFacts)},{temperature:0,maxTokens:1800});if(!Array.isArray(a.result.answers))throw new Error('模型未返回回忆答案，本次不计分');return {...scoreRecall(facts,a.result.answers,context),audit:a.audit};}
export default async function handler(req){
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'请求来源不匹配'},403);
 if(!['GET','POST'].includes(req.method))return json({error:'不支持的方法'},405);
 const store=getStore({name:'memory-glitch-v2',consistency:'strong'});let token=sessionId(req),cookie={},key,record,state;
 try{
  if(!token){if(req.method!=='GET')return json({error:'请刷新页面建立会话'},401);token=randomBytes(32).toString('hex');cookie={'Set-Cookie':`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`};}
  key='session/'+createHash('sha256').update(token).digest('hex');record=await store.getWithMetadata(key,{type:'json',consistency:'strong'});state=record?.data||emptyState();
  if(!record){const created=await store.setJSON(key,state,{onlyIfNew:true});if(!created.modified)throw new Error('会话初始化冲突，请刷新');record=await store.getWithMetadata(key,{type:'json',consistency:'strong'});}
  if(req.method==='GET')return json({configured:!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_BASE_URL),model:MODEL,state:publicState(state),storage:'Netlify Blobs'},200,cookie);
  const raw=await req.text();if(raw.length>30000)return json({error:'请求过大'},413);let b;try{b=JSON.parse(raw)}catch{return json({error:'请求格式无效'},400)};assertRevision(state,b.revision);
  let extra={};
  const card=()=>{const c=state.cards.find(c=>c.id===b.cardId);if(!c)throw new Error('记忆不存在');return c};
  if(b.operation==='seed'){
   if(state.cards.some(c=>c.source==='fixture'))throw new Error('已装入这组20条演示事实');if(state.cards.length>40)throw new Error('卡片空间不足');const f=makeFixture(randomUUID());state.cards.push(...f.cards);state.facts.push(...f.facts);
  }else if(b.operation==='add'){
   if(state.cards.length>=60)throw new Error('最多60张记忆卡');state.cards.push({id:randomUUID(),text:text(b.text),status:'active'});
  }else if(b.operation==='status'){statusChange(state,b.cardId,b.status);
  }else if(b.operation==='level'){if(!LEVELS.includes(b.level))throw new Error('档位无效');state.level=b.level;
  }else if(b.operation==='extract'){
   const c=card();const a=await callAI(EXTRACT_PROMPT,{text:c.text},{temperature:0});c.candidates=cleanFields(a.result.fields,c.text);if(!c.candidates.length)throw new Error('没有提取到可验证字段，可手动填写事实');state.lastAudit=a.audit;
  }else if(b.operation==='confirm'){
   const c=card();if(!Array.isArray(b.fields)||b.fields.length>5)throw new Error('事实格式无效');const fields=cleanFields(b.fields,c.text);if(fields.length!==b.fields.length||!fields.length)throw new Error('每个答案都必须是原文中存在的精确片段');if(fields.some(f=>f.question.includes(f.value)))throw new Error('检测问题不能包含标准答案');state.facts=state.facts.filter(f=>f.cardId!==c.id);for(const f of fields){state.facts.push({...f,id:randomUUID(),cardId:c.id,answer:f.value,aliases:[],confirmed:true});}c.candidates=[];
  }else if(b.operation==='chat'){
   if(state.chat.length>=200)throw new Error('本会话已到200条消息，请导出后开启新会话');const message=text(b.message),ctx=buildContext(state),facts=relevantFacts(state.facts.filter(f=>!state.cards.some(c=>c.id===f.cardId&&c.status==='superseded')),message);
   let reply,detection=null,meme=null,memeError=null;
   if(facts.length){detection=await recall(facts,ctx,state.facts);reply=detection.rows.map(r=>`${r.question}\n${r.value===null?'当前可用上下文中没有这条信息。':r.value}`).join('\n\n');state.lastAudit=detection.audit;
    if(detection.correct<detection.tested){const affected=new Set(detection.rows.filter(r=>r.status!=='correct').map(r=>r.cardId));const remaining=ctx.input.filter(i=>affected.has(i.cardId)).map(({kind,label,value})=>({kind,label,value}));try{meme=await createMeme(remaining,detection.rows.some(r=>r.cause==='not-provided')?'上下文中缺少所问事实':'答案与已确认事实不匹配，需要复核');}catch(e){memeError=e.message;}}
   }else{const a=await callAI(CHAT_PROMPT,{context:ctx.input,message},{temperature:.2,maxTokens:700});reply=text(a.result.reply,3000);state.lastAudit=a.audit;}
   const responseId=randomUUID();state.chat.push({id:randomUUID(),role:'user',text:message},{id:responseId,role:'assistant',text:reply,detection,meme,memeError});
   // User decides which messages become facts. Neither answers nor repeated questions automatically pollute the vault.
  }else if(b.operation==='scan'){
   const facts=state.facts.filter(f=>f.confirmed&&!state.cards.some(c=>c.id===f.cardId&&c.status==='superseded')).slice(0,20);if(!facts.length)throw new Error('先确认事实或载入20条示例');const r=await recall(facts,buildContext(state),state.facts);state.scans.push({...r,id:randomUUID(),time:new Date().toISOString(),level:state.level});state.lastAudit=r.audit;
  }else if(b.operation==='remix'){
   const c=card();if(c.status==='keep')throw new Error('先解除 Keep');if(![75,50,25,0].includes(b.level))throw new Error('档位无效');let fields,parent=null;
   if(b.parentId){parent=state.runs.find(r=>r.id===b.parentId&&r.cardId===c.id);if(!parent)throw new Error('上一轮不存在');fields=parent.fields;}
   else{fields=state.facts.filter(f=>f.cardId===c.id&&f.confirmed).map(f=>({...f,value:f.answer}));if(!fields.length){const a=await callAI(EXTRACT_PROMPT,{text:c.text},{temperature:0});fields=cleanFields(a.result.fields,c.text);}}
   const remaining=mutationFields(fields,b.level);const m=await createMeme(remaining,'用户主动创作');c.status='forgotten';const r={...m,id:randomUUID(),cardId:c.id,parentId:parent?.id||null,level:b.level,remaining,removedKinds:fields.filter(f=>!remaining.some(x=>x.kind===f.kind&&x.value===f.value)).map(f=>f.kind)};state.runs.push(r);state.lastAudit=m.audit;extra.runId=r.id;
  }else if(b.operation==='experiment'){
   const setup=prepareRecallExperiment(state,b),{fixture:f,context:ctx}=setup;
   const r=await recall(f.facts,ctx,f.facts,setup.locale==='en'?ENGLISH_RECALL_PROMPT:RECALL_PROMPT);let meme=null,memeError=null;
   if(setup.generateMeme)try{meme=await createMeme(ctx.input.slice(0,5).map(({kind,label,value})=>({kind,label,value})),'控制实验，虚构万圣节Meme');}catch(e){memeError=e.message;}
   const item={...r,id:randomUUID(),batchId:setup.batchId,locale:setup.locale,diagnostic:'controlled-recall',level:b.level,repeat:b.repeat,time:new Date().toISOString(),model:MODEL,retained:ctx.input.length,total:f.facts.length,meme,memeError,creativity:null};state.experiments.push(item);state.lastAudit=r.audit;extra.experiment=item;
  }else if(b.operation==='rate'){
   const exp=state.experiments.find(e=>e.id===b.id);if(!exp||!Number.isInteger(b.rating)||b.rating<1||b.rating>5)throw new Error('评分无效');exp.creativity=b.rating;
  }else if(b.operation==='reset'){
   // A new browser session; old server record remains recoverable by its original cookie.
   return json({error:'请使用浏览器新的独立会话开始；当前记录已保留。'},400);
  }else throw new Error('不支持的操作');
  state.revision++;state.updatedAt=new Date().toISOString();const result=await store.setJSON(key,state,{onlyIfMatch:record.etag});if(!result.modified)return json({error:'并发更新冲突，请刷新后重试'},409);
  return json({state:publicState(state),...extra},200,cookie);
 }catch(e){return json({error:e.message||'服务暂不可用',...(e.status===409?{state:publicState(state)}:{})},e.status||400,cookie);}
}
export const config={path:'/api/memory-glitch',rateLimit:{windowSize:60,aggregateBy:['ip','domain'],windowLimit:60}};
