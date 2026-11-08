"use client";
import React,{useMemo,useState} from 'react';
import {bookCells,bookCount} from './copybook-export';
import CopybookPromptTemplates from './CopybookPromptTemplates';

export const COPYBOOK_MODES:Record<string,string>={blank:'空白書寫',trace:'整字描紅',gray:'整字描灰',parts:'部分部件提示',model:'完整黑字'};
const styles={black:'黑字提示',gray:'淡灰描寫',red:'淡紅描紅',blank:'留白'};
const button='border-2 rounded-xl px-4 py-2 bg-white font-bold disabled:opacity-40';
const input='border-2 rounded-lg p-2 bg-white max-w-full';
type Rule={mode:string;firstStyle?:string;otherStyle?:string;[key:string]:string|undefined};

export default function CopybookBatchSettings({entries,options,disabled,onApply,rules:providedRules,onRulesChange,classroomId,userId}:{classroomId?:any;userId?:any;entries:any[];options:any;disabled:boolean;onApply:(rules:Record<string,Rule>)=>void;rules?:Record<string,Rule>;onRulesChange?:(value:any)=>void}){
 const [localRules,setLocalRules]=useState<Record<string,Rule>>({});
 const rules=providedRules??localRules,setRules=onRulesChange??setLocalRules;
 const rows=useMemo(()=>{
  const times=Math.max(0,...entries.map(e=>bookCount(e,options)),...Object.keys(rules).filter(key=>rules[key]?.mode).map(key=>Math.min(20,Number(key)+1)));
  const targets=entries.flatMap(e=>bookCells(e,options).filter(c=>c.target));
  return Array.from({length:times},(_,repeat)=>{
   const cells=targets.filter(c=>c.repeat===repeat),modes=[...new Set<string>(cells.map(c=>c.mode))];
   return {repeat,count:cells.length,current:modes.length===1?COPYBOOK_MODES[modes[0]]||'個別設定':'混合提示'};
  });
 },[entries,options,rules]);
 const pending=Object.fromEntries(rows.filter(r=>rules[r.repeat]?.mode).map(r=>[r.repeat,rules[r.repeat]]));
 const affected=rows.filter(r=>pending[r.repeat]).reduce((sum,r)=>sum+r.count,0);
 const change=(repeat:number,patch:Partial<Rule>)=>setRules(v=>({...v,[repeat]:{firstStyle:'black',otherStyle:'gray',...(v[repeat]||{mode:''}),...patch}}));
 const setAll=(mode:string)=>setRules(Object.fromEntries(rows.map(r=>[r.repeat,{mode,firstStyle:'black',otherStyle:'gray'}])));
 const apply=()=>{if(disabled||!affected)return;onApply(pending);setRules({})};
 return <section aria-labelledby="copybook-batch-heading" className="space-y-4">
  <h3 id="copybook-batch-heading" className="text-xl font-bold">批次設定生字</h3>
  <p>先設定每一次的提示，再套用到目前學習單的全部 <strong>{entries.length}</strong> 個語詞。</p>
  <p className="text-sm text-slate-600">「第 1 次、第 2 次」是每個語詞重複練習的次數，包含示範字；只調整各語詞選定的生字。</p>
  <CopybookPromptTemplates classroomId={classroomId} userId={userId} rules={rules} onRulesChange={setRules} disabled={disabled}/>
  {!entries.length?<p className="rounded-xl bg-slate-100 p-4">請先到「語詞與版面」加入語詞。</p>:<>
   <fieldset disabled={disabled} className="space-y-4">
    <legend className="sr-only">各次生字提示</legend>
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-blue-50 p-3">
     <label className="flex flex-wrap items-center gap-2 font-bold">快速填入全部次數
      <select aria-label="快速填入全部次數" className={input+' font-normal'} value="" onChange={e=>{if(e.target.value)setAll(e.target.value)}}>
       <option value="">選擇提示方式</option>
       {Object.entries(COPYBOOK_MODES).map(([value,label])=><option value={value} key={value}>{label}</option>)}
      </select>
     </label>
     <button type="button" className={button} disabled={!Object.values(rules).some(rule=>rule.mode)} onClick={()=>setRules({})}>清空待套用設定</button>
     <p className="basis-full text-sm">一次把每一次都設成同一種提示；也可以在下方各次分別選擇，最後按最下方的「套用」。</p>
    </div>
    <div className="space-y-3">
     {rows.map(({repeat,count,current})=><div key={repeat} className="rounded-xl border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
       <div><label htmlFor={`copybook-batch-${repeat}`} className="font-bold">第 {repeat+1} 次生字</label><p className="text-sm text-slate-600">{count?`${count} 個語詞・目前：${current}`:'目前沒有語詞練習到這一次，選項仍保留'}</p></div>
       <select id={`copybook-batch-${repeat}`} aria-label={`第 ${repeat+1} 次生字提示`} className={input} value={rules[repeat]?.mode||''} onChange={e=>change(repeat,{mode:e.target.value})}>
        <option value="">不變更</option>
        {Object.entries(COPYBOOK_MODES).map(([value,label])=><option key={value} value={value}>{label}</option>)}
       </select>
      </div>
      {rules[repeat]?.mode==='parts'&&<div className="bg-slate-50 rounded-lg p-3 space-y-2">
       <div className="flex flex-wrap gap-3">{[['firstStyle','部件 1'],['otherStyle','其餘部件']].map(([key,label])=><label className="flex flex-wrap items-center gap-2" key={key}>{label}<select aria-label={`第 ${repeat+1} 次${label}樣式`} className={input} value={rules[repeat]?.[key]||(key==='firstStyle'?'black':'gray')} onChange={e=>change(repeat,{[key]:e.target.value})}>{Object.entries(styles).map(([value,name])=><option value={value} key={value}>{name}</option>)}</select></label>)}</div>
       <p className="text-sm text-slate-600">依每個字原有的部件分組套用。可設部件 1 黑字、其餘描灰或留白；個別部件仍可到「逐字逐格」細調。</p>
      </div>}
     </div>)}
    </div>
   </fieldset>
   <div className="space-y-3 rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
    <p className="text-sm" role="status">{affected?`待套用：${Object.keys(pending).length} 個次數，共 ${affected} 個生字格。`:'選擇上方提示方式後，按下方按鈕套用。'}</p>
    <button type="button" className={button+' border-blue-700 text-blue-900 w-full'} disabled={disabled||!affected} onClick={apply}>套用到全部 {entries.length} 個語詞</button>
    <p className="text-sm text-slate-600">會取代指定次數的生字提示，包含原先的示範字、留白或個別提示；注音、其他字及排版保留。次數不足的語詞會略過，可按「復原」一次還原。</p>
   </div>
  </>}
 </section>;
}
