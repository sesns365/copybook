'use client';
import {useEffect,useRef,useState,type ReactNode} from 'react';
import {createTemplateFile,importTemplateSelection,parseTemplateFile,planTemplateImport,readTemplateDestination,TEMPLATE_FILE_MAX_BYTES,TEMPLATE_LIMIT,type PortableTemplate,type TemplateFile,type TemplateKind} from './template-transfer';
const button='rounded-xl border-2 bg-white px-3 py-2 font-bold text-blue-900 disabled:opacity-40';
export default function TemplateFileTransfer({kind,destination,records,disabled,onImported,renderPreview}:{kind:TemplateKind;destination:string;records:any[];disabled:boolean;onImported:()=>void;renderPreview:(record:PortableTemplate)=>ReactNode}){
 const [exportIds,setExportIds]=useState<string[]>([]),[file,setFile]=useState<TemplateFile|null>(null),[chosen,setChosen]=useState<number[]>([]),[filename,setFilename]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const input=useRef<HTMLInputElement>(null),lock=useRef(false),sequence=useRef(0);
 const recordIds=JSON.stringify(records.map(record=>record.id));
 useEffect(()=>{setExportIds(records.map(record=>record.id))},[recordIds]);
 useEffect(()=>{sequence.current++;lock.current=false;setBusy(false);setFile(null);setChosen([]);setError('');setMessage('');return()=>{sequence.current++}},[destination,kind]);
 const plan=file?planTemplateImport(records,file.templates,kind):[],selected=plan.filter((row,index)=>chosen.includes(index)&&!row.duplicate),full=records.length+selected.length>TEMPLATE_LIMIT,locked=disabled||busy;
 const exportFile=()=>{
  if(locked||lock.current)return;
  try{
   const latest=readTemplateDestination(window.localStorage,kind,destination),selectedRecords=latest.filter(record=>exportIds.includes(record.id)),backup=createTemplateFile(selectedRecords,kind),raw=JSON.stringify(backup,null,2);
   // Pretty printing also counts toward the file size accepted on import.
   if(new TextEncoder().encode(raw).length>TEMPLATE_FILE_MAX_BYTES)throw Error('範本備份最多 2 MB，請減少勾選後分批匯出。');
   const url=URL.createObjectURL(new Blob([raw],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download=`${kind==='teaching'?'教學範本':'學習單提示範本'}-${new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Taipei'})}.json`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);setError('');setMessage(`已產生 ${selectedRecords.length} 個範本的備份，請在下載項目確認。`);
  }catch(e:any){setError(e.message)}
 };
 const chooseFile=async(event:any)=>{
  const selectedFile=event.target.files?.[0];event.target.value='';if(!selectedFile||locked||lock.current)return;
  const seq=++sequence.current;lock.current=true;setBusy(true);setError('');setMessage('');
  try{if(selectedFile.size>TEMPLATE_FILE_MAX_BYTES)throw Error('範本備份最多 2 MB。');const parsed=parseTemplateFile(await selectedFile.text(),kind);if(seq!==sequence.current)return;const latest=readTemplateDestination(window.localStorage,kind,destination),next=planTemplateImport(latest,parsed.templates,kind);setFile(parsed);setFilename(selectedFile.name);setChosen(next.flatMap((row,index)=>row.duplicate?[]:[index]));onImported()}
  catch(e:any){if(seq===sequence.current)setError(e.message)}finally{if(seq===sequence.current){lock.current=false;setBusy(false)}}
 };
 const confirmImport=()=>{
  if(locked||lock.current||!file||!selected.length)return;lock.current=true;setBusy(true);setError('');setMessage('');
  try{const result=importTemplateSelection(window.localStorage,kind,destination,selected.map(row=>row.template));onImported();setFile(null);setChosen([]);setMessage(`已匯入 ${result.added} 個範本${result.skipped?`，略過 ${result.skipped} 個相同內容`:''}。${kind==='teaching'?'請再選範本、預覽差異並儲存設定，才會套用給學生。':'請再選範本、載入待套用選項，並按「套用到全部語詞」。'}`)}
  catch(e:any){onImported();setError(e.message)}finally{lock.current=false;setBusy(false)}
 };
 return <details className="rounded-xl border bg-white p-4 space-y-4"><summary className="cursor-pointer font-bold">範本備份與匯入（跨裝置使用）</summary><p className="text-sm text-slate-600">下載 JSON 後可在另一裝置匯入同一類範本。只搬移範本，不會套用或覆蓋目前設定；每類最多 40 個，備份檔最多 2 MB。不含學生名單、成績或教材語詞。</p>
  {!!records.length&&<fieldset disabled={locked} className="space-y-2"><legend className="font-bold">選擇要備份的範本</legend><label className="flex items-center gap-2"><input type="checkbox" checked={records.every(record=>exportIds.includes(record.id))} onChange={e=>setExportIds(e.target.checked?records.map(record=>record.id):[])}/>全選範本</label><div className="max-h-48 overflow-auto space-y-2">{records.map(record=><label key={record.id} className="flex items-center gap-2 break-words"><input type="checkbox" checked={exportIds.includes(record.id)} onChange={e=>setExportIds(ids=>e.target.checked?[...ids,record.id]:ids.filter(id=>id!==record.id))}/>{record.name}</label>)}</div></fieldset>}
  <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={locked||!exportIds.length} onClick={exportFile}>下載範本備份（{exportIds.length} 個）</button><input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label={kind==='teaching'?'選擇教學範本備份檔':'選擇學習單提示範本備份檔'} disabled={locked} onChange={chooseFile}/><button type="button" className={button} disabled={locked} onClick={()=>input.current?.click()}>{file?'重新選擇範本備份檔':'選擇範本備份檔'}</button></div>
  {file&&<section aria-label="範本匯入預覽" className="rounded-xl border-2 border-blue-200 p-3 space-y-3"><p className="font-bold break-all">匯入預覽：{filename}</p><p className="text-sm">相同內容自動略過；同名但內容不同會加上「匯入」建立新範本，保留原件。</p><label className="flex items-center gap-2"><input type="checkbox" disabled={locked||!plan.some(row=>!row.duplicate)} checked={!!selected.length&&plan.every((row,index)=>row.duplicate||chosen.includes(index))} onChange={e=>setChosen(e.target.checked?plan.flatMap((row,index)=>row.duplicate?[]:[index]):[])}/>選取全部可匯入範本</label><div className="max-h-80 overflow-auto space-y-3">{plan.map((row,index)=><section key={index} className="rounded-lg border p-3 space-y-2"><label className="flex items-start gap-2 break-words"><input type="checkbox" className="mt-1" disabled={locked||row.duplicate} checked={!row.duplicate&&chosen.includes(index)} onChange={e=>setChosen(ids=>e.target.checked?[...ids,index]:ids.filter(id=>id!==index))}/><span className="font-bold">{row.template.name}{row.duplicate?'（相同內容，略過）':''}</span></label><details><summary className="cursor-pointer text-sm text-blue-900">查看範本內容</summary><div className="mt-2 text-sm">{renderPreview(row.template)}</div></details></section>)}</div>{full&&<p role="alert" className="text-red-800">匯入後超過 40 個範本，請減少勾選或先刪除舊範本。</p>}<div className="flex flex-wrap gap-3"><button type="button" className={button+' border-blue-700'} disabled={locked||full||!selected.length} onClick={confirmImport}>確認匯入 {selected.length} 個範本</button><button type="button" className={button} disabled={locked} onClick={()=>{setFile(null);setChosen([]);setError('')}}>取消匯入預覽</button></div></section>}
  {busy&&<p role="status">正在讀取範本…</p>}{error&&<p role="alert" className="text-red-800">{error}</p>}{message&&<p role="status" className="text-blue-900">{message}</p>}
 </details>;
}
