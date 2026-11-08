'use client';
import {useLessonTitle,useCurriculum} from './CurriculumTitle';
import {BOOKS} from './curriculum-source';
import {useEffect,useState} from 'react';
import {courseMatchesSearch} from './course-search';
const style='border-2 rounded-lg p-2 bg-white';
export function BookSelect({value,onChange,allLabel='',disabled=false,label='教材版本',allowedIds}:{value:string;onChange:(s:string)=>void;allLabel?:string;disabled?:boolean;label?:string;allowedIds?:string[]}){return <label>{label}<select className={style+' block mt-1'} value={value} disabled={disabled} onChange={e=>onChange(e.target.value)}>{allLabel&&<option value="">{allLabel}</option>}{['nanyi','kangxuan','hanlin','custom'].map(p=><optgroup key={p} label={{nanyi:'南一',kangxuan:'康軒',hanlin:'翰林',custom:'自訂'}[p]}>{BOOKS.filter(b=>b.publisher===p&&(!allowedIds||allowedIds.includes(b.id))).map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</optgroup>)}</select></label>}
export default function CurriculumPicker({lesson,onChange,includeCustom=true,initialBookId}:{lesson:string;onChange:(s:string)=>void;includeCustom?:boolean;initialBookId?:string}){
 const lessonTitle=useLessonTitle(),{getBook,getLessonMeta}=useCurriculum();
 const [selectedBook,setSelectedBook]=useState(getBook(getLessonMeta(lesson)?.bookId||initialBookId).id),[search,setSearch]=useState('');
 const book=getBook(getLessonMeta(lesson)?.bookId||selectedBook);
 useEffect(()=>{setSearch('')},[book.id]);
 useEffect(()=>{if(!book.lessons.includes(lesson)){const next=book.lessons[0]||'';if(next!==lesson)onChange(next)}},[lesson,book.id,book.lessons.join('|')]);
 const matches=book.lessons.filter(id=>courseMatchesSearch(search,getLessonMeta(id))),retained=book.lessons.includes(lesson)&&!matches.includes(lesson),visible=retained?[lesson,...matches]:matches;
 return <div className="space-y-2"><div className="flex flex-wrap gap-4"><BookSelect allowedIds={includeCustom?undefined:BOOKS.filter(b=>b.publisher!=='custom').map(b=>b.id)} value={book.id} onChange={id=>{setSearch('');setSelectedBook(id);onChange(getBook(id).lessons[0]||'')}}/><label>搜尋本版本課次<input type="search" className={style+' block mt-1 w-full sm:w-60'} aria-label="搜尋本版本課次" value={search} placeholder="課名或課次，可用頓號分隔" onChange={e=>setSearch(e.target.value)}/></label><label>課次<select className={style+' block mt-1'} value={lesson} disabled={!book.lessons.length} onChange={e=>onChange(e.target.value)}>{!book.lessons.length&&<option value="">尚未建立教材</option>}{visible.map(id=><option key={id} value={id}>{id===lesson&&retained?'目前選擇・':''}第{getLessonMeta(id)!.number}課 {lessonTitle(id)}</option>)}</select></label>{search&&<button type="button" className={style+' self-end text-blue-900 font-bold'} onClick={()=>setSearch('')}>清除課次搜尋</button>}</div>{search.trim()&&<p role="status" className="text-sm text-slate-600">本版本符合 {matches.length} 課；多個關鍵字符合其中一個即可。{retained?'目前選擇未符合搜尋，仍保留在選單；搜尋不會切換課次。':''}</p>}</div>;
}
