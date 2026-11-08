// A saved worksheet owns its vocabulary and course labels independently of the source curriculum.
const clone=(value:any)=>JSON.parse(JSON.stringify(value));
const validEntry=(entry:any)=>entry&&typeof entry.id==='string'&&typeof entry.lesson==='string'&&typeof entry.word==='string'&&entry.word.length>0&&typeof entry.pinyin==='string'&&Number.isInteger(entry.targetIdx)&&entry.targetIdx>=0&&entry.targetIdx<entry.word.length;
export function captureCopybookContent(entries:any[],getLessonMeta:(id:string)=>any,getBook:(id:string)=>any){
 const entrySnapshots=clone(entries),lessonSnapshots:any={},bookSnapshots:any={};
 for(const entry of entries){const lesson=getLessonMeta(entry.lesson);if(lesson){lessonSnapshots[entry.lesson]=clone(lesson);const book=getBook(lesson.bookId);if(book)bookSnapshots[lesson.bookId]={id:book.id,label:book.label}}}
 return {snapshotVersion:1,entrySnapshots,lessonSnapshots,bookSnapshots};
}
export function mergeCopybookEntries(source:any[],snapshots:any[]=[]){return [...new Map([...source,...snapshots.filter(validEntry)].map(entry=>[entry.id,entry])).values()]}
export function restoreCopybookContent(config:any,source:any[]){
 const selected=Array.isArray(config.selected)?[...new Set<string>(config.selected.filter((id:any)=>typeof id==='string'))]:[];
 const snapshots=Array.isArray(config.entrySnapshots)?config.entrySnapshots.filter((entry:any)=>validEntry(entry)&&selected.includes(entry.id)):[];
 const all=mergeCopybookEntries(source,snapshots),available=new Set(all.map(entry=>entry.id));
 const missing=selected.filter(id=>!available.has(id)).map(id=>({id,label:config.options?.items?.[id]?.word||`第 ${selected.indexOf(id)+1} 個原語詞`}));
 return {selected,all,snapshots,missing,lessonSnapshots:config.lessonSnapshots&&typeof config.lessonSnapshots==='object'?config.lessonSnapshots:{},bookSnapshots:config.bookSnapshots&&typeof config.bookSnapshots==='object'?config.bookSnapshots:{}};
}
