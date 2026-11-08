// Use the worksheet's selected content, so browsing another course does not
// rename a sheet that still contains words from the previous course.
export function automaticCopybookTitle(entries:any[],fallbackLesson:string,getLessonMeta:(id:string)=>any,getBook:(id:string)=>any){
 const ids=[...new Set<string>(entries.length?entries.map(e=>e.lesson):[fallbackLesson])];
 const lessons=ids.map(id=>getLessonMeta(id)).filter(Boolean).sort((a,b)=>String(a.bookId).localeCompare(String(b.bookId))||a.number-b.number);
 let label='';
 if(lessons.length===1){const lesson=lessons[0];label=`${getBook(lesson.bookId)?.label||''} ${lesson.number?`第${lesson.number}課 `:''}${lesson.title||''}`.trim()}
 else if(lessons.length>1){const books=[...new Set(lessons.map(l=>l.bookId))];label=books.length===1?`${getBook(books[0])?.label||''} ${lessons.length<=4?'第'+lessons.map(l=>l.number).join('、')+'課':'多課次'}`:'跨版本多課次'}
 const suffix='生字學習單';
 return label?[...label].slice(0,45-suffix.length-1).join('')+' '+suffix:suffix;
}
