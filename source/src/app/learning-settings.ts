import {DEFAULT_TEACHING_SETTINGS,validateTeachingSettings} from './teaching-settings';
import {DEFAULT_ASSESSMENT,validateAssessment} from './assessment-settings';
import {PRACTICE_CURRICULUM_MAP_KEYS} from './practice-curriculum';
export const TEACHING_MAP_KEYS=['lessonAccess',...PRACTICE_CURRICULUM_MAP_KEYS];
export const isLearningMapField=(section:string,key:string)=>key==='lessonAccess'||section==='teaching'&&TEACHING_MAP_KEYS.includes(key);
export const TEACHING_HINT_KEYS=Object.keys(DEFAULT_TEACHING_SETTINGS).filter(k=>!['entryOverrides','customEntries','customTitle','customTitleVersion','customLessons','componentGroups','radicalVariantOverrides'].includes(k));
export const ASSESSMENT_HINT_KEYS=Object.keys(DEFAULT_ASSESSMENT);
export const ASSESSMENT_KINDS=['pretest','posttest'] as const;
export type LearningPatch={teaching:Record<string,any>;assessment:{pretest:Record<string,any>;posttest:Record<string,any>}};
export const emptyLearningPatch=():LearningPatch=>({teaching:{},assessment:{pretest:{},posttest:{}}});
const record=(v:any)=>!!v&&typeof v==='object'&&!Array.isArray(v);
export function validateLearningPatch(value:any,{stored=false}:{stored?:boolean}={}):LearningPatch{
 if(!record(value)||Object.keys(value).some(k=>!['teaching','assessment',...(stored?['_practicePreferencesRevision']:[])].includes(k))||(stored&&Object.hasOwn(value,'_practicePreferencesRevision')&&![1,2].includes(value._practicePreferencesRevision)))throw Error('提示設定格式不正確。');
 const teaching=value.teaching??{},assessment=value.assessment??{};
 if(!record(teaching)||!record(assessment)||Object.keys(assessment).some(k=>!ASSESSMENT_KINDS.includes(k as any))||Object.keys(teaching).some(k=>!TEACHING_HINT_KEYS.includes(k)))throw Error('提示設定包含無效欄位。');
 const patches=Object.fromEntries(ASSESSMENT_KINDS.map(k=>[k,assessment[k]??{}]));
 if(ASSESSMENT_KINDS.some(k=>!record(patches[k])||Object.keys(patches[k]).some(key=>!ASSESSMENT_HINT_KEYS.includes(key))))throw Error('測驗設定包含無效欄位。');
 if([...Object.values(teaching),...ASSESSMENT_KINDS.flatMap(k=>Object.values(patches[k]))].some(v=>v===null||v===undefined))throw Error('請取消自訂以恢復沿用設定。');
 // Older independent-writing presets must not inherit a newly enabled preview.
 // A partial hint override continues to inherit the parent's observation time.
 const independent=teaching.maskMode==='off'&&teaching.writingMode==='free'&&teaching.writingHint==='none'&&['allowMoreHint','allowPale','allowNextStroke','allowAnimation','autoStrokeHint'].every(key=>teaching[key]===false);
 const normalizedTeaching={...teaching};
 if(stored&&independent){
  if(!Object.hasOwn(value,'_practicePreferencesRevision')&&!Object.hasOwn(teaching,'writingObserveSeconds'))normalizedTeaching.writingObserveSeconds=0;
  // Version 1 already supports intentional observation inheritance, but predates the full-character button.
  if(value._practicePreferencesRevision!==2&&!Object.hasOwn(teaching,'allowFullCharacter'))normalizedTeaching.allowFullCharacter=false;
 }
 const t=validateTeachingSettings({...DEFAULT_TEACHING_SETTINGS,...normalizedTeaching}),a=validateAssessment(patches),out=emptyLearningPatch();
 out.teaching=Object.fromEntries(Object.keys(normalizedTeaching).map(k=>[k,(t as any)[k]]));for(const kind of ASSESSMENT_KINDS)out.assessment[kind]=Object.fromEntries(Object.keys(patches[kind]).map(k=>[k,a[kind][k]]));return out;
}
export function learningPatchForStorage(patch:LearningPatch){return {...patch,_practicePreferencesRevision:2};}
export function applyLearningPatch(base:any,patch:LearningPatch){return {teaching:{...base.teaching,...patch.teaching,...Object.fromEntries(TEACHING_MAP_KEYS.map(key=>[key,{...base.teaching[key],...patch.teaching[key]}]))},assessment:Object.fromEntries(ASSESSMENT_KINDS.map(k=>[k,{...base.assessment[k],...patch.assessment[k],lessonAccess:{...base.assessment[k].lessonAccess,...patch.assessment[k].lessonAccess}}]))};}
