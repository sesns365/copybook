import counts from './stroke-counts.json';
import {componentMapping,defaultComponentMapping} from './teaching-settings';

const mappingArray=(value:any)=>Array.isArray(value)&&value.length>0&&value.every(n=>Number.isInteger(n)&&n>=0&&n<8);
export const fixedCopybookGrouping=(options:any)=>options?.componentGroupingMode==='fixed';

// Fill only new characters. Existing snapshots belong to the worksheet even after
// the teacher changes the global grouping or adds more words to this document.
export function completeCopybookGrouping(options:any,entries:any[],teaching:any={}){
 if(!fixedCopybookGrouping(options))return options;
 const previous=options.componentGroupingSnapshot||{},snapshot={...previous};let changed=false;
 for(const char of new Set<string>(entries.flatMap(entry=>[...entry.word]))){
  if(mappingArray(previous[char]))continue;
  const count=(counts as Record<string,number>)[char];if(!count)continue;
  snapshot[char]=componentMapping(char,count,teaching);changed=true;
 }
 return changed?{...options,componentGroupingSnapshot:snapshot}:options;
}

export function setCopybookGroupingMode(options:any,entries:any[],teaching:any,mode:string){
 const {componentGroupingSnapshot,...rest}=options;
 return mode==='fixed'
  ?completeCopybookGrouping({...rest,componentGroupingMode:'fixed',componentGroupingSnapshot:{}},entries,teaching)
  :{...rest,componentGroupingMode:'follow'};
}

// Per-word, per-character and per-cell mappings are resolved by bookCells before
// this fallback. A fixed worksheet never falls through to newer global settings.
export function copybookComponentMapping(char:string,count:number,options:any,teaching:any={}){
 if(!fixedCopybookGrouping(options))return componentMapping(char,count,teaching);
 const mapping=options.componentGroupingSnapshot?.[char];
 return mappingArray(mapping)&&mapping.length===count?[...mapping]:defaultComponentMapping(char,count);
}
