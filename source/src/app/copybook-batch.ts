import {bookCells,bookCount,bookItem,bookStoredItem} from './copybook-export';

type PartStyle = 'black'|'gray'|'red'|'blank';
export type BookBatchRule = {
 mode:'trace'|'gray'|'parts'|'blank'|'model';
 firstStyle?:PartStyle;
 otherStyle?:PartStyle;
};

const modes=new Set(['trace','gray','parts','blank','model']);
const partStyles=new Set(['black','gray','red','blank']);

// Repetition numbers are zero-based. Each entry keeps its own target character,
// repetition count, custom grouping, annotations and non-target cell settings.
export function applyBookBatch(entries:any[],options:Record<string,any>,rules:Record<string,BookBatchRule>){
 const selected=Object.entries(rules||{}).filter(([key,rule])=>
  /^(0|[1-9]\d*)$/.test(key)&&Number.isSafeInteger(Number(key))&&rule&&modes.has(rule.mode)&&
  (rule.mode!=='parts'||((rule.firstStyle===undefined||partStyles.has(rule.firstStyle))&&(rule.otherStyle===undefined||partStyles.has(rule.otherStyle))))
 );
 let nextOptions=options,changedCells=0,changedEntries=0;
 const seen=new Set();
 for(const entry of entries){
  if(seen.has(entry.id))continue;
  seen.add(entry.id);
  const cfg=bookItem(entry,options),times=bookCount(entry,options);
  if(!Number.isInteger(cfg.targetIdx)||cfg.targetIdx<0||cfg.targetIdx>=entry.word.length)continue;
  const targets=new Map(bookCells(entry,options).filter(cell=>cell.charIndex===cfg.targetIdx).map(cell=>[cell.repeat,cell]));
  const stored=bookStoredItem(entry,options);
  let nextItem=stored,entryChanged=false;
  for(const [key,rule] of selected){
   const repeat=Number(key);
   if(repeat>=times)continue;
   const cell=targets.get(repeat);
   if(!cell)continue;
   const styles=rule.mode==='parts'?Object.fromEntries(Array.from({length:8},(_,group)=>[group,group===0?(rule.firstStyle??'black'):(rule.otherStyle??'gray')])):undefined;
   const sameStyles=!styles||Object.entries(styles).every(([group,style])=>
    (partStyles.has(cell.styles?.[group])?cell.styles[group]:(group==='0'?'black':'blank'))===style
   );
   if(cell.mode===rule.mode&&sameStyles)continue;
   const cellKey=`${repeat}:${cfg.targetIdx}`;
   nextItem={...nextItem,cells:{...nextItem.cells,[cellKey]:{...nextItem.cells?.[cellKey],mode:rule.mode,...(styles?{styles}:{})}}};
   changedCells++;entryChanged=true;
  }
  if(entryChanged){
   nextOptions={...nextOptions,items:{...nextOptions.items,[entry.id]:nextItem}};
   changedEntries++;
  }
 }
 return {options:nextOptions,changedCells,changedEntries};
}
