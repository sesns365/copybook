import legacy from './nanyi-data.json';
import additional from './multi-curriculum.json';
export const DEFAULT_BOOK='nanyi-5a';
export const CUSTOM_BOOK='teacher-custom';
export const CUSTOM_LESSON='teacher-custom-1';
export const PUBLISHERS=[{id:'nanyi',name:'南一'},{id:'kangxuan',name:'康軒'},{id:'hanlin',name:'翰林'}];
export const GRADE_NAMES=['一','二','三','四','五','六'];
const source:Record<string,any[]>={...legacy};
export const LESSON_META:Record<string,{id:string;bookId:string;number:number;title:string}>={};
Object.keys(legacy).forEach((id,i)=>{LESSON_META[id]={id,bookId:DEFAULT_BOOK,number:i+1,title:id.replace(/^五上_\d+\s*/, '')}});
for(const l of additional){source[l.id]=l.entries;LESSON_META[l.id]={id:l.id,bookId:l.bookId,number:l.number,title:l.title}}
source[CUSTOM_LESSON]=[];
LESSON_META[CUSTOM_LESSON]={id:CUSTOM_LESSON,bookId:CUSTOM_BOOK,number:1,title:'自訂生字'};
export const SEMESTERS=[{id:'a',name:'上學期'},{id:'b',name:'下學期'}] as const;
export const BOOKS:{id:string;publisher:string;grade:number;semester?:'a'|'b';label:string;lessons:string[]}[]=PUBLISHERS.flatMap(p=>GRADE_NAMES.flatMap((n,i)=>SEMESTERS.map(sm=>{const id=`${p.id}-${i+1}${sm.id}`;return {id,publisher:p.id,grade:i+1,semester:sm.id,label:`${p.name}版・${n}年級${sm.name}`,lessons:Object.values(LESSON_META).filter(l=>l.bookId===id).sort((a,b)=>a.number-b.number).map(l=>l.id)}})));
BOOKS.push({id:CUSTOM_BOOK,publisher:'custom',grade:0,label:'老師自訂教材',lessons:[CUSTOM_LESSON]});
export type CustomLesson={title:string;number:number;version:number;deleted:boolean;importFingerprint?:string};
export const isCustomLesson=(id:unknown):id is string=>typeof id==='string'&&(id===CUSTOM_LESSON||/^teacher-custom-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id));
export function customLessonMap(settings:any={}):Record<string,CustomLesson>{return settings?.customLessons??{[CUSTOM_LESSON]:{title:settings?.customTitle||'自訂生字',number:1,version:settings?.customTitleVersion||0,deleted:false}};}
export function customLessonIds(settings:any={},includeDeleted=false){return Object.entries(customLessonMap(settings)).filter(([,l])=>includeDeleted||!l.deleted).sort((a,b)=>a[1].number-b[1].number).map(([id])=>id);}
export const getBook=(id?:string,settings:any={},includeDeleted=false)=>{const book=BOOKS.find(b=>b.id===id)||BOOKS.find(b=>b.id===DEFAULT_BOOK)!;return book.id===CUSTOM_BOOK?{...book,lessons:customLessonIds(settings,includeDeleted)}:book;};
export function getLessonMeta(id:string,settings:any={}){if(isCustomLesson(id)){const lesson=customLessonMap(settings)[id];return {id,bookId:CUSTOM_BOOK,number:lesson?.number||0,title:lesson?.title||'自訂教材',deleted:lesson?.deleted??false};}return Object.hasOwn(LESSON_META,id)?LESSON_META[id]:undefined;}
export function customLessonAvailable(settings:any,lesson:string){return !isCustomLesson(lesson)||!!customLessonMap(settings)[lesson]&&!customLessonMap(settings)[lesson].deleted;}
export function validateCustomLessons(value:any,title:string,version:number):Record<string,CustomLesson>{
 if(value===undefined||value===null)return customLessonMap({customTitle:title,customTitleVersion:version});
 if(typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>500)throw Error('自訂課次格式不正確，最多保存500份教材。');
 const out:Record<string,CustomLesson>={},numbers=new Set<number>();
 for(const [id,raw]of Object.entries(value)){const l=raw as CustomLesson;if(!isCustomLesson(id)||!l||typeof l.title!=='string'||!l.title.trim()||l.title.length>60||!Number.isSafeInteger(l.number)||l.number<1||numbers.has(l.number)||!Number.isSafeInteger(l.version)||l.version<0||typeof l.deleted!=='boolean')throw Error('請確認自訂教材名稱與版本。');numbers.add(l.number);out[id]={title:l.title.trim(),number:l.number,version:l.version,deleted:l.deleted,...(typeof l.importFingerprint==='string'&&/^[0-9a-f]{64}$/.test(l.importFingerprint)?{importFingerprint:l.importFingerprint}:{})};}
 return out;
}
export const lessonLabel=(id:string)=>{const l=getLessonMeta(id);return l?`${getBook(l.bookId).label}・第${l.number}課 ${l.title}`:id==='review'?'錯題複習':id};
export const isBook=(id:unknown)=>typeof id==='string'&&BOOKS.some(b=>b.id===id);
export const lessonInBook=(lesson:string,bookId:string)=>getLessonMeta(lesson)?.bookId===bookId;
export default source;

export const LESSON_BOOK_MAP_JSON=JSON.stringify(Object.fromEntries(Object.entries(LESSON_META).map(([id,l])=>[id,l.bookId])));
