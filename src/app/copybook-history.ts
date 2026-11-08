import {useReducer} from 'react';

type WorksheetDocument = {selected: string[]; options: Record<string, any>};
type History = {past: WorksheetDocument[]; present: WorksheetDocument; future: WorksheetDocument[]};
type Action =
 | {type:'edit'; change:(document:WorksheetDocument)=>WorksheetDocument}
 | {type:'reset'; document:WorksheetDocument}
 | {type:'undo'|'redo'};

export const HISTORY_LIMIT = 40;
export const initialBookHistory = (document:WorksheetDocument):History => ({past:[],present:document,future:[]});

export function bookHistoryReducer(history:History, action:Action):History {
 if(action.type==='reset')return initialBookHistory(action.document);
 if(action.type==='undo'){
  if(!history.past.length)return history;
  return {past:history.past.slice(0,-1),present:history.past[history.past.length-1],future:[history.present,...history.future]};
 }
 if(action.type==='redo'){
  if(!history.future.length)return history;
  return {past:[...history.past,history.present].slice(-HISTORY_LIMIT),present:history.future[0],future:history.future.slice(1)};
 }
 if(action.type!=='edit')return history;
 const next=action.change(history.present);
 if(next===history.present||JSON.stringify(next)===JSON.stringify(history.present))return history;
 return {past:[...history.past,history.present].slice(-HISTORY_LIMIT),present:next,future:[]};
}

export function useCopybookHistory(initial:WorksheetDocument){
 const [history,dispatch]=useReducer(bookHistoryReducer,initial,initialBookHistory);
 const changeDocument=(change:(document:WorksheetDocument)=>WorksheetDocument)=>dispatch({type:'edit',change});
 const setOptions=(value:any)=>changeDocument(v=>({...v,options:typeof value==='function'?value(v.options):value}));
 const setSelected=(value:any)=>changeDocument(v=>({...v,selected:typeof value==='function'?value(v.selected):value}));
 return {...history.present,setOptions,setSelected,changeDocument,
  canUndo:!!history.past.length,canRedo:!!history.future.length,
  undo:()=>dispatch({type:'undo'}),redo:()=>dispatch({type:'redo'}),
  resetDocument:(document:WorksheetDocument)=>dispatch({type:'reset',document})};
}
