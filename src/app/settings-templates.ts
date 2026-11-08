import {ASSESSMENT_HINT_KEYS,TEACHING_HINT_KEYS,emptyLearningPatch,isLearningMapField,validateLearningPatch,type LearningPatch} from './learning-settings';
import {getBook} from './curriculum-source';
import {openLessons} from './lesson-access';
import {practiceLessonKeys} from './practice-curriculum';
const practicePlan=['lessonAccess','practiceCustomLessons','practiceLessonOrder','practiceEntrySelection'];
const speech=['speechVoiceURI','speechVoiceName','speechVoiceLang','speechRate','practiceWordSpeech','practiceSentenceSpeech','practiceAutoSpeech'];
const legacy=['voiceShowPinyin','cardFeedback','cardReadAnswer','cardAutoNext'];
const testHints=ASSESSMENT_HINT_KEYS.filter(k=>!['lessonAccess','questionPoints','pointsPerQuestion'].includes(k));
export const TEMPLATE_CATEGORIES=[
 {id:'practiceHints',name:'練習提示與份量',description:'畫、組、寫提示、慣用手、每次字數與課內順序',fields:[['teaching',TEACHING_HINT_KEYS.filter(k=>![...practicePlan,...speech,...legacy].includes(k))]]},
 {id:'speech',name:'報讀聲音',description:'聲音、速度與練習報讀方式',fields:[['teaching',speech]]},
 {id:'practicePlan',name:'課次、排序與選字',description:'包括共用的主教材開放課次，會連帶影響前後測可進入的課次',fields:[['teaching',practicePlan]]},
 {id:'pretestHints',name:'前測提示',description:'報讀、觀察、揭示與書寫提示',fields:[['pretest',testHints]]},
 {id:'posttestHints',name:'後測提示',description:'報讀、觀察、揭示與書寫提示',fields:[['posttest',testHints]]},
 {id:'testAccess',name:'前後測開放課次',description:'兩種測驗的開放課次',fields:[['pretest',['lessonAccess']],['posttest',['lessonAccess']]]},
 {id:'testPoints',name:'前後測配分',description:'共同配分與逐題配分',fields:[['pretest',['pointsPerQuestion','questionPoints']],['posttest',['pointsPerQuestion','questionPoints']]]},
] as const;
export type SettingsTemplate={id:string;name:string;created:string;source:string;categories:string[];patch:LearningPatch};
const part=(patch:any,section:string)=>section==='teaching'?patch.teaching:patch.assessment[section];
export function selectTemplateFields(value:any,categories:readonly string[]):LearningPatch{
 const out=emptyLearningPatch();
 for(const category of TEMPLATE_CATEGORIES.filter(c=>categories.includes(c.id)))for(const [section,keys] of category.fields)for(const key of keys)if(Object.hasOwn(part(value,section)||{},key))part(out,section)[key]=structuredClone(part(value,section)[key]);
 return validateLearningPatch(out);
}
export function captureTemplateFields(value:any,categories:readonly string[],bookId:string):LearningPatch{
 const out=selectTemplateFields(value,categories),book=getBook(bookId,value.teaching);
 // Store semantic defaults (all lessons/all words) explicitly for the displayed book.
 // A default-all template must be able to undo a recipient's restricted selection.
 if(categories.includes('practicePlan')){
  out.teaching.lessonAccess={[book.id]:openLessons(value.teaching,book.id,value.teaching)};
  const lessons=practiceLessonKeys(value.teaching,book.id);
  out.teaching.practiceLessonOrder={[book.id]:lessons};
  out.teaching.practiceEntrySelection=Object.fromEntries(lessons.map(id=>[id,value.teaching.practiceEntrySelection?.[id]??null]));
 }
 if(categories.includes('testAccess'))for(const kind of ['pretest','posttest'] as const)out.assessment[kind].lessonAccess={[book.id]:openLessons(value.assessment[kind],book.id,value.teaching)};
 return validateLearningPatch(out);
}
export function applySettingsTemplate(draft:LearningPatch,template:SettingsTemplate,categories:string[]):LearningPatch{
 const selected=selectTemplateFields(template.patch,categories.filter(id=>template.categories.includes(id))),next=structuredClone(draft);
 for(const section of ['teaching','pretest','posttest'])for(const [key,value]of Object.entries(part(selected,section))){
  // Maps contain only the explicitly listed books/lessons. Other books retain their current settings.
  part(next,section)[key]=isLearningMapField(section,key)?{...part(next,section)[key],...value as any}:structuredClone(value);
 }
 return validateLearningPatch(next);
}
export function parseSettingsTemplates(raw:string|null):SettingsTemplate[]{
 if(raw===null)return [];
 let records:any;try{records=JSON.parse(raw)}catch{throw Error('此瀏覽器的教學範本無法讀取，請保留資料並重新整理。')}
 if(!Array.isArray(records)||records.length>40)throw Error('教學範本格式不正確。');
 return records.map(record=>{
  if(!record||typeof record.id!=='string'||!record.id||record.id.length>80||typeof record.name!=='string'||!record.name.trim()||record.name.length>60||typeof record.source!=='string'||record.source.length>100||typeof record.created!=='string'||!Array.isArray(record.categories)||!record.categories.length||record.categories.some((id:unknown)=>!TEMPLATE_CATEGORIES.some(c=>c.id===id)))throw Error('教學範本格式不正確。');
  return {...record,patch:selectTemplateFields(validateLearningPatch(record.patch),record.categories)};
 });
}
export const settingsTemplatesKey=(classroomId:string)=>'character-writing:settings-templates:v1:'+encodeURIComponent(classroomId);
