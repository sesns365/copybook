"use client";
import {bookItem,bookCount,bookStoredItem} from './copybook-export';

export default function CopybookWordRepetitions({entries,options,disabled,lessonLabel,onChange,onEdit,onMove}:{entries:any[];options:any;disabled:boolean;lessonLabel:(id:string)=>string;onChange:(entryId:string,value:string)=>void;onEdit?:(entryId:string)=>void;onMove?:(entryId:string,dir:number)=>void}){
 return <details className="border-2 border-blue-200 rounded-xl p-4">
  <summary className="font-bold cursor-pointer">語詞順序與練習次數 <span className="text-sm font-normal text-slate-600">（已選 {entries.length} 個語詞，點此展開／收合）</span></summary>
  <fieldset disabled={disabled} className="space-y-3 mt-3">
  <legend className="sr-only">語詞次數設定</legend>
  <p className="text-sm text-slate-600">用 ↑↓ 調整語詞在學習單上的先後順序（手機上比拖曳方便）。每個語詞可獨立設定 1～20 次（含示範字）。選「沿用整張」會跟著整張預設調整；預覽立即更新。</p>
  {!entries.length?<p>請先勾選要加入學習單的語詞。</p>:<ul aria-label="已選語詞與練習次數" className="max-h-80 overflow-y-auto divide-y rounded-lg border bg-white">
   {entries.map((entry,i)=>{
    const independent=bookStoredItem(entry,options).repetitions!=null;
    const inputId=`copybook-word-repetitions-${entry.id}`;
    return <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
     <div className="min-w-0 flex-1">
      <label htmlFor={inputId} className="font-bold break-words">{i+1}. {entry.word}</label>
      <p className="text-sm text-slate-600 break-words">{lessonLabel(entry.lesson)}・生字「{entry.word[bookItem(entry,options).targetIdx]}」</p>
      <p className={'text-sm '+(independent?'text-blue-800 font-bold':'text-slate-600')}>{independent?'獨立設定':'沿用整張'}：{bookCount(entry,options)} 次</p>
     </div>
     <div className="flex flex-wrap items-center gap-2">{onMove&&<span className="flex gap-1"><button type="button" className="h-11 w-11 rounded-lg border-2 bg-white text-lg font-bold disabled:opacity-30" disabled={disabled||i===0} aria-label={`${entry.word}往前移`} onClick={()=>onMove(entry.id,-1)}>↑</button><button type="button" className="h-11 w-11 rounded-lg border-2 bg-white text-lg font-bold disabled:opacity-30" disabled={disabled||i===entries.length-1} aria-label={`${entry.word}往後移`} onClick={()=>onMove(entry.id,1)}>↓</button></span>}<select id={inputId} data-entry-id={entry.id} aria-label={`${entry.word}練習次數`} className="border-2 rounded-lg p-2 bg-white max-w-full" value={bookStoredItem(entry,options).repetitions??''} onChange={e=>onChange(entry.id,e.target.value)}>
      <option value="">沿用整張（{options.repetitions} 次）</option>
      {Array.from({length:20},(_,n)=>n+1).map(n=><option key={n} value={n}>{n} 次</option>)}
     </select>{onEdit&&<button type="button" className="border-2 border-blue-300 rounded-lg px-3 py-2 bg-white font-bold text-blue-900 disabled:opacity-40" disabled={disabled} aria-label={`編輯語詞${entry.word}的字格提示`} onClick={()=>onEdit(entry.id)}>編輯這個語詞</button>}</div>
    </li>;
   })}
  </ul>}
  <p className="text-sm text-slate-600">已獨立設定的語詞不受整張預設次數影響。{onEdit?'按「編輯這個語詞」可直接調整該詞的字格提示，跨課語詞也適用。 ':''}調整後可按「復原」，完成後請儲存學習單設定。</p>
 </fieldset></details>;
}
