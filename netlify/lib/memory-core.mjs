export const MODEL='gpt-4.1-mini';
export const LEVELS=[100,75,50,25,0];
export const FIELD_ORDER=['place','person','purpose','action','object'];
export function emptyState(){return {version:2,revision:0,cards:[],facts:[],chat:[],runs:[],scans:[],experiments:[],level:100,lastAudit:null};}
export function normalize(s){return String(s??'').normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');}
export function gradeFact(f,value){if(value===null||value===undefined||String(value).trim()===''||/^(unknown|不知道|不确定|未知|无法确认|null)$/i.test(String(value).trim()))return 'unknown';return [f.answer,...(f.aliases||[])].some(a=>normalize(a)===normalize(value))?'correct':'mismatch';}
export function buildContext(state,level=state.level){
 const items=[];
 for(const card of state.cards){if(card.status==='forgotten'||card.status==='superseded')continue;
  const facts=state.facts.filter(f=>f.cardId===card.id&&f.confirmed);
  if(facts.length){for(const fact of facts)items.push({cardId:card.id,factId:fact.id,kind:fact.kind,label:fact.label,value:fact.answer,pinned:card.status==='keep'});}
  else items.push({cardId:card.id,factId:null,kind:'object',label:'用户记录',value:card.text,pinned:card.status==='keep'});
 }
 const loose=items.filter(i=>!i.pinned),drop=Math.floor(loose.length*(100-level)/100);
 const sorted=[...loose].sort((a,b)=>FIELD_ORDER.indexOf(a.kind)-FIELD_ORDER.indexOf(b.kind));
 const omitted=new Set(sorted.slice(0,drop));
 const included=items.filter(i=>i.pinned||!omitted.has(i));
 const input=included.map(({cardId,factId,kind,label,value})=>({cardId,factId,kind,label,value}));
 return {input,includedFactIds:included.map(i=>i.factId).filter(Boolean),removed:items.filter(i=>omitted.has(i)).map(({cardId,factId,kind,label})=>({cardId,factId,kind,label})),level};
}
export function questions(facts,knownFacts=facts){
 // A question about an object can accidentally reveal a forgotten person's name.
 const values=[...new Set(knownFacts.flatMap(f=>[f.answer,...(f.aliases||[]) ]).filter(v=>typeof v==='string'&&v.length))].sort((a,b)=>b.length-a.length);
 return facts.map(({id,question})=>{let safe=question;for(const value of values){const escaped=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');safe=safe.replace(new RegExp(escaped,'gi'),'[已隐藏的事实]');}return {id,question:safe};});
}
export function scoreRecall(facts,answers,context){
 const map=new Map();for(const a of Array.isArray(answers)?answers:[]){if(a&&typeof a.id==='string'&&!map.has(a.id))map.set(a.id,typeof a.value==='string'?a.value.slice(0,500):null);}
 const rows=facts.map(f=>{const value=map.get(f.id)??null,status=gradeFact(f,value),inContext=context.includedFactIds.includes(f.id);return {id:f.id,cardId:f.cardId,question:f.question,expected:f.answer,value,status,inContext,cause:status==='correct'?(inContext?'supported':'correct-without-source'):inContext?'present-but-unrecalled':'not-provided'};});
 const correct=rows.filter(r=>r.status==='correct').length,mismatch=rows.filter(r=>r.status==='mismatch').length,unknown=rows.filter(r=>r.status==='unknown').length;
 return {tested:rows.length,correct,mismatch,unknown,score:rows.length?Math.round(correct/rows.length*100):null,rows};
}
export function relevantFacts(facts,message){const text=normalize(message);return facts.filter(f=>f.confirmed&&(text.includes(normalize(f.question))||(f.cues||[f.label]).some(c=>c&&text.includes(normalize(c))))).slice(0,8);}
export function mutationFields(fields,level){const valid=fields.filter(f=>FIELD_ORDER.includes(f.kind)&&typeof f.value==='string');const n=Math.floor(valid.length*level/100);const sorted=[...valid].sort((a,b)=>FIELD_ORDER.indexOf(b.kind)-FIELD_ORDER.indexOf(a.kind));return sorted.slice(0,n).map(({kind,label,value})=>({kind,label,value}));}
export function assertRevision(state,revision){if(state.revision!==revision){const e=new Error('记录已在另一个页面更新，已同步，请重试。');e.status=409;throw e;}}
export function statusChange(state,id,status){const c=state.cards.find(c=>c.id===id);if(!c)throw new Error('记忆不存在');if(!['active','keep','forgotten','superseded'].includes(status))throw new Error('状态无效');if(c.status==='keep'&&status!=='active')throw new Error('请先解除 Keep');c.status=status;}
export const FIXTURE=[
 ['person','项目负责人','项目负责人是谁？','林柚',['负责人']],
 ['place','活动地点','活动地点在哪里？','UNSW K17',['地点','在哪里']],
 ['object','项目名称','我的项目名称是什么？','南瓜邮局',['名称','项目名','叫什么']],
 ['purpose','主要目的','项目的主要目的是什么？','回收过期决定',['目的']],
 ['action','启动口令','启动口令是什么？','PURPLE-PENGUIN-47',['口令','暗号']],
 ['person','吉祥物','吉祥物是谁？','奶龙',['吉祥物']],
 ['place','演示房间','演示房间在哪里？','RAVEN-204',['房间']],
 ['object','预算','预算金额是多少？','50 AUD',['预算']],
 ['purpose','目标用户','目标用户是哪类人？','做长项目的学生',['目标用户']],
 ['action','演示时长','演示时长是多少？','3 MIN',['时长']],
 ['person','测试员','测试员是谁？','陈橘',['测试员']],
 ['place','物料仓库','物料仓库在哪里？','PUMPKIN-B12',['仓库']],
 ['object','奖励物品','奖励物品是什么？','紫色南瓜贴纸',['奖励']],
 ['purpose','旧方案淘汰原因','旧方案为什么淘汰？','打印机会偷吃糖果',['淘汰原因']],
 ['action','提交标记','提交标记是什么？','GHOST-READY-9',['提交标记']],
 ['person','讲解员','讲解员是谁？','周梨',['讲解员']],
 ['place','集合位置','集合位置在哪里？','BAT-GATE-3',['集合']],
 ['object','备用电池','备用电池型号是什么？','MOON-CR2032',['电池']],
 ['purpose','验收标准','验收标准是什么？','旧预算不再影响回答',['验收']],
 ['action','结束口令','结束口令是什么？','BOO-DONE-82',['结束口令']]
];
export function makeFixture(prefix='lab'){
 const cards=[],facts=[];FIXTURE.forEach(([kind,label,question,answer,cues],i)=>{const id=`${prefix}-f${i+1}`,cardId=`${prefix}-c${i+1}`;cards.push({id:cardId,text:`${label}：${answer}`,status:'active',source:'fixture'});facts.push({id,cardId,kind,label,question,answer,cues,aliases:label==='预算'?['50澳元','AUD50']:[],confirmed:true});});return {cards,facts};
}
