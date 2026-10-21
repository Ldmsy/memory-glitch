import {getStore} from '@netlify/blobs';
import {randomBytes,createHash,randomUUID} from 'node:crypto';
import {MODEL,assertRevision} from '../lib/memory-core.mjs';
import {freshChat,buildNaturalContext,referenceSources,userMessage,DEMOS} from '../lib/natural-core.mjs';
import {PLAIN_TURN_PROMPT,CHAOS_PROMPT,callNaturalAI,annotateReply} from '../lib/natural-ai.mjs';
import {createChatReaction,planChaosTurn} from '../lib/chat-reactions.mjs';
const COOKIE='__Host-mg_chat';
const json=(v,status=200,headers={})=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const text=v=>{if(typeof v!=='string'||!v.trim()||v.length>2000)throw new Error('Enter between 1 and 2,000 characters.');return v.trim();};
function tokenFrom(req){const t=req.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);return /^[a-f0-9]{64}$/.test(t||'')?t:null;}
export default async function handler(req){
 if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed.'},405);
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)return json({error:'The request origin does not match.'},403);
 let token=tokenFrom(req),cookie={},state;
 try{
  if(!token){if(req.method!=='GET')return json({error:'Refresh the page to start a session.'},401);token=randomBytes(32).toString('hex');cookie={'Set-Cookie':`${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=2592000`};}
  const store=getStore({name:'memory-glitch-natural-v3',consistency:'strong'}),key='session/'+createHash('sha256').update(token).digest('hex');
  let record=await store.getWithMetadata(key,{type:'json',consistency:'strong'});state=record?.data||freshChat();
  if(!record){const r=await store.setJSON(key,state,{onlyIfNew:true});if(!r.modified)throw new Error('The session changed while opening. Please refresh.');record=await store.getWithMetadata(key,{type:'json',consistency:'strong'});}
  if(req.method==='GET')return json({configured:!!(process.env.OPENAI_API_KEY&&process.env.OPENAI_BASE_URL),model:MODEL,state},200,cookie);
  const raw=await req.text();if(raw.length>10000)return json({error:'The request is too large.'},413);let b;try{b=JSON.parse(raw)}catch{return json({error:'The request format is invalid.'},400)};assertRevision(state,b.revision);
  if(b.operation==='demo'){
   const selected=DEMOS[b.caseId||'contradiction'];if(!selected)return json({error:'That demo does not exist.'},400);
   const source=userMessage(selected.source),question=userMessage(selected.question);
   const context={includedMessageIds:b.caseId==='clear'?[source.id,question.id]:[question.id],restoredSourceIds:[],omittedMessages:b.caseId==='clear'?0:1,policy:'Isolated demo with a fixed sample reply.'};
   const annotated=await annotateReply([source,question],selected.question,selected.reply,context);
   return json({state,demo:{messages:[{...source,demo:true},{...question,demo:true},{id:randomUUID(),role:'assistant',text:selected.reply,...annotated,demo:true}],note:'The reply is a fixed test example. Detection, Halloween reactions, and meme captions run live. This is not a spontaneous chat error and is not saved to your conversation.'}},200,cookie);
  }
  if(b.operation==='chat'){
   if(state.chat.length>=200)throw new Error('This session has reached 100 turns. Please export your records.');
   const message=text(b.message),user=userMessage(message),context=buildNaturalContext(state,message),cadence=planChaosTurn(state.chaosCounter,b.chaos!==false);
   const result=await callNaturalAI(cadence.due?CHAOS_PROMPT:PLAIN_TURN_PROMPT,context.input,{temperature:.4,maxTokens:1100});
   const reply=typeof result.result.reply==='string'?result.result.reply.trim().slice(0,5000):'';if(!reply)throw new Error('The model did not return a valid answer. Please try again.');
   const references=referenceSources(state,user),annotation=await annotateReply(references.sources,message,reply,{...context.audit,includedMessageIds:[...context.audit.includedMessageIds,user.id]});
   annotation.check.referenceCoverage={checked:references.sources.length,total:references.total,complete:references.complete};
   const previousAssistant=state.chat.findLast(entry=>entry.role==='assistant'&&(entry.reaction?.catId||entry.haunt?.catId));
   annotation.reaction=createChatReaction(annotation,result.result,{chaos:cadence.due,excludeCatId:previousAssistant?.reaction?.catId||previousAssistant?.haunt?.catId});
   state.chaosCounter=cadence.nextCounter;
   state.chat.push(user,{id:randomUUID(),role:'assistant',text:reply,time:new Date().toISOString(),...annotation});state.sources.push({id:user.id,text:message,time:user.time});
   state.lastAudit={context:context.audit,assistant:{input:context.input,model:MODEL,temperature:.4,mode:cadence.due?'chaos':'plain'},detector:{sourceIds:references.sources.map(s=>s.id),coverage:annotation.check.referenceCoverage,note:'The detector independently reads historical user statements. Its sources differ from the chat model context; reference answers are not injected into the chat reply in advance.'},reaction:{enabled:cadence.enabled,due:cadence.due,interval:cadence.interval,turn:cadence.turn,generated:!!annotation.reaction,captionSource:annotation.reaction?.captionSource||null,note:'CHAT REACTION is fictional entertainment on every third successful enabled chat turn, not a detector finding. Confirmed memory alerts remain immediate. The reaction caption is excluded from later chat context and factual checking.'},meme:{receives:annotation.meme?'Only reviewed incident quotes and corrections are used to create independent fictional captions.':'Not generated.',provider:'Imgflip provides public templates only. No chat content is sent to Imgflip.'}};
  }else if(b.operation==='repair'){
   const m=state.chat.find(m=>m.id===b.messageId&&m.role==='assistant');if(!m||m.check?.status!=='issue')throw new Error('This reply has no evidence to restore.');
   for(const issue of m.check.issues){if(!state.sources.some(s=>s.id===issue.sourceId))continue;if(!state.pinnedSourceIds.includes(issue.sourceId))state.pinnedSourceIds.push(issue.sourceId);}
   state.pinnedSourceIds=state.pinnedSourceIds.slice(-12);m.repaired=true;
  }else if(b.operation==='feedback'){
   const m=state.chat.find(m=>m.id===b.messageId);if(!m?.meme||typeof b.funny!=='boolean')throw new Error('Invalid feedback.');m.feedback={funny:b.funny,time:new Date().toISOString()};
  }else return json({error:'Unsupported operation.'},400);
  state.revision++;state.updatedAt=new Date().toISOString();const saved=await store.setJSON(key,state,{onlyIfMatch:record.etag});if(!saved.modified)return json({error:'Another page updated these records. Refresh and try again.'},409);
  return json({state},200,cookie);
 }catch(e){return json({error:e.status===409?'Another page updated these records. They have been synced; please try again.':e.message||'The service is temporarily unavailable.',...(e.status===409?{state}:{})},e.status||400,cookie);}
}
export const config={path:'/api/memory-chat',rateLimit:{windowSize:60,aggregateBy:['ip','domain'],windowLimit:30}};
