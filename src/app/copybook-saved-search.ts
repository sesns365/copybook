const normalize=(value:any)=>String(value??'').normalize('NFKC').toLocaleLowerCase('zh-TW');
export function savedCopybookSummary(row:any,source:any=[]){
 let config:any=null;try{config=typeof row.config==='string'?JSON.parse(row.config):row.config}catch{}
 const selected=Array.isArray(config?.selected)?[...new Set(config.selected)]:null,modern=config?.layout==='copybook';
 const sourceWords=source instanceof Map?source:new Map((Array.isArray(source)?source:[]).map((entry:any)=>[entry.id,entry.word]));
 const snapshots=new Map((Array.isArray(config?.entrySnapshots)?config.entrySnapshots:[]).filter((entry:any)=>entry&&typeof entry.id==='string'&&typeof entry.word==='string'&&entry.word.length).map((entry:any)=>[entry.id,entry.word]));
 // Resolve each selected entry once: historical vocabulary must never be replaced
 // or broadened by a subsequently renamed source entry. This only builds a search index.
 const words=modern?(selected||[]).map((id:any)=>snapshots.get(id)||config?.options?.items?.[id]?.word||sourceWords.get(id)||''):selected||[];
 const date=new Date(row.updated),updatedLabel=Number.isFinite(date.getTime())?date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'日期不明';
 const countLabel=selected?`${selected.length} ${modern?'個語詞':'個字（早期設定）'}`:'內容待確認';
 return {...row,updatedLabel,countLabel,label:`${row.title} · ${updatedLabel} · ${countLabel}`,searchText:normalize([row.title,...words].join(' '))};
}
export function filterSavedCopybooks(rows:any[],query:string){
 const terms=normalize(query).trim().split(/\s+/).filter(Boolean);
 return terms.length?rows.filter(row=>terms.every(term=>row.searchText.includes(term))):rows;
}
