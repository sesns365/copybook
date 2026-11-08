// @ts-nocheck
'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {GripVertical,Trash2,Plus,ArrowLeftRight} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {arrangeBookWord,bookCells} from './copybook-export';

export default function CopybookPreviewGrid({entries,options,plan,page,arranging,disabled,renderCell,onEditCell,onArrange,onDelete,onStartArrange,onPageChange,active,repeat,index}){
 const root=useRef(null),gesture=useRef(null),ignoreClick=useRef(false),pickerOpener=useRef(null);
 const [picked,setPicked]=useState(''),[drag,setDrag]=useState(null),[notice,setNotice]=useState(''),[picker,setPicker]=useState(null),[sourcePage,setSourcePage]=useState('all');
 const lookup=new Map(entries.map(e=>[e.id,e])),moving=lookup.has(picked)?picked:'',word=lookup.get(moving),columnList=plan.pages[page]||[];
 const sourcePages=new Map();plan.pages.forEach((cols,p)=>cols.forEach(col=>(col.entryIds||[]).forEach(id=>{const pages=sourcePages.get(id)||[];if(!pages.includes(p))pages.push(p);sourcePages.set(id,pages)})));
 const pageLabel=id=>(sourcePages.get(id)||[]).map(p=>p+1).join('、');
 const releaseGesture=()=>{const g=gesture.current;gesture.current=null;if(g&&root.current?.hasPointerCapture?.(g.pointerId))root.current.releasePointerCapture(g.pointerId)};
 const reset=()=>{releaseGesture();setDrag(null)};
 // Memoize only displayed cell positions; pointer moves do not serialize all saved hints.
 const layoutKey=useMemo(()=>JSON.stringify([plan.rows,plan.width,plan.headerHeight,plan.pages.map(cols=>cols.map(col=>[col.title||false,col.groupIndex,col.groupOffset,col.cells.map(c=>[c.entryId||'',c.char||'',c.repeat,c.charIndex])]))]),[plan]);
 useEffect(()=>{reset()},[page,layoutKey]);
 useEffect(()=>{if(disabled||!arranging)reset()},[disabled,arranging]);
 useEffect(()=>()=>releaseGesture(),[]);
 const choose=id=>{if(disabled||gesture.current)return;setPicked(id);setNotice('');onStartArrange?.()};
 const place=(target,id=moving)=>{if(!lookup.has(id)||disabled||gesture.current)return;const result=arrangeBookWord(entries,options,id,target);if(result.error){setNotice(result.error);return;}if(result.unchanged){setNotice('語詞已在這個位置。');return;}onArrange(result,id);setPicked('');setNotice('已移動「'+lookup.get(id).word+'」，預覽已更新。')};
 const begin=(event,id)=>{if(disabled||event.button!==0)return;event.preventDefault();if(gesture.current)return;choose(id);gesture.current={id,pointerId:event.pointerId,x:event.clientX,y:event.clientY,moved:false};root.current?.setPointerCapture?.(event.pointerId)};
 const pointerMove=event=>{const g=gesture.current;if(!g||g.pointerId!==event.pointerId)return;if(!g.moved&&Math.hypot(event.clientX-g.x,event.clientY-g.y)<5)return;g.moved=true;const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-copybook-drop]');let target=null;try{target=hit?JSON.parse(hit.dataset.copybookDrop):null}catch{}const result=target?arrangeBookWord(entries,options,g.id,target):null;setDrag({x:event.clientX,y:event.clientY,target,error:result?.error});const scroll=root.current?.closest('.copybook-panel-body');if(scroll){const r=scroll.getBoundingClientRect();if(event.clientY>r.bottom-35)scroll.scrollTop+=18;else if(event.clientY<r.top+35)scroll.scrollTop-=18;}};
 const pointerUp=event=>{const g=gesture.current;if(!g||g.pointerId!==event.pointerId)return;reset();if(g.moved&&!disabled){ignoreClick.current=true;const hit=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-copybook-drop]');if(hit){try{place(JSON.parse(hit.dataset.copybookDrop),g.id)}catch{setNotice('請重新選擇放置位置。')}}setTimeout(()=>{ignoreClick.current=false},0)}};
 const cancelPointer=event=>{if(gesture.current?.pointerId!==event.pointerId)return;reset();setNotice('已取消拖曳，可重新選擇放置位置。')};
 const spot=(target,label,style={},className='')=>{const over=drag?.target&&JSON.stringify(drag.target)===JSON.stringify(target);return <button type="button" data-copybook-drop={JSON.stringify(target)} aria-label={label} disabled={disabled||!moving} className={'copybook-drop '+className+(over?(drag.error?' is-invalid':' is-over'):'')} style={style} onClick={()=>place(target)}><span>{over&&drag.error?'放不下':className.includes('drop-before')?'放在前面':label}</span></button>};
 const openPicker=(event,destination=null)=>{pickerOpener.current=event.currentTarget;reset();setPicked('');setNotice('');setPicker(destination||{});setSourcePage(plan.pages.length>1?String(page===0?1:0):'all')};
 const pickWord=id=>{
  if(disabled||!picker)return;
  if(picker.target){const result=arrangeBookWord(entries,options,id,picker.target);if(result.error){setNotice(result.error);return;}if(result.unchanged)return;onArrange(result,id);setNotice('已將「'+lookup.get(id).word+'」補入'+picker.label+'。');setPicked('');}
  else choose(id);
  setPicker(null);
 };
 const candidates=picker?entries.filter(e=>!picker.exclude?.includes(e.id)&&(sourcePage==='all'||sourcePages.get(e.id)?.includes(+sourcePage))).map(e=>({entry:e,result:picker.target?arrangeBookWord(entries,options,e.id,picker.target):null})):[];
 return <div ref={root} tabIndex={-1} className="outline-none" onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={cancelPointer} onLostPointerCapture={cancelPointer} onClickCapture={event=>{if(ignoreClick.current){event.preventDefault();event.stopPropagation()}}} onKeyDown={event=>{if(event.key==='Escape'&&!picker){reset();setPicked('');setNotice('已取消移動。')}}}>
  <div className="mb-3 rounded-xl border border-blue-200 bg-blue-50 p-2 space-y-1">
   <div className="flex flex-wrap items-center gap-2"><button type="button" className="rounded-lg border-2 border-blue-700 bg-white px-3 py-2 font-bold text-blue-900" disabled={disabled} onClick={e=>openPicker(e)}><ArrowLeftRight size={18} className="inline mr-2"/>跨頁移動語詞</button>{arranging&&<label className="flex flex-wrap items-center gap-2">移動語詞<select className="min-w-0 max-w-full rounded-lg border-2 bg-white p-2" aria-label="選擇要移動的語詞" disabled={disabled} value={moving} onChange={e=>choose(e.target.value)}><option value="">選語詞或直接拖曳</option>{entries.map(e=><option key={e.id} value={e.id}>{e.word}（第 {pageLabel(e.id)} 頁・{bookCells(e,options).length} 格）</option>)}</select></label>}</div>
   {moving&&arranging&&<div className="flex flex-wrap items-center gap-2"><b className="text-blue-900">正在移動「{word.word}」</b><label>放到第 <select className="rounded-lg border-2 bg-white p-2" aria-label="移動語詞的目的頁" value={page} onChange={e=>onPageChange?.(+e.target.value)}>{plan.pages.map((_,p)=><option key={p} value={p}>{p+1}</option>)}</select> 頁，再點放置區</label><button type="button" className="rounded-lg border-2 bg-white px-3 py-2" onClick={()=>{reset();setPicked('')}}>取消移動</button></div>}
   <details className="text-sm text-blue-950"><summary className="cursor-pointer">怎麼調整版面？</summary><p className="mt-1">可直接拖曳語詞換位置；點空白處「補入語詞」，可從其他頁選詞放進來。垃圾桶會刪除該語詞的全部練習格，可在上方復原。操作按鈕不會印在學習單上。</p></details>
   <p role="status" className="text-sm text-blue-900">{drag?.error||notice||(moving?'請點藍色放置區，立即查看結果。':'')}</p>
  </div>
  <div className={'flex flex-row-reverse items-start '+(arranging?'copybook-arranging':'')}>
   {columnList.map((col,j)=>{
    const column=columnList.slice(0,j+1).filter(c=>!c.title).length,blocks=[];for(let row=0;row<col.cells.length;){const id=col.cells[row].entryId;let end=row+1;if(id)while(end<col.cells.length&&col.cells[end].entryId===id)end++;if(id)blocks.push({id,start:row,end});row=end;}
    const used=col.cells.reduce((n,c,i)=>c.entryId?i+1:n,0),rowHeight=100/plan.rows,lastWord=lookup.get(col.entryIds?.[col.entryIds.length-1])?.word;
    return <div key={j} className="relative" style={{width:`${plan.width/(plan.paper?.contentWidth||182)*100}%`,flexShrink:0}}>
     <div className="h-36 flex flex-col items-center gap-1 pb-2 text-sm text-blue-950">{!col.title&&<><b>第 {column} 欄</b><span>空 {plan.rows-used} 格</span><div className="w-full min-h-0 flex-1 space-y-1 overflow-y-auto p-1">{col.entryIds.map(id=><div key={id} className="copybook-word-tools"><button type="button" disabled={disabled} className={'copybook-word-handle '+(moving===id?'is-picked':'')} aria-label={`拖曳標籤${lookup.get(id)?.word}`} onPointerDown={e=>begin(e,id)} onClick={()=>choose(id)}><GripVertical size={14} aria-hidden="true"/><span>{lookup.get(id)?.word}</span></button><button type="button" className="copybook-word-delete" disabled={disabled} title={`刪除「${lookup.get(id)?.word}」的全部練習格`} aria-label={`從學習單刪除${lookup.get(id)?.word}`} onClick={()=>{reset();if(moving===id)setPicked('');onDelete?.(id);setNotice('已刪除「'+lookup.get(id)?.word+'」，可按上方復原。')}}><Trash2 size={16}/></button></div>)}</div></>}</div>
     <div className="relative">{col.cells.map((c,i)=>c.entryId&&!arranging?<button key={i} type="button" disabled={disabled} className={'copybook-preview-cell '+(c.entryId===active&&c.repeat===repeat&&c.charIndex===index?'is-active':'')} aria-pressed={c.entryId===active&&c.repeat===repeat&&c.charIndex===index} aria-label={`編輯${c.char}：第${c.repeat+1}次，第${c.charIndex+1}字`} onClick={()=>onEditCell(c)} dangerouslySetInnerHTML={{__html:renderCell(c)}}/>:<div key={i} dangerouslySetInnerHTML={{__html:renderCell(c)}}/>)}
      {arranging&&!col.title&&<>
       {blocks.map(block=><button key={block.id+':'+block.start} type="button" disabled={disabled} className={'copybook-word-block '+(moving===block.id?'is-picked':'')} style={{top:`${block.start*rowHeight}%`,height:`${(block.end-block.start)*rowHeight}%`}} aria-label={`移動語詞${lookup.get(block.id)?.word}，共${bookCells(lookup.get(block.id),options).length}格`} aria-pressed={moving===block.id} onPointerDown={e=>begin(e,block.id)} onClick={()=>choose(block.id)}><span className="sr-only">{lookup.get(block.id)?.word}</span></button>)}
       {moving&&<>
        {blocks.filter(block=>{const c=col.cells[block.start];return c.repeat===0&&(options.contentMode==='character'||c.charIndex===0)}).map(block=><span key={block.id}>{spot({groupIndex:col.groupIndex,groupOffset:col.groupOffset,beforeId:block.id},`放在${lookup.get(block.id)?.word}之前`,{top:`${block.start*rowHeight}%`},'copybook-drop-before')}</span>)}
        {spot({groupIndex:col.groupIndex,groupOffset:col.groupOffset},`放到第 ${column} 欄下方`,{top:`${used*rowHeight}%`,height:`${Math.max(0,plan.rows-used)*rowHeight}%`},'copybook-drop-tail')}
        {col.groupOffset===0&&spot({groupIndex:col.groupIndex,newColumn:true},'放到右邊新欄',{},'copybook-drop-new')}
       </>}
      </>}
      {!col.title&&used<plan.rows&&(!arranging||!moving)&&<button type="button" disabled={disabled} className="copybook-fill-space" style={{top:`${used*rowHeight}%`,height:`${(plan.rows-used)*rowHeight}%`}} aria-label={`在${lastWord}下方補入語詞`} onClick={e=>openPicker(e,{target:{groupIndex:col.groupIndex,groupOffset:col.groupOffset},exclude:col.entryIds,label:`第 ${page+1} 頁「${lastWord}」下方`})}><Plus size={20}/><span>補入語詞</span></button>}
     </div>
    </div>
   })}
  </div>
  {arranging&&moving&&<div className="mt-4">{spot({groupIndex:plan.groups.length,newColumn:true},'放到最後的新欄',{},'copybook-drop-last')}</div>}
  {arranging&&drag&&word&&<div className="copybook-drag-label" style={{left:drag.x+16,top:drag.y+16}}>{word.word} · {bookCells(word,options).length} 格</div>}
  <Dialog open={!!picker} onOpenChange={open=>{if(!open)setPicker(null)}}><DialogContent className="max-h-[85dvh] sm:max-w-xl" onCloseAutoFocus={event=>{event.preventDefault();if(pickerOpener.current?.isConnected)pickerOpener.current.focus();else root.current?.focus({preventScroll:true})}}>
   <DialogTitle className="pr-6 leading-relaxed">{picker?.target?'補入語詞':'跨頁移動語詞'}</DialogTitle>
   <DialogDescription>{picker?.target?`放到${picker.label}。選取後立即移動，保留原本的練習次數與逐格提示。`:'先選要移動的語詞，再選目的頁，點藍色放置區。'}</DialogDescription>
   <label className="flex items-center gap-2 font-bold">語詞所在頁<select className="rounded-lg border-2 bg-white p-2" aria-label="補入語詞來源頁" value={sourcePage} onChange={e=>setSourcePage(e.target.value)}><option value="all">全部頁面</option>{plan.pages.map((_,p)=><option key={p} value={p}>第 {p+1} 頁{p===page?'（目前頁）':''}</option>)}</select></label>
   <div className="overflow-y-auto max-h-[48dvh] grid gap-2 sm:grid-cols-2 p-1">{candidates.map(({entry:e,result})=><button key={e.id} type="button" disabled={disabled||!!result?.error||result?.unchanged} className="rounded-xl border-2 border-blue-300 bg-blue-50 p-3 text-left hover:bg-blue-100 focus-visible:outline-blue-700 disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500" aria-label={`移入${e.word}`} onClick={()=>pickWord(e.id)}><b className="block text-xl">{e.word}</b><span className="block text-sm mt-1">第 {pageLabel(e.id)} 頁・{bookCells(e,options).length} 格</span><span className={'block text-sm mt-1 '+(result?.error?'':'text-blue-800')}>{result?.error?'此處放不下整組練習':picker?.target?'點選補入此處':'選取後指定位置'}</span></button>)}{!candidates.length&&<p className="col-span-full py-5 text-slate-600">這一頁沒有可移入的語詞，請切換其他頁面。</p>}</div>
   {notice&&<p role="status" className="text-sm text-blue-900">{notice}</p>}
   <div className="flex justify-end"><button type="button" className="rounded-lg border-2 bg-white px-4 py-2 font-bold" onClick={()=>setPicker(null)}>取消</button></div>
  </DialogContent></Dialog>
 </div>;
}
