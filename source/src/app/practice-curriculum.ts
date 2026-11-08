import {BOOKS,LESSON_META,customLessonAvailable,getBook,isCustomLesson} from './curriculum-source';
import {curriculumEntries,isCustomEntryId} from './curriculum-settings';
import {openLessons} from './lesson-access';

export type PracticeLessonOrder=Record<string,string[]>;
export type PracticeEntrySelection=Record<string,string[]|null>;
export const PRACTICE_CURRICULUM_MAP_KEYS=['practiceLessonOrder','practiceEntrySelection'] as const;
const entryLessons=new Map(curriculumEntries.map(entry=>[entry.id,entry.lesson]));
const validLesson=(id:unknown):id is string=>typeof id==='string'&&(isCustomLesson(id)||Object.hasOwn(LESSON_META,id));
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);

export function validatePracticeCustomLessons(value:unknown):string[]{
 if(!Array.isArray(value)||value.length>500||value.some(id=>!isCustomLesson(id)))throw Error('附加練習教材須選擇有效的自訂課次，最多500課。');
 return [...new Set(value)] as string[];
}
export function validatePracticeLessonOrder(value:unknown):PracticeLessonOrder{
 if(!record(value)||Object.keys(value).length>BOOKS.length)throw Error('練習課次順序格式不正確。');
 const out:PracticeLessonOrder={};
 for(const [bookId,lessons]of Object.entries(value)){
  const book=BOOKS.find(b=>b.id===bookId);
  if(!book||!Array.isArray(lessons)||lessons.length>1000||lessons.some(id=>typeof id!=='string'||!isCustomLesson(id)&&!book.lessons.includes(id)))throw Error('練習順序只能包含本版本與自訂教材的課次。');
  out[bookId]=[...new Set(lessons)];
 }
 return out;
}
export function validatePracticeEntrySelection(value:unknown):PracticeEntrySelection{
 if(!record(value)||Object.keys(value).length>1000)throw Error('每課練習生字格式不正確。');
 const out:PracticeEntrySelection={};
 for(const [lesson,ids]of Object.entries(value)){
  if(!validLesson(lesson))throw Error('請選擇有效的練習課次。');
  if(ids===null){out[lesson]=null;continue;}
  if(!Array.isArray(ids)||ids.length>1000||ids.some(id=>typeof id!=='string'||!isCustomEntryId(id)&&entryLessons.get(id)!==lesson))throw Error('練習生字須屬於所選課次。');
  out[lesson]=[...new Set(ids)];
 }
 return out;
}

// Saved references may outlive deleted custom material. Keep those references
// valid in storage, but only expose currently available lessons and entries.
export function practiceLessonKeys(settings:any={},bookId?:string):string[]{
 const book=getBook(bookId,settings),extras=Array.isArray(settings?.practiceCustomLessons)?settings.practiceCustomLessons:[];
 const natural=[...new Set([...openLessons(settings,book.id,settings),...extras.filter((id:unknown)=>isCustomLesson(id)&&customLessonAvailable(settings,id))])];
 const available=new Set(natural),configured=settings?.practiceLessonOrder?.[book.id];
 const ordered=Array.isArray(configured)?configured.filter(id=>available.has(id)):[];
 return [...new Set([...ordered,...natural])];
}
export function practiceLessonEntries<T extends {id:string;lesson?:string;enabled?:boolean}>(curriculum:Record<string,T[]>,settings:any={},lesson:string):T[]{
 if(!validLesson(lesson)||!customLessonAvailable(settings,lesson))return [];
 const configured=settings?.practiceEntrySelection?.[lesson],selected=Array.isArray(configured)?new Set(configured):null,seen=new Set<string>();
 return (curriculum[lesson]||[]).filter(entry=>{
  if(!entry||entry.enabled===false||entry.lesson!==undefined&&entry.lesson!==lesson||seen.has(entry.id)||selected&&!selected.has(entry.id))return false;
  if(isCustomEntryId(entry.id)){
   const custom=settings?.customEntries?.[entry.id];
   if(!custom||custom.enabled===false||custom.lesson!==lesson)return false;
  }else if(entryLessons.get(entry.id)!==lesson)return false;
  seen.add(entry.id);return true;
 });
}
