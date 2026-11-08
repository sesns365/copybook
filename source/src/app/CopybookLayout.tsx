'use client';
import {useEffect,useState} from 'react';
export default function CopybookLayout({options,onOption,onPreview,onAuto}:{options:any;onOption:(key:string,value:number)=>void;onPreview:()=>void;onAuto:(count:number)=>void}){
 const [count,setCount]=useState(options.wordsPerColumn??1);
 // Saved documents and undo/redo can replace the applied layout. Other edits
 // must leave a teacher's not-yet-applied selection intact.
 useEffect(()=>setCount(options.wordsPerColumn??1),[options.wordsPerColumn]);
 return <fieldset className="rounded-xl border p-4 space-y-4"><legend className="px-2 font-bold">直接在學習單排版</legend><p>在預覽中拖曳整組語詞，放進同一直欄或新欄。放開後立即更新。</p><button type="button" className="rounded-xl bg-blue-700 px-4 py-3 font-bold text-white" onClick={onPreview}>開啟預覽排版</button><label className="block">語詞之間<select className="ml-2 rounded-lg border-2 p-2" value={options.wordGap??1} onChange={e=>onOption('wordGap',+e.target.value)}><option value={0}>不空格</option><option value={1}>空 1 格</option><option value={2}>空 2 格</option></select></label><details className="border-t pt-3"><summary className="cursor-pointer font-bold">自動排版（選用）</summary><div className="mt-3 flex flex-wrap gap-2"><select aria-label="自動排版每欄詞數" className="rounded-lg border-2 p-2" value={count} onChange={e=>setCount(+e.target.value)}><option value={1}>每欄 1 個語詞</option><option value={2}>每欄最多 2 個</option><option value={3}>每欄最多 3 個</option><option value={0}>依空間接續</option></select><button type="button" className="rounded-lg border-2 bg-white px-3 py-2 font-bold" onClick={()=>onAuto(count)}>套用自動排版</button></div><p className="mt-2 text-sm text-slate-600">重新安排所有語詞的欄位，保留各格的提示內容。</p></details></fieldset>;
}
