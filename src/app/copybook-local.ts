// Browser-local worksheet recovery never changes a server worksheet's version.
export const COPYBOOK_DRAFT_VERSION=1;
// A draft may include the current edit plus independent immutable ordinary/copy requests.
export const COPYBOOK_DRAFT_MAX_LENGTH=12000000;
const validObject=(value:any)=>!!value&&typeof value==='object'&&!Array.isArray(value);
const clone=(value:any)=>JSON.parse(JSON.stringify(value));
export function copybookLocalScope(classroomId:any,userId?:any){
 if(classroomId===undefined||classroomId===null||classroomId==='')return '';
 return `copybook-local:v1:${encodeURIComponent(String(classroomId))}:${encodeURIComponent(String(userId||'teacher'))}:`;
}
export function captureCopybookSaveRequest(payload:any,documentKey:string,selectedSavedId:string){
 return clone({payload,documentKey,origin:{selectedSavedId},dispatched:false});
}
const validSaveRequest=(request:any)=>{
 const payload=request?.payload;
 return validObject(request)&&typeof request.documentKey==='string'&&typeof request.origin?.selectedSavedId==='string'&&payload?.action==='saveWorksheet'&&typeof payload.id==='string'&&/^[-\w]{20,100}$/.test(payload.id)&&Number.isSafeInteger(payload.version)&&payload.version>=0&&typeof payload.title==='string'&&validObject(payload.config)&&payload.config.layout==='copybook'&&JSON.stringify(payload.config).length<=1800000;
};
export function parseCopybookDraft(raw:string|null){
 try{
  if(!raw||raw.length>COPYBOOK_DRAFT_MAX_LENGTH)return null;
  const draft=JSON.parse(raw),config=draft.config;
  if(draft.version!==COPYBOOK_DRAFT_VERSION||typeof draft.id!=='string'||!Number.isFinite(draft.updatedAt)||!validObject(config)||config.layout!=='copybook'||typeof config.lesson!=='string'||!Array.isArray(config.selected)||!config.selected.every((id:any)=>typeof id==='string')||!validObject(config.options))return null;
  if(typeof draft.savedId!=='string'||!Number.isSafeInteger(draft.savedVersion)||draft.savedVersion<0||typeof draft.savedDocumentKey!=='string')return null;
  if(draft.savedId&&!draft.savedVersion)return null;
  if(draft.saveRequest!=null&&!validSaveRequest(draft.saveRequest))return null;
  return {...draft,batchRules:normalisePromptRules(draft.batchRules)};
 }catch{return null;}
}
export function readCopybookDrafts(storage:Storage,scope:string,exceptId=''){
 if(!scope)return [];
 const prefix=scope+'draft:',result=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix)||key===prefix+exceptId)continue;
  const raw=storage.getItem(key),draft=parseCopybookDraft(raw);
  if(draft&&key===prefix+draft.id)result.push({...draft,storageKey:key,raw});
 }
 return result.sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function writeCopybookDraft(storage:Storage,scope:string,draft:any){
 if(!scope)return;
 const raw=JSON.stringify({...draft,version:COPYBOOK_DRAFT_VERSION});
 if(!parseCopybookDraft(raw))throw Error('草稿內容無法保存，請儲存學習單設定。');
 storage.setItem(scope+'draft:'+draft.id,raw);
}
// A different tab may have edited the same draft after the recovery list loaded.
export function discardCopybookDraft(storage:Storage,draft:any){
 if(storage.getItem(draft.storageKey)!==draft.raw)return false;
 storage.removeItem(draft.storageKey);return true;
}
const modes=new Set(['trace','gray','parts','blank','model']),styles=new Set(['black','gray','red','blank']);
export function normalisePromptRules(value:any){
 if(!validObject(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([key,rule]:any)=>/^(0|[1-9]\d?)$/.test(key)&&Number(key)<20&&validObject(rule)&&modes.has(rule.mode)).map(([key,rule]:any)=>[key,{mode:rule.mode,...(rule.mode==='parts'?{firstStyle:styles.has(rule.firstStyle)?rule.firstStyle:'black',otherStyle:styles.has(rule.otherStyle)?rule.otherStyle:'gray'}:{})}]));
}
export function readCopybookTemplates(storage:Storage,scope:string){
 if(!scope)return [];
 const prefix=scope+'template:',result=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix))continue;
  try{const item=JSON.parse(storage.getItem(key)||'null');if(item&&key===prefix+item.id&&typeof item.name==='string'&&item.name.trim()&&Number.isFinite(item.updatedAt)){const rules=normalisePromptRules(item.rules);if(Object.keys(rules).length)result.push({...item,rules})}}catch{}
 }
 return result.sort((a,b)=>b.updatedAt-a.updatedAt);
}
export function writeCopybookTemplate(storage:Storage,scope:string,item:any){
 const name=String(item.name||'').trim().slice(0,40),rules=normalisePromptRules(item.rules);
 if(!scope||!name||!Object.keys(rules).length)throw Error('請輸入範本名稱，並至少選好一次目標字提示。');
 storage.setItem(scope+'template:'+item.id,JSON.stringify({id:item.id,name,rules,updatedAt:item.updatedAt}));
}
export function createAssessmentCopybookSeed(request:any,defaults:any){
 if(!request||typeof request.requestId!=='string'||!request.requestId||request.requestId.length>100||!Array.isArray(request.entries)||!request.entries.length)return null;
 if(!request.entries.every((entry:any)=>entry&&typeof entry.word==='string'&&entry.word.length>0&&typeof entry.pinyin==='string'&&Number.isInteger(entry.targetIdx)&&entry.targetIdx>=0&&entry.targetIdx<entry.word.length))return null;
 const lesson=`followup:${request.requestId}`,bookId='assessment-followup';
 const entries=request.entries.map((entry:any,index:number)=>({...clone(entry),id:`followup:${request.requestId}:${index}`,sourceLesson:entry.lesson||request.lesson,lesson,bookId,character:entry.word[entry.targetIdx]}));
 if(!entries.length)return null;
 const config={layout:'copybook',lesson,selected:entries.map((entry:any)=>entry.id),options:{...clone(defaults),title:String(request.suggestedTitle||'測驗後補練學習單').slice(0,45),titleCustom:true,orderVersion:1},snapshotVersion:1,entrySnapshots:entries,lessonSnapshots:{[lesson]:{id:lesson,bookId,title:String(request.lessonLabel||'測驗後補練'),number:1}},bookSnapshots:{[bookId]:{id:bookId,label:String(request.bookLabel||'測驗後補練')}}};
 return JSON.stringify(config).length<=1800000?config:null;
}
