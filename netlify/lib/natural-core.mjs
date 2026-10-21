import {randomUUID} from 'node:crypto';
export const NATURAL_VERSION=3;
export const CHAT_CHAR_BUDGET=16000;
export function freshChat(){return {version:3,revision:0,chat:[],sources:[],pinnedSourceIds:[],lastAudit:null,chaosCounter:0};}
export function buildNaturalContext(state,message){
 const pinned=state.sources.filter(s=>state.pinnedSourceIds.includes(s.id)).map(({id,text})=>({sourceId:id,text}));
 const history=[];let chars=message.length+pinned.reduce((n,s)=>n+s.text.length,0);
 for(const m of [...state.chat].reverse()){
  if(m.demo||m.memeOnly||m.role==='assistant'&&m.check?.status==='issue')continue;
  if(chars+m.text.length>CHAT_CHAR_BUDGET)break;
  chars+=m.text.length;history.unshift({id:m.id,role:m.role,text:m.text});
 }
 return {input:{restoredEvidence:pinned,conversation:history,message},audit:{includedMessageIds:history.map(m=>m.id),restoredSourceIds:pinned.map(p=>p.sourceId),omittedMessages:state.chat.filter(m=>!m.demo).length-history.length,characters:chars,policy:'Recent continuous conversation targets 16,000 characters. Explicitly restored user statements take priority and may exceed that target. Confirmed incorrect assistant replies are excluded. This is not a measurement of memory capacity.'}};
}
export function referenceSources(state,current){
 const sources=[];let size=0;
 for(const source of [...state.sources,current].reverse()){
  if(size+source.text.length>60000)break;
  sources.unshift(source);size+=source.text.length;
 }
 return {sources,total:state.sources.length+1,complete:sources.length===state.sources.length+1};
}
function plain(value,max=1000){return typeof value==='string'?value.trim().slice(0,max):'';}
export function validateFindings(result,sources,reply,context){
 const map=new Map(sources.map(s=>[s.id,s]));const issues=[];
 const schemaValid=['clear','uncertain','issue'].includes(result?.status)&&Array.isArray(result?.issues);
 if(!schemaValid)return {status:'uncertain',issues:[],note:'The check returned an incomplete result, so no conclusion is available.',checkedSources:sources.length};
 for(const candidate of Array.isArray(result?.issues)?result.issues:[]){
  const source=map.get(candidate?.sourceId);const sourceQuote=plain(candidate?.sourceQuote,2000),replyQuote=plain(candidate?.replyQuote,1000);
  if(!source||!sourceQuote||!replyQuote||!source.text.includes(sourceQuote)||!reply.includes(replyQuote))continue;
  if(!['contradiction','missing'].includes(candidate.kind)||typeof candidate.confidence!=='number'||!Number.isFinite(candidate.confidence)||candidate.confidence<.9||candidate.confidence>1)continue;
  const explanation=plain(candidate.explanation),correction=plain(candidate.correction);
  if(!explanation||!correction||issues.some(i=>i.sourceId===source.id&&i.replyQuote===replyQuote))continue;
  issues.push({kind:candidate.kind,sourceId:source.id,sourceQuote,replyQuote,explanation,correction,inContext:context.includedMessageIds.includes(source.id)||context.restoredSourceIds.includes(source.id),confidence:Number(candidate.confidence)});
 }
 const hadCandidates=Array.isArray(result?.issues)&&result.issues.length>0;
 const validStatus=['clear','uncertain','issue'].includes(result?.status)?result.status:'uncertain';
 return {status:issues.length?'issue':hadCandidates||validStatus==='issue'?'uncertain':validStatus,issues:issues.slice(0,2),note:issues.length?'A conflict with a user statement needs correction.':validStatus==='clear'&&!hadCandidates?'No evidence-backed conflict with the user record was found. This does not verify every claim.':'The evidence is inconclusive. No reaction or meme was triggered.',checkedSources:sources.length};
}
export function confirmFindings(check,result){
 const approved=new Set((Array.isArray(result?.confirmed)?result.confirmed:[]).filter(x=>x?.valid===true&&Number.isInteger(x.index)&&typeof x.confidence==='number'&&Number.isFinite(x.confidence)&&x.confidence>=.9&&x.confidence<=1).map(x=>x.index));
 const issues=check.issues.filter((_,index)=>approved.has(index));
 return {...check,issues,status:issues.length?'issue':'uncertain',note:issues.length?'Exact quotes from the user record and this reply passed an independent second review.':'The independent review did not confirm an issue. No reaction or meme was triggered.'};
}
export function userMessage(text){return {id:randomUUID(),role:'user',text,time:new Date().toISOString()};}
export const DEMOS={
 contradiction:{source:'I have already registered for the UNSW Halloween hackathon. My confirmation code is PUMPKIN-204.',question:'I am at the event entrance. What should I do next?',reply:'You have not registered for the UNSW Halloween hackathon yet. You need to register before you can attend.'},
 missing:{source:'I have already registered for the UNSW Halloween hackathon. My confirmation code is PUMPKIN-204.',question:'What is my hackathon confirmation code?',reply:'I do not know your hackathon confirmation code. You have not shared it with me.'},
 clear:{source:'I have already registered for the UNSW Halloween hackathon. My confirmation code is PUMPKIN-204.',question:'What is my hackathon confirmation code?',reply:'Your confirmation code is PUMPKIN-204. You have already registered.'}
};

export function memeOverlay(template,meme,issues){
 if(template.layout!== 'drake')return {topText:meme.topText.slice(0,110),bottomText:meme.bottomText.slice(0,110)};
 // The visual rejects the top row and accepts the bottom. Preserve English
 // word spacing and quote roles; keep a readable excerpt for the image.
 const quote = text => {
  const compact = text.replace(/\s+/g,' ').trim();
  if (compact.length <= 100) return compact;
  const excerpt = compact.slice(0,99);
  const boundary = excerpt.lastIndexOf(' ');
  return excerpt.slice(0, boundary >= 60 ? boundary : 99) + '…';
 };
 return {topText:'AI rejects:\n'+quote(issues[0].sourceQuote),bottomText:'AI insists:\n'+quote(issues[0].replyQuote)};
}
