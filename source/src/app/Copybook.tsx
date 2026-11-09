// @ts-nocheck
"use client";
import {useCurriculum,useLessonTitle} from './CurriculumTitle';
import {loadStrokeData,MISSING_STROKES} from './stroke-data';
import React,{useEffect,useState,useMemo,useRef} from 'react';
import {Eye,SlidersHorizontal,Save,Download,Undo2,Redo2,Copy,LocateFixed,Trash2,Printer} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import baseLessons,{DEFAULT_BOOK,CUSTOM_BOOK,getBook as baseGetBook} from './curriculum-source';
import CurriculumPicker from './CurriculumPicker';
import {teachingCurriculum} from './curriculum-settings';
import {Character} from './Worksheets';
import {PALETTE} from './parts-geometry';
import {completeCopybookGrouping,copybookComponentMapping,fixedCopybookGrouping,setCopybookGroupingMode} from './copybook-grouping';
import {savedCopybookSummary,filterSavedCopybooks} from './copybook-saved-search';
import {BOOK_DEFAULTS,orderedBookEntries,bookItem,bookStoredItem,bookCount,bookCells,bookColumns,bookCellLocation,cellSVG,headerSVG,bookPageSVG,bookDOCX,svgPNG,downloadBlob} from './copybook-export';
import CopybookLayout from './CopybookLayout';
import CopybookWordRepetitions from './CopybookWordRepetitions';
import CopybookBatchSettings,{COPYBOOK_MODES} from './CopybookBatchSettings';
import {applyBookBatch} from './copybook-batch';
import {automaticCopybookTitle} from './copybook-title';
import {reuseCopybookSettings} from './copybook-reuse';
import {captureCopybookContent,mergeCopybookEntries,restoreCopybookContent} from './copybook-preservation';
import CopybookPreviewGrid from './CopybookPreviewGrid';
import {useCopybookHistory} from './copybook-history';
import {imagePDF} from './worksheet-pdf';
import {printPages} from './copybook-output';
import {copybookCrossOpacity,CELL_SIZES} from './copybook-paper';
import {copybookLocalScope,readCopybookDrafts,writeCopybookDraft,discardCopybookDraft,createAssessmentCopybookSeed,captureCopybookSaveRequest} from './copybook-local';
const keys=baseGetBook(DEFAULT_BOOK).lessons,button='border-2 rounded-xl px-4 py-2 bg-white font-bold disabled:opacity-40',input='border-2 rounded-lg p-2',modes=COPYBOOK_MODES;
export default function Copybook({seed,api,teachingSettings,onDirty,onNavigationLock,classroomId,userId,initialDraft,onInitialDraftConsumed,students=[],studentGroups=[]}){
 const {getBook:sourceBook,getLessonMeta:sourceLesson,books}=useCurriculum();
 const sourceLessons=useMemo(()=>teachingCurriculum(teachingSettings?.entryOverrides,teachingSettings?.customEntries,true,teachingSettings?.customLessons),[teachingSettings?.entryOverrides,teachingSettings?.customEntries,teachingSettings?.customLessons]),sourceAll=useMemo(()=>Object.values(sourceLessons).flat(),[sourceLessons]);
 const [preserved,setPreserved]=useState({snapshots:[],lessonSnapshots:{},bookSnapshots:{}}),[missingSource,setMissingSource]=useState([]);
 const all=useMemo(()=>mergeCopybookEntries(sourceAll,preserved.snapshots),[sourceAll,preserved]),lessons=useMemo(()=>all.reduce((groups,e)=>{(groups[e.lesson]??=[]).push(e);return groups},{}),[all]);
 const getLessonMeta=id=>preserved.lessonSnapshots[id]||sourceLesson(id),getBook=id=>preserved.bookSnapshots[id]||sourceBook(id);
 const lessonTitle=id=>getLessonMeta(id)?.title||id;
 const [savedVersion,setSavedVersion]=useState(0),[conflict,setConflict]=useState(null),[batchRules,setBatchRules]=useState({}),[legacySource,setLegacySource]=useState(null),[copyPending,setCopyPending]=useState(false),[copyStorageBlocked,setCopyStorageBlocked]=useState(false),[copyUnprotected,setCopyUnprotected]=useState(false),[savePending,setSavePending]=useState(false),[saveStorageBlocked,setSaveStorageBlocked]=useState(false),[saveUnprotected,setSaveUnprotected]=useState(false);
 const batchPending=Object.values(batchRules).some(rule=>rule?.mode);
 const [lesson,setLesson]=useState(keys[0]),[active,setActive]=useState(all[0].id),[data,setData]=useState({}),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState([]),[savedId,setSavedId]=useState(''),[group,setGroup]=useState(0),[charIndex,setCharIndex]=useState(all[0].targetIdx),[round,setRound]=useState(0),[scope,setScope]=useState('cell'),[pickCount,setPickCount]=useState(6);
 const {selected,options:storedOptions,changeDocument:changeHistoryDocument,resetDocument,canUndo,canRedo,undo,redo}=useCopybookHistory({selected:[],options:{...BOOK_DEFAULTS}});
 const changeDocument=change=>changeHistoryDocument(previous=>{const next=change(previous),nextOptions=completeCopybookGrouping(next.options,orderedBookEntries(all,next.selected),teachingSettings);return nextOptions===next.options?next:{...next,options:nextOptions}});
 const setSelected=value=>changeDocument(previous=>({...previous,selected:typeof value==='function'?value(previous.selected):value}));
 const setOptions=value=>changeDocument(previous=>({...previous,options:typeof value==='function'?value(previous.options):value}));
 const automaticTitle=automaticCopybookTitle(orderedBookEntries(all,selected),lesson,getLessonMeta,getBook);
 const options=useMemo(()=>storedOptions.titleCustom?storedOptions:{...storedOptions,title:automaticTitle},[storedOptions,automaticTitle]);
 const documentKey=JSON.stringify({selected,options}),[savedDocumentKey,setSavedDocumentKey]=useState(documentKey),documentDirty=documentKey!==savedDocumentKey,hasUnsaved=documentDirty||batchPending||copyPending||savePending;
 const selectedSavedId=savedId||legacySource?.id||'';
 const sourceWords=useMemo(()=>new Map(sourceAll.map(entry=>[entry.id,entry.word])),[sourceAll]);
 const [savedSearch,setSavedSearch]=useState(''),savedSummaries=useMemo(()=>saved.map(row=>savedCopybookSummary(row,sourceWords)),[saved,sourceWords]),matchingSaved=useMemo(()=>filterSavedCopybooks(savedSummaries,savedSearch),[savedSummaries,savedSearch]),currentSaved=savedSummaries.find(row=>row.id===selectedSavedId),currentOutsideSearch=!!currentSaved&&!matchingSaved.some(row=>row.id===selectedSavedId);
 const loadDocument=document=>{resetDocument(document);setSavedDocumentKey(JSON.stringify(document))};
 useEffect(()=>{onDirty?.(hasUnsaved)},[hasUnsaved,onDirty]);
 useEffect(()=>{const warn=e=>{if(hasUnsaved||operation.current&&operationReason.current){e.preventDefault();e.returnValue=''}};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[hasUnsaved]);
 const [previewMode,setPreviewMode]=useState('arrange'),[editorTab,setEditorTab]=useState('setup'),[mobileView,setMobileView]=useState('editor'),[previewPage,setPreviewPage]=useState(0),[previewZoom,setPreviewZoom]=useState(100),[editRequest,setEditRequest]=useState(0);
 const editorBody=useRef(null),editorHeading=useRef(null),previewBody=useRef(null),focusEditor=useRef(false),focusPreview=useRef(false);
 const operation=useRef(false),draftId=useRef(''),copyId=useRef(''),copyRequest=useRef(null),saveRequest=useRef(null),copyOpener=useRef(null),deleteOpener=useRef(null),deletedIds=useRef(new Set());
 const navigationLockCallback=useRef(onNavigationLock),operationReason=useRef(''),mounted=useRef(true);navigationLockCallback.current=onNavigationLock;
 const markOperation=reason=>{operation.current=!!reason;operationReason.current=reason;setBusy(!!reason);if(mounted.current)navigationLockCallback.current?.(reason)};
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(operationReason.current)navigationLockCallback.current?.('')}},[]);
 const savedRead=useRef(0),savedReadPending=useRef(false),savedRevision=useRef(0),savedRowRevisions=useRef(new Map());
 const [savedLoading,setSavedLoading]=useState(true),[savedListError,setSavedListError]=useState(''),[savedListNotice,setSavedListNotice]=useState('');
 const [copyOpen,setCopyOpen]=useState(false),[copyTitle,setCopyTitle]=useState(''),[copyError,setCopyError]=useState(''),[locateRequest,setLocateRequest]=useState(0);
 const [batchOutputOpen,setBatchOutputOpen]=useState(false);
 const [deleteTarget,setDeleteTarget]=useState(null),[deleteError,setDeleteError]=useState('');
 const localScope=copybookLocalScope(classroomId,userId),localDraftId=useRef(''),localPayload=useRef(null),recoveredDrafts=useRef([]),localScopeRef=useRef(localScope),seedHandled=useRef(''),simpleSeed=useRef(0);
 const [recoverableDrafts,setRecoverableDrafts]=useState([]),[draftNotice,setDraftNotice]=useState(''),[draftStorageError,setDraftStorageError]=useState('');
 const refreshLocalDrafts=()=>{if(!localScope)return;try{setRecoverableDrafts(readCopybookDrafts(window.localStorage,localScope,localDraftId.current).filter(draft=>!recoveredDrafts.current.some(recovered=>recovered.storageKey===draft.storageKey&&recovered.raw===draft.raw)))}catch{setDraftStorageError('此瀏覽器無法讀取本機草稿，請使用「儲存學習單設定」保存。')}};
 const persistLocalDraft=()=>{if(!localScope||!localPayload.current)return true;try{writeCopybookDraft(window.localStorage,localScope,localPayload.current);setDraftStorageError('');setDraftNotice('未儲存修改已暫存於此瀏覽器。');return true}catch{setDraftStorageError('本機草稿暫存失敗，可能是內容過大或瀏覽器儲存空間不足；請刪除不需要的本機草稿，或先下載保留目前內容。');return false}};
 const uncertainRequests=()=>[...(saveRequest.current?.dispatched?[`學習單「${saveRequest.current.payload.title}」的儲存`]:[]),...(copyRequest.current?.dispatched?[`副本「${copyRequest.current.payload.title}」`]:[])];
 const detachLocalDraft=({allowDiscard=false}={})=>{
  const uncertain=uncertainRequests(),persisted=localScope?persistLocalDraft():!uncertain.length;
  if(!persisted){
   if(!allowDiscard)return false;
   if(uncertain.length){setStatus(`${uncertain.join('、')}的結果尚未確認，而且目前無法保留本機重試資料。請先按${saveRequest.current?.dispatched?'「確認上次儲存」':''}${saveRequest.current?.dispatched&&copyRequest.current?'及':''}${copyRequest.current?'「確認上一份副本」':''}完成確認，再切換學習單。目前內容與原請求仍保留。`);return false;}
   // The teacher explicitly chose to discard these edits. A storage failure must not
   // force a server save, but an uncertain dispatched request must never be discarded here.
   try{if(localScope){window.localStorage.removeItem(localScope+'draft:'+localDraftId.current);for(const draft of recoveredDrafts.current)discardCopybookDraft(window.localStorage,draft)}setDraftStorageError('');setDraftNotice('已依確認放棄目前修改，未另外建立本機草稿。')}
   catch{setDraftStorageError('已依確認放棄目前修改，但此瀏覽器無法清除舊的本機草稿；稍後仍可能出現在草稿清單。')}
  }
  localDraftId.current=crypto.randomUUID();localPayload.current=null;recoveredDrafts.current=[];refreshLocalDrafts();return true;
 };
 const entries=orderedBookEntries(all,selected),entry=all.find(e=>e.id===active)||all[0],cfg=bookItem(entry,options),times=bookCount(entry,options),cells=bookCells(entry,options),index=options.contentMode==='character'?cfg.targetIdx:Math.min(charIndex,entry.word.length-1),repeat=Math.min(round,times-1),cell=cells.find(c=>c.charIndex===index&&c.repeat===repeat)||cells[0],target=cell.char,mapping=data[target]?(cell.mapping?.length===data[target].strokes.length?cell.mapping:copybookComponentMapping(target,data[target].strokes.length,options,teachingSettings)):[],groups=[...new Set(mapping)].sort((a,b)=>a-b),plan=bookColumns(entries,options),groupingFixed=fixedCopybookGrouping(options);
 const captureLocalDraft=()=>({version:1,id:localDraftId.current,updatedAt:Date.now(),savedId,savedVersion,savedDocumentKey,legacySource,draftId:draftId.current,config:{layout:'copybook',lesson,selected,options,...captureCopybookContent(entries,getLessonMeta,getBook)},batchRules,copyRequest:copyRequest.current,saveRequest:saveRequest.current,editor:{active,charIndex,round,scope,editorTab,previewMode,mobileView,previewPage,previewZoom}});
 const location=bookCellLocation(plan,active,repeat,index),shownPage=Math.max(0,Math.min(previewPage,plan.pages.length-1)),activePage=location?.page??-1,locationLabel=location?`第 ${location.page+1} 頁・由右起第 ${location.column} 欄・第 ${location.row} 格`:'此語詞尚未加入學習單';
 useEffect(()=>{if(activePage>=0)setPreviewPage(activePage)},[active,repeat,index,activePage]);
 useEffect(()=>{setPreviewPage(p=>Math.max(0,Math.min(p,plan.pages.length-1)))},[plan.pages.length]);
 useEffect(()=>{if(previewBody.current)previewBody.current.scrollTop=0},[shownPage]);
 useEffect(()=>{if(focusEditor.current){editorToTop();editorHeading.current?.focus({preventScroll:true});focusEditor.current=false}},[active,repeat,index,editorTab,mobileView,editRequest]);
 useEffect(()=>{
  if(!focusPreview.current||previewMode!=='cells')return;
  const pane=previewBody.current,el=pane?.querySelector('.copybook-preview-cell.is-active');
  if(!el)return;
  const bounds=pane.getBoundingClientRect(),rect=el.getBoundingClientRect();
  pane.scrollTo({top:Math.max(0,pane.scrollTop+rect.top-bounds.top-(pane.clientHeight-rect.height)/2),left:Math.max(0,pane.scrollLeft+rect.left-bounds.left-(pane.clientWidth-rect.width)/2),behavior:'auto'});
  el.focus({preventScroll:true});focusPreview.current=false;
 },[locateRequest,shownPage,previewMode,mobileView]);
 const locateCell=()=>{if(!location)return;focusPreview.current=true;setPreviewMode('cells');setPreviewPage(location.page);setMobileView('preview');setLocateRequest(n=>n+1)};
 const editPreviewCell=c=>{const e=all.find(e=>e.id===c.entryId);if(!e)return;focusEditor.current=true;setEditRequest(n=>n+1);setLesson(e.lesson);setActive(e.id);setCharIndex(c.charIndex);setRound(c.repeat);setScope('cell');setEditorTab('cells');setMobileView('editor')};
 const editSelectedEntry=id=>{if(operation.current)return;const e=entries.find(e=>e.id===id);if(!e)return;const nextCell=active===id?cell:bookCells(e,options).find(c=>c.target&&c.repeat===0);if(nextCell)editPreviewCell(nextCell)};
 // 換分頁回到設定區頂端：小螢幕捲內框，大螢幕（整頁捲動）把設定區頂端捲回畫面內。
 const editorToTop=()=>{const body=editorBody.current;body?.scrollTo?.({top:0});const panel=body?.closest?.('.copybook-editor');if(panel&&panel.getBoundingClientRect().top<0)panel.scrollIntoView({block:'start'})};
 const switchEditor=tab=>{setEditorTab(tab);editorToTop()};
 const requireAppliedBatch=()=>{if(!batchPending)return true;setEditorTab('batch');setMobileView('editor');setStatus('還有批次提示尚未套用，請先套用或清空待套用設定。');return false};
 const update=(key,value)=>{if(key==='repetitions'&&!requireAppliedBatch())return;setOptions(v=>({...v,[key]:value}));setStatus('設定已調整，請儲存學習單設定。')};
 const openLayout=()=>{setPreviewMode('arrange');setMobileView('preview');previewBody.current?.scrollTo({top:0})};
 const applyArrangement=(result,id)=>{changeDocument(()=>({options:result.options,selected:result.selected}));const moved=all.find(e=>e.id===id);if(moved)chooseEntry(moved);setStatus('語詞位置已更新，請儲存學習單設定。')};
 const moveWord=(id,dir)=>{if(busy)return;const order=entries.map(e=>e.id),from=order.indexOf(id),to=from+dir;if(from<0||to<0||to>=order.length)return;[order[from],order[to]]=[order[to],order[from]];const manual=Array.isArray(options.manualColumns);changeDocument(v=>{const next={...v.options};delete next.manualColumns;return {selected:order,options:next}});const w=all.find(e=>e.id===id)?.word||'';setStatus(`已把「${w}」${dir<0?'往前':'往後'}移${manual?'，並改回自動排版':''}，可按復原。`)};
 const deleteWord=id=>{const removed=all.find(e=>e.id===id);changeDocument(v=>({selected:v.selected.filter(x=>x!==id),options:{...v.options,...(Array.isArray(v.options.manualColumns)?{manualColumns:v.options.manualColumns.map(g=>g.filter(x=>x!==id)).filter(g=>g.length)}:{})}}));setStatus(`已從學習單刪除「${removed?.word||''}」，可按復原。`)};
 const restore=direction=>{if(busy)return;if(direction==='undo'&&canUndo){undo();setStatus('已復原上一步，請儲存學習單設定。')}if(direction==='redo'&&canRedo){redo();setStatus('已重作，請儲存學習單設定。')}};
 const autoArrange=count=>{setOptions(v=>{const next={...v,wordsPerColumn:count,items:Object.fromEntries(Object.entries(v.items||{}).map(([id,item])=>[id,{...item,newColumn:false}]))};delete next.manualColumns;return next});openLayout();setStatus('已套用自動排版，可在預覽中繼續拖曳調整。')};
 const applyBatch=rules=>{if(busy)return;const result=applyBookBatch(entries,options,rules);if(!result.changedCells){setStatus('所選生字格已是這些提示，無需變更。');return}setOptions(result.options);setStatus(`已批次更新 ${result.changedEntries} 個語詞、${result.changedCells} 個生字格，可按復原；請儲存學習單設定。`)};
 const updateWordRepetitions=(id,value)=>{if(busy||!requireAppliedBatch())return;const word=all.find(e=>e.id===id);if(!word)return;const count=value===''?undefined:Number(value);if(count!==undefined&&(!Number.isInteger(count)||count<1||count>20))return;setOptions(v=>{const item={...bookStoredItem(word,v)};if(count===undefined)delete item.repetitions;else item.repetitions=count;return {...v,items:{...v.items,[id]:item}}});setStatus(`「${word.word}」${count===undefined?'已改為沿用整張預設次數':`已設為練習 ${count} 次（含示範字）`}，請儲存學習單設定。`)};
 const updateItem=(change)=>setOptions(v=>({...v,items:{...v.items,[entry.id]:{...bookStoredItem(entry,v),...change}}}));
 const updateDetail=change=>setOptions(v=>{const item=bookStoredItem(entry,v),next={...item};if(scope==='character'){next.characters={...item.characters,[index]:{...item.characters?.[index],...change}};next.cells=Object.fromEntries(Object.entries(item.cells||{}).map(([k,c])=>[k,k.endsWith(':'+index)?Object.fromEntries(Object.entries(c).filter(([field])=>!(field in change))):c]));}else next.cells={...item.cells,[cell.key]:{...item.cells?.[cell.key],...change}};return {...v,items:{...v.items,[entry.id]:next}}});
 const resetDetail=()=>setOptions(v=>{const item=bookStoredItem(entry,v),next={...item,cells:{...item.cells},characters:{...item.characters}};if(scope==='character'){delete next.characters[index];for(const key of Object.keys(next.cells))if(key.endsWith(':'+index))delete next.cells[key]}else delete next.cells[cell.key];return {...v,items:{...v.items,[entry.id]:next}}});
 const chooseEntry=e=>{if(!e)return;setActive(e.id);setCharIndex(e.targetIdx);setRound(0);setScope('cell')};
 const applySettingsToLesson=()=>{
  if(busy||operation.current||!requireAppliedBatch())return;
  if(savePending||copyPending){setStatus('請先確認上次儲存或複製結果，再套用到其他課次。');return;}
  const targets=sourceAll.filter(e=>e.lesson===lesson);
  if(!targets.length){setStatus('此課次沒有可用語詞，請選擇其他課次。');return;}
  if(!window.confirm('套用後會使用所選課次的語詞，建立新的學習單；原有已存設定不會改變。繼續嗎？'))return;
  if(hasUnsaved&&!detachLocalDraft())return;
  setPreserved({snapshots:[],lessonSnapshots:{},bookSnapshots:{}});setMissingSource([]);setBatchRules({});setConflict(null);setLegacySource(null);setSavedId('');setSavedVersion(0);draftId.current='';
  resetDocument({selected:targets.map(e=>e.id),options:reuseCopybookSettings(options)});setSavedDocumentKey('');chooseEntry(targets[0]);
  setStatus('已套用預設設定至此課次。請確認內容後儲存為新學習單。');
 };
 const refreshSavedList=async()=>{
  if(savedReadPending.current)return;
  const request=++savedRead.current,revision=savedRevision.current;savedReadPending.current=true;setSavedLoading(true);setSavedListError('');setSavedListNotice('');
  try{
   const r=await api({action:'worksheets'});if(request!==savedRead.current)return;
   setSaved(current=>{
    const rows=new Map(r.rows.filter(row=>!deletedIds.current.has(row.id)).map(row=>[row.id,row]));
    for(const row of current){
     if(deletedIds.current.has(row.id))continue;
     const fetched=rows.get(row.id);
     // A read can finish after a save/copy/delete. Keep newer local acknowledgements
     // while allowing an explicit new read to remove remotely deleted settings.
     if(fetched?(row.version??1)>(fetched.version??1):(savedRowRevisions.current.get(row.id)||0)>revision)rows.set(row.id,row);
    }
    return [...rows.values()].sort((a,b)=>String(b.updated||'').localeCompare(String(a.updated||''))||b.id.localeCompare(a.id));
   });
   if(request>1)setSavedListNotice('已更新已存清單。目前編輯內容保留，選取其他設定後才會載入。');
  }catch(e){if(request===savedRead.current)setSavedListError('無法載入已存清單：'+e.message+'。目前編輯內容仍保留，請按「重新載入已存清單」重試。')}
  finally{if(request===savedRead.current){savedReadPending.current=false;setSavedLoading(false)}}
 };
 useEffect(()=>{refreshSavedList();return()=>{savedRead.current++;savedReadPending.current=false}},[]);
 const needed=[...new Set([...entries,entry].flatMap(e=>[...e.word]))].join('');
 const [strokeErrors,setStrokeErrors]=useState({}),[strokeRetry,setStrokeRetry]=useState(0),[loadingStrokes,setLoadingStrokes]=useState(false);
 useEffect(()=>{
  let cancelled=false;
  const missing=[...needed].filter(c=>!(c in data)&&!(c in strokeErrors));
  setLoadingStrokes(!!missing.length);
  (async()=>{
   for(let i=0;i<missing.length;i+=20){
    const batch=await Promise.all(missing.slice(i,i+20).map(async c=>{
     try{return {char:c,data:await loadStrokeData(c)}}
     catch(error){return error?.message===MISSING_STROKES?{char:c,data:null}:{char:c,error:error?.message||'字形暫時無法載入。'}}
    }));
    if(cancelled)return;
    const loaded=batch.filter(result=>!result.error),failed=batch.filter(result=>result.error);
    if(loaded.length)setData(v=>({...v,...Object.fromEntries(loaded.map(result=>[result.char,result.data]))}));
    if(failed.length)setStrokeErrors(v=>({...v,...Object.fromEntries(failed.map(result=>[result.char,result.error]))}));
   }
   if(!cancelled)setLoadingStrokes(false);
  })();
  return()=>{cancelled=true};
 },[needed,strokeRetry]);
 const failedStrokes=[...needed].filter(c=>c in strokeErrors);
 const retryStrokes=()=>{if(busy||loadingStrokes||!failedStrokes.length)return;setStrokeErrors(v=>Object.fromEntries(Object.entries(v).filter(([c])=>!failedStrokes.includes(c))));setStrokeRetry(n=>n+1)};
 const partsNeeded=[...new Set(plan.pages.flatMap(p=>p.flatMap(c=>c.cells)).filter(c=>c.char&&c.mode==='parts').map(c=>c.char))],missingParts=partsNeeded.filter(c=>data[c]===null),ready=[...needed].every(c=>c in data||c in strokeErrors)&&partsNeeded.every(c=>!!data[c]);
 // Saving keeps undo history, so its vocabulary and course labels must survive too.
 // Copies and newly loaded documents reset history and keep only their own content.
 const preserveContent=(content,keepHistory=false)=>setPreserved(previous=>({
  snapshots:keepHistory?mergeCopybookEntries(previous.snapshots,content.entrySnapshots):content.entrySnapshots,
  lessonSnapshots:keepHistory?{...previous.lessonSnapshots,...content.lessonSnapshots}:content.lessonSnapshots,
  bookSnapshots:keepHistory?{...previous.bookSnapshots,...content.bookSnapshots}:content.bookSnapshots
 }));
 const rememberSaved=(id,title,config,version,updated)=>{savedRowRevisions.current.set(id,++savedRevision.current);setSaved(rows=>[{id,title,config:JSON.stringify(config),version,updated:updated||new Date().toISOString()},...rows.filter(row=>row.id!==id)])};
 const showConflict=(error,id)=>{if(!error?.response?.conflict)return false;setConflict({id,current:error.response.current||null,message:error.message});setStatus('這份已存學習單已在其他視窗變更，目前編輯內容仍保留。');return true};
 const save=async({allowUnprotected=false}={})=>{
  if(operation.current)return;
  const creatingRequest=!saveRequest.current;
  if(creatingRequest){
   if(!entries.length||!requireAppliedBatch())return;
   if(missingSource.length){setStatus('這份舊學習單有缺漏語詞，請將現有內容另存副本，原始設定會保留。');return;}
   const id=savedId||(draftId.current||=crypto.randomUUID()),version=savedId?savedVersion:0,content=captureCopybookContent(entries,getLessonMeta,getBook),config={layout:'copybook',lesson,selected:entries.map(e=>e.id),options,...content};
   if(JSON.stringify(config).length>1800000){setStatus('學習單設定資料太大，請減少語詞或提示後再儲存。目前內容仍保留。');return;}
   saveRequest.current=captureCopybookSaveRequest({action:'saveWorksheet',id,version,title:options.title,config},documentKey,selectedSavedId);setSavePending(true);
  }
  // Persist the immutable request before dispatch. The explicit fallback keeps the same
  // request in this page, but never claims it can recover after reload or closing.
  const request=saveRequest.current,previouslyDispatched=!!request.dispatched;request.dispatched=true;
  localPayload.current=captureLocalDraft();
  const persisted=persistLocalDraft();
  if(!persisted&&!allowUnprotected){
   request.dispatched=previouslyDispatched;setSaveStorageBlocked(true);
   setStatus((previouslyDispatched?'本次重試尚未傳送；先前請求可能已完成。':'這次儲存尚未傳送。')+'此瀏覽器無法保留重試資料。可清理本機草稿後重試，或明確選擇「仍儲存（無本機恢復保護）」。目前內容仍保留。');return;
  }
  setSaveStorageBlocked(false);setSaveUnprotected(!persisted);markOperation('學習單正在儲存，請稍候確認結果後再切換。');
  const {payload}=request,{id,version,title,config}=payload;
  try{
   const r=await api(payload),nextVersion=r.version??version+1;
   rememberSaved(r.id,title,config,nextVersion,r.updated);saveRequest.current=null;setSavePending(false);setSaveUnprotected(false);
   if(selectedSavedId===request.origin.selectedSavedId){
    preserveContent(config,true);setSavedVersion(nextVersion);setLegacySource(null);setConflict(null);setSavedDocumentKey(request.documentKey);setSavedId(r.id);draftId.current=r.id;
    setStatus(documentKey===request.documentKey&&!batchPending?'語詞、注音、課次名稱、排版與提示已儲存。':'先前的儲存已確認；目前後續修改與待套用提示仍保留，請檢查後再次儲存。');
   }else setStatus(`已確認先前學習單「${title}」已儲存。目前編輯內容保留，可從已存清單核對。`);
  }catch(e){
   if(e.response?.conflict){saveRequest.current=null;setSavePending(false);setSaveUnprotected(false);showConflict(e,id);}
   else if(e.response?.canEdit){saveRequest.current=null;setSavePending(false);setSaveUnprotected(false);setStatus('這次資料未通過檢查，尚未儲存。修改仍保留，請修正後再試：'+e.message);}
   else setStatus('這次儲存結果尚未確認，可能已儲存。請按「確認上次儲存」重試同一筆；後續修改會保留：'+e.message);
  }finally{markOperation('')}
 };
 const openDelete=event=>{if(operation.current||!selectedSavedId)return;const row=saved.find(s=>s.id===selectedSavedId);if(!row)return;deleteOpener.current=event.currentTarget;setDeleteError('');setDeleteTarget({id:row.id,title:row.title,version:savedId?savedVersion:legacySource.version,legacy:!savedId&&!!legacySource})};
 const deleteWorksheet=async()=>{
  if(operation.current||!deleteTarget)return;
  markOperation('正在刪除學習單設定，請稍候確認結果後再切換。');setDeleteError('');const target={...deleteTarget};
  try{await api({action:'deleteWorksheet',id:target.id,version:target.version});deletedIds.current.add(target.id);setSaved(rows=>rows.filter(row=>row.id!==target.id));if(selectedSavedId===target.id){setSavedId('');setSavedVersion(0);setLegacySource(null);setConflict(null);draftId.current='';setSavedDocumentKey('')}setDeleteTarget(null);setStatus(`已刪除${target.legacy?'早期原始':'已存'}設定「${target.title}」。目前編輯內容仍保留，可儲存為新的學習單。`)}
  catch(e){if(showConflict(e,target.id))setDeleteTarget(null);else setDeleteError('刪除失敗，已存設定與目前編輯內容均保留：'+e.message)}
  finally{markOperation('')}
 };
 const openCopy=event=>{if(operation.current)return;copyOpener.current=event.currentTarget;if(copyRequest.current){setCopyOpen(true);return;}if(!entries.length||!requireAppliedBatch())return;copyId.current=crypto.randomUUID();setCopyTitle((options.title||'語詞生字本').slice(0,41)+'（副本）');setCopyError('');setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyOpen(true)};
 const closeCopy=()=>{if(operation.current)return;if(copyRequest.current?.dispatched&&!window.confirm('副本可能已建立，但結果尚未確認。關閉後仍可按「確認上一份副本」重試，請勿重新建立相同副本。確定先關閉嗎？'))return;setCopyOpen(false)};
 const copyWorksheet=async(event,{allowUnprotected=false}={})=>{
  event?.preventDefault();if(operation.current)return;
  if(!copyRequest.current){
   if(!copyTitle.trim()||!entries.length||!requireAppliedBatch())return;
   const title=copyTitle.trim().slice(0,45),document=JSON.parse(JSON.stringify({selected:entries.map(e=>e.id),options:{...options,title,titleCustom:true}})),content=captureCopybookContent(entries,getLessonMeta,getBook),config={layout:'copybook',lesson,...document,...content};
   if(JSON.stringify(config).length>1800000){setCopyError('學習單設定資料太大，請減少語詞後再另存副本。原本內容仍保留。');return;}
   copyRequest.current=JSON.parse(JSON.stringify({payload:{action:'saveWorksheet',id:copyId.current,version:0,title,config},document,content,origin:{documentKey,selectedSavedId,lesson},dispatched:false}));setCopyPending(true);
  }
  const request=copyRequest.current,previouslyDispatched=!!request.dispatched;request.dispatched=true;
  localPayload.current=captureLocalDraft();const persisted=persistLocalDraft();
  if(!persisted&&!allowUnprotected){request.dispatched=previouslyDispatched;setCopyStorageBlocked(true);setCopyError((previouslyDispatched?'本次重試尚未傳送；先前請求可能已完成。':'這次副本尚未傳送。')+'此瀏覽器無法保留副本重試資料。可清理本機草稿後重試，或明確選擇「仍另存副本（無本機恢復保護）」。目前內容仍保留。');return;}
  setCopyStorageBlocked(false);setCopyUnprotected(!persisted);markOperation('正在建立學習單副本，請稍候確認結果後再切換。');setCopyError('');
  const {payload,document,content,origin}=request,{title,config}=payload;
  try{
   const r=await api(payload);
   rememberSaved(r.id,title,config,r.version??1,r.updated);copyRequest.current=null;setCopyPending(false);setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyOpen(false);
   if(origin.documentKey===documentKey&&origin.selectedSavedId===selectedSavedId&&origin.lesson===lesson&&!batchPending){preserveContent(content);setMissingSource([]);setConflict(null);setLegacySource(null);setSavedVersion(r.version??1);loadDocument(document);setSavedId(r.id);draftId.current=r.id;setStatus(`已另存「${title}」，現在可編輯這份副本。`)}
   else setStatus(`已確認副本「${title}」已儲存。目前後續修改仍保留，可從已存設定載入副本。`);
  }catch(e){
   if(e.response?.conflict){const current=e.response.current;if(current)rememberSaved(current.id,current.title,JSON.parse(current.config),current.version,current.updated);copyRequest.current=null;setCopyPending(false);setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyOpen(false);setStatus(current?'先前的副本已建立，之後又被更新；已列入已存清單，目前編輯內容仍保留。請從清單核對副本，或再按「複製這份學習單」另建一份。':e.response.deleted?'先前的副本已刪除，本次未重新建立。目前編輯內容仍保留，需要時可再按「複製這份學習單」另建一份。':'無法使用先前副本的識別資料，本次未覆蓋任何已存設定。目前編輯內容仍保留，可重新複製。')}
   else if(e.response?.canEdit){copyRequest.current=null;setCopyPending(false);setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyError('這次資料未通過檢查，尚未另存。原本內容與名稱仍保留，請修正後再試：'+e.message)}
   else setCopyError('副本結果尚未確認，可能已建立。請重試確認同一份副本；原本內容與輸入仍保留：'+e.message);
  }
  finally{markOperation('')}
 };
 const installWorksheet=row=>{
  const c=JSON.parse(row.config);
  if(c.layout==='copybook'){
   const restored=restoreCopybookContent(c,sourceAll);
   const nextSelected=c.options?.orderVersion===1?restored.selected:[...restored.all.filter(e=>restored.selected.includes(e.id)).map(e=>e.id),...restored.missing.map(e=>e.id)];
   const nextOptions={...BOOK_DEFAULTS,...c.options,defaultMode:c.options.defaultMode??(c.options.worksheetType==='parts'||(!c.options.worksheetType&&c.options.contentMode==='character')?'parts':'trace'),titleCustom:c.options.titleCustom??true,worksheetType:c.options.worksheetType||(c.options.contentMode==='character'?'parts':'copybook')};
   if(!nextOptions.titleCustom)nextOptions.title=automaticCopybookTitle(orderedBookEntries(restored.all,nextSelected),c.lesson,id=>restored.lessonSnapshots[id]||sourceLesson(id),id=>restored.bookSnapshots[id]||sourceBook(id));
   setPreserved(restored);setMissingSource(restored.missing);setLesson(c.lesson);chooseEntry(restored.all.find(e=>e.id===nextSelected[0])||sourceAll[0]);loadDocument({selected:nextSelected,options:nextOptions});setSavedId(row.id);setSavedVersion(row.version??1);setLegacySource(null);
   setStatus(restored.missing.length?'這份舊設定有來源已刪除的語詞，請查看缺漏提示；原始設定尚未變更。':'已載入學習單，保留儲存時的語詞、注音與課次名稱。');
  }else{
   const imported=sourceAll.filter(e=>e.lesson===c.lesson&&c.selected.includes(e.character)),items={};
   const missing=c.selected.filter(char=>!imported.some(e=>e.character===char)).map(char=>({id:char,label:char}));
   for(const e of imported){const old=c.configs?.[e.character];items[e.id]={word:e.word,targetIdx:e.targetIdx,mode:'parts',styles:old?.styles||{0:'black',1:'gray'},...(old?.mapping?{mapping:old.mapping}:{})}}
   setPreserved({snapshots:[],lessonSnapshots:{},bookSnapshots:{}});setMissingSource(missing);setLesson(c.lesson);chooseEntry(imported[0]||sourceAll[0]);loadDocument({selected:imported.map(e=>e.id),options:{...BOOK_DEFAULTS,title:c.title||'南一五上 部件學習單',titleCustom:true,worksheetType:'parts',defaultMode:'parts',contentMode:'word',repetitions:c.count+(c.model?1:0),showModel:!!c.model,items}});setSavedId('');setSavedVersion(0);setLegacySource({id:row.id,title:row.title,version:row.version??1});setStatus('已轉為直式語詞部件學習單，儲存時會另存一份；也可單獨刪除早期原始設定。');
  }
  draftId.current='';setBatchRules({});setConflict(null);saveRequest.current=null;setSavePending(false);setSaveStorageBlocked(false);setSaveUnprotected(false);
 };
 // Drafts are independent per editing session, so another tab cannot overwrite this draft.
 useEffect(()=>{
  localScopeRef.current=localScope;localDraftId.current=crypto.randomUUID();localPayload.current=null;recoveredDrafts.current=[];
  refreshLocalDrafts();
  const changed=event=>{if(event.key?.startsWith(localScope+'draft:'))refreshLocalDrafts()};
  const flush=()=>{if(localPayload.current&&localScopeRef.current===localScope){try{writeCopybookDraft(window.localStorage,localScope,localPayload.current)}catch{}}};
  window.addEventListener('storage',changed);window.addEventListener('pagehide',flush);
  return()=>{flush();window.removeEventListener('storage',changed);window.removeEventListener('pagehide',flush)};
 },[localScope]);
 useEffect(()=>{
  if(!localScope)return;
  if(!hasUnsaved){
   localPayload.current=null;
   try{window.localStorage.removeItem(localScope+'draft:'+localDraftId.current);for(const draft of recoveredDrafts.current)discardCopybookDraft(window.localStorage,draft);recoveredDrafts.current=[];setDraftNotice('');refreshLocalDrafts()}catch{setDraftStorageError('無法更新此瀏覽器的草稿狀態，已存學習單不受影響。')}
   return;
  }
  localPayload.current=captureLocalDraft();
  const timer=setTimeout(persistLocalDraft,350);
  return()=>clearTimeout(timer);
 },[localScope,hasUnsaved,documentKey,selected,lesson,batchRules,preserved,sourceAll,savedId,savedVersion,savedDocumentKey,legacySource,copyPending,savePending,active,charIndex,round,scope,editorTab,previewMode,mobileView,previewPage,previewZoom]);
 const recoverLocalDraft=draft=>{
  if(operation.current)return;
  if(hasUnsaved&&!window.confirm('目前修改會保留為另一份本機草稿，是否開啟這份草稿？'))return;
  if(!detachLocalDraft())return;
  const c=draft.config,restored=restoreCopybookContent(c,sourceAll),view=draft.editor||{};
  setPreserved(restored);setMissingSource(restored.missing);setLesson(c.lesson);resetDocument({selected:restored.selected,options:{...BOOK_DEFAULTS,...c.options}});
  setSavedId(draft.savedId);setSavedVersion(draft.savedVersion);setSavedDocumentKey(draft.savedDocumentKey);setLegacySource(draft.legacySource||null);draftId.current=draft.draftId||'';
  setBatchRules(draft.batchRules);saveRequest.current=draft.saveRequest||null;setSavePending(!!draft.saveRequest);setSaveStorageBlocked(false);setSaveUnprotected(false);copyRequest.current=draft.copyRequest?{...draft.copyRequest,dispatched:draft.copyRequest.dispatched!==false}:null;copyId.current=draft.copyRequest?.payload?.id||'';setCopyPending(!!draft.copyRequest);setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyTitle(draft.copyRequest?.payload?.title||'');setCopyOpen(false);setConflict(null);
  chooseEntry(restored.all.find(e=>e.id===view.active)||restored.all.find(e=>e.id===restored.selected[0])||sourceAll[0]);
  if(Number.isInteger(view.charIndex))setCharIndex(Math.max(0,view.charIndex));if(Number.isInteger(view.round))setRound(Math.max(0,Math.min(19,view.round)));
  setScope(view.scope==='character'?'character':'cell');setEditorTab(['setup','batch','cells'].includes(view.editorTab)?view.editorTab:'setup');setPreviewMode(['cells','paper'].includes(view.previewMode)?view.previewMode:'arrange');setMobileView(view.mobileView==='preview'?'preview':'editor');setPreviewPage(Math.max(0,Number(view.previewPage)||0));setPreviewZoom([100,150,200].includes(view.previewZoom)?view.previewZoom:100);
  recoveredDrafts.current=[draft];setRecoverableDrafts(rows=>rows.filter(row=>row.storageKey!==draft.storageKey));setStatus('已恢復本機草稿，包含排版與待套用提示。儲存時仍會核對原本版本，避免覆蓋其他視窗的更新。');
 };
 const discardLocalDraft=draft=>{if(operation.current)return;try{if(!discardCopybookDraft(window.localStorage,draft))setDraftNotice('這份草稿剛被其他視窗更新，已重新載入清單，請核對後再刪除。');else setDraftNotice('已刪除這份本機草稿，已存學習單不受影響。');refreshLocalDrafts()}catch{setDraftStorageError('無法刪除本機草稿，請稍後重試。')}};
 useEffect(()=>{
  if(!initialDraft?.requestId||seedHandled.current===initialDraft.requestId)return;
  const config=createAssessmentCopybookSeed(initialDraft,BOOK_DEFAULTS);
  seedHandled.current=initialDraft.requestId;
  if(!config){setStatus('補練語詞資料不完整或內容過大，尚未建立新學習單；請減少選取或檢查語詞資料。');onInitialDraftConsumed?.(initialDraft.requestId);return;}
  if(!detachLocalDraft()){setStatus('目前草稿無法暫存，已保留編輯內容。請先儲存目前學習單，再從測驗建立補練。');onInitialDraftConsumed?.(initialDraft.requestId);return;}
  const restored=restoreCopybookContent(config,sourceAll);setPreserved(restored);setMissingSource([]);setLesson(config.lesson);resetDocument({selected:config.selected,options:config.options});chooseEntry(config.entrySnapshots[0]);setSavedId('');setSavedVersion(0);setSavedDocumentKey('');setLegacySource(null);setConflict(null);setBatchRules({});draftId.current='';saveRequest.current=null;setSavePending(false);setSaveStorageBlocked(false);setSaveUnprotected(false);copyRequest.current=null;setCopyPending(false);setCopyOpen(false);setEditorTab('setup');setMobileView('editor');
  setStatus(`已建立「${config.options.title}」草稿，保留測驗當時的 ${config.entrySnapshots.length} 個語詞與注音。請檢查練習次數、提示與版面，再儲存或下載。`);onInitialDraftConsumed?.(initialDraft.requestId);
 },[initialDraft?.requestId]);
 useEffect(()=>{
  if(!seed?.nonce||simpleSeed.current===seed.nonce)return;simpleSeed.current=seed.nonce;
  if(hasUnsaved&&!window.confirm('進階模式裡有尚未儲存的修改。要改用簡易模式帶過來的學習單嗎？（目前修改會暫存為本機草稿）'))return;
  if(!detachLocalDraft({allowDiscard:true}))return;
  setPreserved({snapshots:seed.entrySnapshots||[],lessonSnapshots:seed.lessonSnapshots||{},bookSnapshots:seed.bookSnapshots||{}});setMissingSource([]);setBatchRules({});setConflict(null);setLegacySource(null);setSavedId('');setSavedVersion(0);draftId.current='';saveRequest.current=null;setSavePending(false);
  setLesson(seed.lesson);resetDocument({selected:seed.selected,options:seed.options});setSavedDocumentKey('');chooseEntry([...(seed.entrySnapshots||[]),...all].find(e=>e.id===seed.selected[0])||all[0]);setEditorTab('setup');setPreviewMode('paper');
  setStatus('已帶入簡易模式的學習單，可以拖曳排版或逐格調整。要保留這份設定請按「儲存學習單設定」。');
 },[seed?.nonce]);
 const load=id=>{
  if(operation.current||!requireAppliedBatch())return;
  const discardConfirmed=hasUnsaved&&window.confirm(uncertainRequests().length?'學習單還有待確認的儲存或副本。切換前會嘗試保留本機草稿，恢復草稿後可繼續確認；是否載入其他設定？':'學習單尚未儲存，要放棄修改並載入其他設定嗎？');
  if(hasUnsaved&&!discardConfirmed)return;
  if(!id){if(!detachLocalDraft({allowDiscard:!!discardConfirmed}))return;saveRequest.current=null;setSavePending(false);setSaveStorageBlocked(false);setSaveUnprotected(false);setSavedId('');setSavedVersion(0);setLegacySource(null);setConflict(null);draftId.current='';setSavedDocumentKey('');return;}
  try{if(!detachLocalDraft({allowDiscard:!!discardConfirmed}))return;installWorksheet(saved.find(row=>row.id===id))}catch{setStatus('無法讀取這份學習單設定，目前編輯內容仍保留。')}
 };
 const reloadLatest=async()=>{
  if(operation.current||!conflict||!requireAppliedBatch())return;
  if(!window.confirm('要放棄目前編輯內容，載入其他視窗最後儲存的版本嗎？'))return;
  operation.current=true;setBusy(true);
  try{const r=await api({action:'worksheets'}),row=r.rows.find(row=>row.id===conflict.id);if(!row){setConflict(v=>({...v,current:null}));setStatus('這份已存設定已不存在。目前編輯內容仍保留，可另存副本。');return}if(!detachLocalDraft({allowDiscard:true}))return;installWorksheet(row);rememberSaved(row.id,row.title,JSON.parse(row.config),row.version,row.updated)}
  catch(e){setStatus('無法載入最新設定，目前編輯內容仍保留：'+e.message)}finally{operation.current=false;setBusy(false)}
 };
 const download=async format=>{if(operation.current||!requireAppliedBatch())return;if(missingSource.length){setStatus('請先檢查缺漏語詞，將現有內容另存副本後再下載。');return;}if(plan.tooLong.length){setStatus('語詞超過一欄，請縮小字格：'+plan.tooLong.join('、'));return;}markOperation('正在製作學習單下載檔，請稍候完成後再切換。');setStatus('正在製作生字本，請稍候…');try{await document.fonts.ready;if(format==='print'){await printPages(plan,data,options,teachingSettings)}else if(format==='docx'){downloadBlob(await bookDOCX(entries,options,data,teachingSettings),(options.title||'語詞生字本')+'.docx')}else{const images=[];for(let page=0;page<plan.pages.length;page++){const png=await svgPNG(bookPageSVG(plan,page,data,options,teachingSettings),1),url=URL.createObjectURL(new Blob([png],{type:'image/png'}));try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/jpeg',.96));images.push({bytes:new Uint8Array(await blob.arrayBuffer()),width:c.width,height:c.height})}finally{URL.revokeObjectURL(url)}}downloadBlob(imagePDF(images,plan.paper),(options.title||'語詞生字本')+'.pdf')}setStatus(format==='print'?'已開啟列印視窗。':'已產生下載檔。每格描紅、部件提示與注音均依設定輸出。')}catch(e){setStatus('製作失敗：'+e.message)}finally{markOperation('')}};
 const previewSVG=(c)=>cellSVG(c,data,plan.renderOptions,teachingSettings).replace(/width="\d+" height="240"/,'style="width:100%;height:auto;display:block"');
 return <section className="space-y-4">
 {localScope&&<div className="space-y-2">
 {draftStorageError?<p role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm">{draftStorageError}</p>:draftNotice&&<p role="status" className="text-sm text-slate-600">{draftNotice} 本機草稿只在這台裝置的此瀏覽器保留，不等於已儲存學習單。</p>}
 {!!recoverableDrafts.length&&<details open className="rounded-xl border border-blue-300 bg-blue-50 p-3 space-y-3"><summary className="font-bold cursor-pointer">找到 {recoverableDrafts.length} 份尚未儲存的本機草稿</summary><p className="text-sm">請選擇恢復或刪除。恢復只載入編輯內容，不會自動寫入已存學習單；不同分頁的草稿會各自保留。</p><div className="space-y-2 max-h-64 overflow-y-auto">{recoverableDrafts.map(draft=><div key={draft.storageKey} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white p-3"><div className="min-w-0"><p className="font-bold break-words">{draft.config.options.title||'未命名學習單'}</p><p className="text-sm text-slate-600">{new Date(draft.updatedAt).toLocaleString('zh-TW')}・{draft.config.selected.length} 個語詞{Object.keys(draft.batchRules).length?'・有待套用提示':''}{draft.copyRequest?'・有待確認副本':''}{draft.saveRequest?'・有待確認儲存':''}</p></div><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>recoverLocalDraft(draft)}>恢復草稿</button><button type="button" className={button+' text-red-800'} disabled={busy} onClick={()=>discardLocalDraft(draft)}>刪除此草稿</button></div></div>)}</div></details>}
 </div>}
 <div className="copybook-workspace" data-mobile-view={mobileView}>
 <div className="copybook-workspace-toolbar"><div className="flex gap-2 lg:hidden" role="group" aria-label="編輯與預覽切換">{[['editor','設定',SlidersHorizontal],['preview','預覽',Eye]].map(([id,label,Icon])=><button key={id} className={button+(mobileView===id?' border-blue-700 bg-blue-50 text-blue-900':'')} aria-pressed={mobileView===id} aria-controls={id==='editor'?'copybook-editor':'copybook-preview'} onClick={()=>setMobileView(id)}><Icon className="inline mr-2" size={18}/>{label}</button>)}</div><div className="flex flex-wrap items-center gap-2"><button type="button" className={button+' btn-quiet px-2'} disabled={busy||!canUndo} onClick={()=>restore('undo')} title="復原上一步"><Undo2 className="inline mr-2" size={18}/>復原</button><button type="button" className={button+' btn-quiet px-2'} disabled={busy||!canRedo} onClick={()=>restore('redo')} title="重作上一步"><Redo2 className="inline mr-2" size={18}/>重作</button><span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true"/><button className={button} disabled={busy||!savePending&&!entries.length} onClick={save}><Save className="inline mr-2" size={18}/>儲存學習單設定</button><button type="button" className={button+' btn-quiet'} disabled={busy||!copyPending&&!entries.length} onClick={openCopy}><Copy className="inline mr-2" size={18}/>{copyPending?'確認上一份副本':'複製這份學習單'}</button><span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" aria-hidden="true"/><button className={button+' btn-primary'} disabled={busy||!entries.length||!ready||!!plan.tooLong.length} onClick={()=>download('pdf')}><Download className="inline mr-2" size={18}/>下載 PDF</button><button className={button} disabled={busy||!entries.length||!ready||!!plan.tooLong.length} onClick={()=>download('print')}><Printer className="inline mr-2" size={18}/>列印</button><button className={button+' btn-quiet'} disabled={busy||!entries.length||!ready||!!plan.tooLong.length} onClick={()=>download('docx')}>Word 檔</button></div><p role="status" className="basis-full text-sm text-blue-800">{hasUnsaved&&<strong>有尚未儲存的學習單修改。 </strong>}{status||(loadingStrokes?'正在載入字形…':`已選 ${entries.length} 個語詞・預計 ${plan.pages.length} 頁`)}</p>{!!plan.tooLong.length&&<p role="alert" className="basis-full text-sm text-amber-900">語詞超過一欄，請改用較小字格：{plan.tooLong.join('、')}。</p>}{!!missingParts.length&&<p role="alert" className="basis-full text-sm text-amber-900">以下字缺少部件筆畫，請改用其他提示方式後再下載：{missingParts.join('、')}。目前設定仍可儲存。</p>}{!!failedStrokes.length&&<div className="basis-full rounded-xl border border-amber-300 bg-amber-50 p-3 flex flex-wrap items-center gap-3"><p role="status" className="flex-1 min-w-48 text-sm text-amber-950">字形暫時無法載入：{failedStrokes.slice(0,12).join('、')}{failedStrokes.length>12?`等 ${failedStrokes.length} 字`:''}。排版與提示已保留，部件提示需載入完成才能下載。</p><button type="button" className={button} disabled={busy||loadingStrokes} onClick={retryStrokes}>重新載入字形</button></div>}</div>
 {batchPending&&<div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-3 space-y-2"><p>批次提示尚未套用。請先套用或清空，再儲存、複製、下載或載入其他學習單。</p><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={()=>{setEditorTab('batch');setMobileView('editor')}}>查看待套用設定</button><button type="button" className={button} disabled={busy} onClick={()=>setBatchRules({})}>清空批次選項</button></div></div>}
 {!!missingSource.length&&<div role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 space-y-2"><p>這份舊學習單未保存完整語詞，以下來源已不存在：{missingSource.map(item=>item.label).join('、')}。</p><p>目前只能顯示其餘語詞，暫不覆蓋原設定或下載。確認現有內容後，可按「複製這份學習單」另存副本。</p></div>}
 {conflict&&<div role="alert" className="rounded-xl border border-amber-400 bg-amber-50 p-3 space-y-2"><p>{conflict.current?'這份學習單已在其他視窗更新。':'這份已存學習單已刪除或無法使用。'}目前編輯內容仍保留，請另存副本{conflict.current?'，或放棄目前修改並載入最新版本':'，避免重建已刪除的設定'}。</p><div className="flex flex-wrap gap-2">{conflict.current&&<button type="button" className={button} disabled={busy} onClick={reloadLatest}>載入最新版本</button>}<button type="button" className={button} disabled={busy||!entries.length} onClick={openCopy}>將目前內容另存副本</button></div></div>}
 {savePending&&<div role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 space-y-2"><p>學習單「{saveRequest.current?.payload.title}」{saveRequest.current?.dispatched?'的儲存結果尚待確認。':'尚未傳送儲存。'}確認時只使用這次準備的內容；後續修改與待套用提示會保留，確認後再儲存。</p>{(saveStorageBlocked||saveUnprotected)&&<p className="font-bold">此瀏覽器目前無法保留儲存重試資料。若選擇仍儲存，請留在本頁確認結果；關閉或重整後無法保證恢復這次請求。</p>}<div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={busy} onClick={save}>確認上次儲存</button>{saveStorageBlocked&&<button type="button" className={button+' border-amber-700 text-amber-950'} disabled={busy} onClick={()=>save({allowUnprotected:true})}>仍儲存（無本機恢復保護）</button>}{!saveRequest.current?.dispatched&&<button type="button" className={button} disabled={busy} onClick={()=>{saveRequest.current=null;setSavePending(false);setSaveStorageBlocked(false);setSaveUnprotected(false);setStatus('已取消尚未傳送的儲存，目前編輯內容保留。')}}>取消這次儲存</button>}</div></div>}
 {copyPending&&<div role="status" className="rounded-xl border border-amber-400 bg-amber-50 p-3 space-y-2"><p>副本「{copyRequest.current?.payload.title}」{copyRequest.current?.dispatched?'可能已建立，結果尚待確認。請先核對這次另存，避免重複建立。':'尚未傳送。可繼續確認，或取消這次副本。'}</p><button type="button" className={button} disabled={busy} onClick={openCopy}>確認上一份副本</button></div>}
 {legacySource&&<p role="status" className="rounded-xl border bg-blue-50 p-3 text-blue-900">已載入早期設定「{legacySource.title}」。儲存會建立新版；「刪除早期原始設定」只刪除舊設定，目前轉換後的內容會保留。</p>}
 <div className="copybook-workspace-panels" inert={busy||undefined}>
 <section id="copybook-editor" aria-label="生字本設定" className="copybook-panel copybook-editor"><div className="copybook-panel-heading"><div className="flex flex-wrap gap-2" role="group" aria-label="設定類別">{[['setup','語詞與版面'],['batch','批次套用'],['cells','逐字逐格']].map(([id,label])=><button key={id} className={button+(editorTab===id?' border-blue-700 text-blue-900 bg-blue-50':'')} aria-pressed={editorTab===id} aria-controls={id==='setup'?'copybook-setup':id==='batch'?'copybook-batch':'copybook-cell-heading'} onClick={()=>switchEditor(id)}>{label}</button>)}</div>{editorTab==='cells'&&<div className="copybook-cell-location" aria-label="目前設定的字格">
 <div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><p className="font-bold text-lg break-words">{entry.word}：第 {repeat+1} 次・第 {index+1} 字「{target}」</p><p className="text-sm mt-1">{locationLabel}</p></div><button type="button" className={button+' shrink-0'} disabled={!location||busy} onClick={locateCell}><LocateFixed size={18} className="inline mr-1"/>在預覽中定位</button></div>
 <p className="text-sm font-bold mt-2">{scope==='cell'?'修改範圍：只調整這一格':`修改範圍：此語詞第 ${index+1} 字「${target}」的全部 ${times} 格`}</p>
 </div>}</div>
 <div ref={editorBody} className="copybook-panel-body p-4"><section id="copybook-setup" hidden={editorTab!=='setup'} className="space-y-5" aria-label="語詞與版面設定">
 <details className="rounded-xl border bg-slate-50 p-3" ref={el=>{if(el&&!el.dataset.ready){el.dataset.ready='1';if(savedSearch)el.open=true}}}><summary className="cursor-pointer font-bold">開啟或管理已存學習單（{saved.length} 份）{!!selectedSavedId&&currentSaved?.label?`・目前：${currentSaved.label}`:''}</summary><div className="mt-3 space-y-2 min-w-0 max-w-full"><label className="block">搜尋已存學習單<input aria-label="搜尋已存學習單" type="search" className={'block w-full '+input} placeholder="輸入標題或語詞關鍵字" value={savedSearch} disabled={busy} onChange={e=>setSavedSearch(e.target.value)}/></label><div className="flex flex-wrap items-center gap-2 text-sm"><span role="status">{savedLoading?'正在載入…':`符合 ${matchingSaved.length}／${saved.length} 份`}</span>{!!savedSearch&&<button type="button" className="rounded-lg border bg-white px-2 py-1 text-blue-900" disabled={busy} onClick={()=>setSavedSearch('')}>清除搜尋</button>}</div><label>已存設定<select aria-label="已存學習單設定" className={'block max-w-full '+input} value={selectedSavedId} disabled={busy||savedLoading} onChange={e=>load(e.target.value)}><option value="">新學習單</option>{!!selectedSavedId&&!saved.some(row=>row.id===selectedSavedId)&&<option value={selectedSavedId} disabled>目前學習單（清單已無此設定）</option>}{currentOutsideSearch&&<option value={currentSaved.id}>目前編輯（未符合搜尋）：{currentSaved.label}</option>}{matchingSaved.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}{!savedLoading&&!matchingSaved.length&&<option value="search-empty" disabled>{saved.length?'沒有符合搜尋的設定':'尚無已存設定'}</option>}</select></label><button type="button" className={button} disabled={busy||savedLoading} onClick={refreshSavedList}>{savedLoading?'正在載入已存清單…':'重新載入已存清單'}</button><button type="button" className={button+' self-end border-red-300 text-red-800'} disabled={busy||!selectedSavedId||!saved.some(row=>row.id===selectedSavedId)} onClick={openDelete}><Trash2 className="inline mr-1" size={18}/>{legacySource?'刪除早期原始設定':'刪除已存設定'}</button></div></details>
 <fieldset className="rounded-xl border p-4 space-y-3"><legend className="px-2 text-lg font-bold">① 選教材與課次</legend><div className="flex flex-wrap items-end gap-4">{!sourceLessons[lesson]&&preserved.lessonSnapshots[lesson]?<div className="space-y-2"><p className="text-sm text-blue-900">{lesson.startsWith('followup:')?'測驗補練課次：':'已存課次：'}{getLessonMeta(lesson)?.title}{lesson.startsWith('followup:')?'（保留測驗當時語詞與注音）':'（原教材已刪除，語詞仍可編輯）'}</p><button type="button" className={button} onClick={()=>{setLesson(keys[0]);chooseEntry(all.find(e=>e.lesson===keys[0]))}}>加入其他課次語詞</button></div>:<CurriculumPicker lesson={lesson} includeCustom={false} onChange={id=>{setLesson(id);chooseEntry(all.find(x=>x.lesson===id))}}/>}<button type="button" className={button+' self-end border-blue-600 text-blue-900'} disabled={busy||!sourceLessons[lesson]?.length} onClick={applySettingsToLesson}>套用目前設定到這一課</button></div></fieldset>
 {currentOutsideSearch&&<p role="status" className="text-sm text-blue-900">目前編輯的學習單未符合搜尋，內容與選取保持不變；可清除搜尋查看全部設定。</p>}
 {savedListError?<p role="alert" className="text-sm text-red-800">{savedListError}</p>:savedListNotice&&<p role="status" className="text-sm text-blue-800">{savedListNotice}</p>}{!!selectedSavedId&&!savedLoading&&!savedListError&&!saved.some(row=>row.id===selectedSavedId)&&<p role="status" className="text-sm text-amber-900">目前編輯的已存設定不在最新清單中。內容仍保留，可使用「複製這份學習單」另存副本。</p>}
 <h3 className="text-lg font-bold">② 選語詞</h3>
 <p className="rounded-lg bg-amber-50 p-2 text-sm text-amber-950 md:hidden">在手機上，拖曳排版不好操作。要調整語詞順序，請展開下方「語詞順序與練習次數」用 ↑↓ 移動；只想快速印出，建議用「簡易模式」。</p>
 <p className="text-sm text-slate-600">切換版本或課次可瀏覽其他教材，已選語詞會保留。勾選語詞或按「加入本課全部」即可加入學習單。</p>
 <div className="flex flex-wrap gap-2">{all.filter(e=>e.lesson===lesson).map(e=><label key={e.id} className="border rounded-lg p-2 text-xl hanzi-kai"><input type="checkbox" checked={selected.includes(e.id)} onChange={ev=>setSelected(v=>ev.target.checked?[...v,e.id]:v.filter(x=>x!==e.id))}/> {e.word}（{e.word[e.targetIdx]}）</label>)}</div>
 <div className="flex flex-wrap gap-2 items-center"><label>本課選取 <input aria-label="本課選取語詞數" type="number" min={1} max={Math.max(1,(lessons[lesson]||[]).length)} className={input+' w-20'} value={pickCount} onChange={e=>setPickCount(Math.max(1,Math.min((lessons[lesson]||[]).length,+e.target.value||1)))}/> 個語詞</label><button className={button} onClick={()=>setSelected(all.filter(e=>e.lesson===lesson).slice(0,pickCount).map(e=>e.id))}>只選本課前 {pickCount} 個（取代目前選取）</button><button className={button} onClick={()=>setSelected(v=>[...new Set([...v,...all.filter(e=>e.lesson===lesson).map(e=>e.id)])])}>加入本課全部</button><button className={button} onClick={()=>setSelected(all.filter(e=>e.bookId===getLessonMeta(lesson)?.bookId).map(e=>e.id))}>只選此版本本學期全部（取代目前選取）</button><button className={button} onClick={()=>setSelected([])}>清空選取</button></div>{!(lessons[lesson]||[]).length&&<p className="text-blue-900">本課目前沒有語詞，請選擇其他課次。</p>}<p>已選 {entries.length} 個語詞・共 {plan.totalCells} 個字格（含示範字）</p>
 <CopybookWordRepetitions entries={entries} options={options} disabled={busy} lessonLabel={lessonTitle} onChange={updateWordRepetitions} onEdit={editSelectedEntry} onMove={moveWord}/>
 <h3 className="text-lg font-bold">③ 標題、提示與版面</h3>
 <div className="space-y-2"><label className="block">標題文字<input aria-label="學習單標題" className={'block w-full '+input} maxLength={45} value={options.title} disabled={busy} onChange={e=>setOptions(v=>({...v,title:e.target.value,titleCustom:true}))}/></label><label className="flex items-center gap-2"><input type="checkbox" aria-label="依課次自動命名" checked={!options.titleCustom} disabled={busy} onChange={e=>setOptions(v=>({...v,title:options.title,titleCustom:!e.target.checked}))}/>依課次自動命名</label><p className="text-sm text-slate-600">依已選語詞的課次命名；跨課會標示多個課次。直接修改標題可改為自訂名稱。</p></div>
 
 <fieldset className="border rounded-xl p-4 space-y-4"><legend className="font-bold px-2">整張學習單預設</legend><label className="block">生字提示 <select className={input} aria-label="整張學習單生字提示" value={options.defaultMode} onChange={e=>update('defaultMode',e.target.value)}>{Object.entries(modes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><div className="flex flex-wrap gap-4"><label>內容 <select className={input} value={options.contentMode} onChange={e=>update('contentMode',e.target.value)}><option value="word">完整語詞</option><option value="character">只印目標單字</option></select></label><label>紙張 <select aria-label="學習單紙張大小" className={input} value={plan.paper.size} onChange={e=>update('paperSize',e.target.value)}><option value="A4">A4（210 × 297 mm）</option><option value="A3">A3（297 × 420 mm）</option></select></label><label>字格大小 <select aria-label="學習單字格大小" className={input} value={plan.cellSize} onChange={e=>update('cellSize',+e.target.value)}>{CELL_SIZES.map(n=><option key={n} value={n}>{n} mm{({15:'（小）',20:'（一般）',25:'（大）',30:'（特大）',40:'（最大）'})[n]||''}</option>)}</select></label><label>預設練習次數（含示範字） <input aria-label="整張預設練習次數" type="number" min={1} max={20} className={input+' w-20'} value={options.repetitions} onChange={e=>update('repetitions',Math.max(1,Math.min(20,+e.target.value||1)))}/></label></div><div className="flex flex-wrap gap-4"><label><input type="checkbox" checked={options.showModel} onChange={e=>update('showModel',e.target.checked)}/> 第一次完整示範字</label><label><input type="checkbox" checked={options.blankLast} onChange={e=>update('blankLast',e.target.checked)}/> 最後一次生字留白</label><label><input type="checkbox" checked={options.showZhuyin} onChange={e=>update('showZhuyin',e.target.checked)}/> 預設顯示注音</label><label><input type="checkbox" checked={!!options.keepZhuyinRail} onChange={e=>update('keepZhuyinRail',e.target.checked)}/> 沒有注音時也保留注音格（讓學生自己寫）</label><label><input type="checkbox" checked={options.traceTone==='dark'} onChange={e=>update('traceTone',e.target.checked?'dark':'normal')}/> 描紅、描灰顏色加深（較好看清楚）</label></div><label className="flex flex-wrap items-center gap-2">紙本十字線濃淡<input aria-label="紙本十字線濃淡" type="range" min={0} max={100} step={5} value={Math.round(copybookCrossOpacity(options)*100)} onChange={e=>update('crossOpacity',+e.target.value/100)}/><output>{Math.round(copybookCrossOpacity(options)*100)}%</output><span className="text-sm text-slate-600">0% 隱藏，100% 最深</span></label><p className="text-sm text-slate-600">紙張、字格與十字線同步套用紙本版面預覽、Word 及 PDF。批次套用及逐格設定優先；只印一次且勾選最後留白時，生字會留白。</p><button type="button" className={button+' border-blue-700 text-blue-900'} onClick={()=>switchEditor('batch')}>快速設定第 1 次、第 2 次…生字</button></fieldset>
 <CopybookLayout options={options} onOption={update} onPreview={openLayout} onAuto={autoArrange}/>
 <details className="border rounded-xl p-4"><summary className="cursor-pointer font-bold">標題與學生資料欄設定</summary><fieldset className="mt-3 space-y-4"><div className="flex flex-wrap gap-4"><label>位置 <select className={input} value={options.titlePosition} onChange={e=>update('titlePosition',e.target.value)}><option value="top">頁面上方（預設）</option><option value="right">最右側</option><option value="left">最左側</option><option value="none">不顯示整個標題欄</option></select></label><label>標題字體大小 <select className={input} value={options.titleFontSize} onChange={e=>update('titleFontSize',+e.target.value)}>{[12,16,18,22,28].map(n=><option key={n} value={n}>{n} pt</option>)}</select></label><label>標題字距 <select className={input} value={options.titleLetterSpacing} onChange={e=>update('titleLetterSpacing',+e.target.value)}>{[0,1,2,4].map(n=><option key={n} value={n}>{n} mm</option>)}</select></label></div><div className="flex flex-wrap gap-4">{options.titlePosition==='top'?<p className="self-center text-sm text-slate-600">標題在頁面上方時，班級、姓名、日期固定橫列書寫。</p>:<><label>資料欄排列 <select className={input} value={options.fieldDirection} onChange={e=>update('fieldDirection',e.target.value)}><option value="horizontal">橫列書寫（預設）</option><option value="vertical">直列書寫</option></select></label><label>每欄書寫空間 <select className={input} value={options.fieldSpace} onChange={e=>update('fieldSpace',+e.target.value)}><option value={28}>標準（28 mm）</option><option value={38}>加大（38 mm）</option><option value={48}>特大（48 mm）</option></select></label></>}{[['titleClass','班級欄'],['titleName','姓名欄'],['titleDate','日期欄']].map(([key,label])=><label key={key} className="flex items-center gap-2"><input type="checkbox" checked={options[key]!==false} onChange={e=>update(key,e.target.checked)}/> {label}</label>)}</div><p className="text-sm text-slate-600">班級、姓名、日期可個別隱藏。標題文字可在上方自由修改或留白；較長的直列標題會自動換欄並縮放，保留學生書寫空間。預覽、Word 與 PDF 使用同一份設定。</p></fieldset></details></section>
<div id="copybook-batch" hidden={editorTab!=='batch'}><CopybookBatchSettings classroomId={classroomId} userId={userId} entries={entries} options={options} disabled={busy} rules={batchRules} onRulesChange={setBatchRules} onApply={applyBatch}/></div>
<section hidden={editorTab!=='cells'} aria-labelledby="copybook-cell-heading" className="space-y-4"><h3 id="copybook-cell-heading" ref={editorHeading} tabIndex={-1} className="text-xl font-bold outline-none">逐字、逐格設定</h3><div className="flex flex-wrap gap-2">{all.filter(e=>e.lesson===lesson).map(e=><button key={e.id} className={button+(active===e.id?' border-blue-600 text-blue-800':'')} onClick={()=>chooseEntry(e)}>{e.word}（{e.word[e.targetIdx]}）{selected.includes(e.id)?' ✓':''}</button>)}</div>{!selected.includes(entry.id)&&<p className="text-amber-800">此語詞尚未加入本份學習單。<button className={button+' ml-2'} onClick={()=>setSelected(v=>[...v,entry.id])}>加入 {entry.word}</button></p>}
 <div className="flex flex-wrap gap-4 items-center"><b className="text-2xl">{entry.word}</b><label>此語詞的生字提示 <select className={input} aria-label="此語詞的生字提示" value={bookStoredItem(entry,options).mode??''} onChange={e=>updateItem({mode:e.target.value||undefined})}><option value="">沿用整張設定</option>{Object.entries(modes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>此語詞練習次數（含示範字） <select aria-label="此語詞練習次數" className={input} disabled={busy} value={cfg.repetitions??''} onChange={e=>updateWordRepetitions(entry.id,e.target.value)}><option value="">沿用整張（{options.repetitions} 次）</option>{Array.from({length:20},(_,i)=>i+1).map(n=><option key={n} value={n}>{n} 次</option>)}</select></label><label>生字 <select className={input} value={cfg.targetIdx} onChange={e=>{updateItem({targetIdx:+e.target.value,mapping:undefined});setCharIndex(+e.target.value)}}>{[...entry.word].map((c,i)=><option key={i} value={i}>第 {i+1} 字：{c}</option>)}</select></label></div>
 <p>點下方任一字格，設定該格的樣子與注音；同一語詞的每個字都能調整。</p><div className="flex gap-3 overflow-x-auto pb-3">{Array.from({length:times},(_,n)=><div key={n} className="shrink-0"><p className="text-center mb-2">第 {n+1} 次</p>{cells.filter(c=>c.repeat===n).map(c=><button key={c.key} className={'block w-20 border-2 mb-1 rounded-md overflow-hidden '+(cell.key===c.key?'border-blue-700 ring-2 ring-blue-300':'border-transparent')} aria-pressed={cell.key===c.key} aria-label={`第${n+1}次第${c.charIndex+1}字${c.char}：${modes[c.mode]}${c.showZhuyin?'，有注音':'，無注音'}`} onClick={()=>{setRound(n);setCharIndex(c.charIndex);setScope('cell')}} dangerouslySetInnerHTML={{__html:cellSVG(c,data,{...options,rail:cells.some(x=>x.showZhuyin)},teachingSettings).replace(/width="\d+" height="240"/,'style="width:100%;height:auto;display:block"')}}/>)}</div>)}</div>
 <div className="bg-blue-50 rounded-xl p-4 space-y-4"><h4 className="font-bold text-xl">正在設定：第 {repeat+1} 次・第 {index+1} 字「{target}」</h4><div className="flex flex-wrap gap-4">{[['cell','只調整這一格'],['character',`調整「${target}」這個位置的全部 ${times} 格`]].map(([id,label])=><label key={id}><input type="radio" name="cell-scope" checked={scope===id} onChange={()=>setScope(id)}/> {label}</label>)}</div><div className="flex flex-wrap gap-4 items-center"><label>字格內容 <select className={input} value={cell.mode} onChange={e=>updateDetail({mode:e.target.value})}>{Object.entries(modes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label><input type="checkbox" checked={!!cell.showZhuyin} onChange={e=>updateDetail({showZhuyin:e.target.checked})}/> 顯示本格注音</label><button className={button} onClick={resetDetail}>恢復沿用預設</button></div>
 {cell.mode==='parts'&&!data[target]&&<p role="alert" className="text-red-800">{data[target]===null?`「${target}」沒有部件筆畫資料，請改選描紅、描灰、空白或完整字。`:strokeErrors[target]?'字形暫時無法載入，請按上方「重新載入字形」。':'正在載入部件筆畫…'}</p>}
 {cell.mode==='parts'&&!!data[target]&&<><div className="flex flex-wrap gap-4">{groups.map(g=><label key={g} className="bg-white border rounded-xl p-3">部件 {g+1}<svg viewBox="0 0 1100 1100" className="w-24 h-24"><g transform="translate(38,955) scale(1,-1)">{data[target].strokes.map((p,i)=>mapping[i]===g&&<path key={i} d={p}/>)}</g></svg><select className={input} value={cell.styles?.[g]??(g===0?'black':'blank')} onChange={e=>updateDetail({styles:{...cell.styles,[g]:e.target.value}})}><option value="black">黑字提示</option><option value="gray">淡灰描寫</option><option value="red">淡紅描紅</option><option value="blank">留白</option></select></label>)}</div><details className="border rounded-xl p-4 bg-white"><summary className="font-bold cursor-pointer">自訂部件分組</summary><p className="my-3">先選部件編號，再點筆畫。分組只用於這份生字本。</p><div className="flex flex-wrap gap-2">{PALETTE.map((color,i)=><button key={i} className="w-10 h-10 border-4 rounded-lg font-bold" style={{background:color,borderColor:group===i?'#111':'transparent'}} onClick={()=>setGroup(i)} aria-pressed={group===i}>{i+1}</button>)}</div><div className="max-w-72 my-3"><Character data={data[target]} config={{mapping}} groupColors onStroke={i=>{const next=[...mapping];next[i]=group;updateDetail({mapping:next})}}/></div><button className={button} onClick={()=>updateDetail({mapping:null})}>恢復預設分組</button></details></>}
 </div><p className="text-sm text-slate-600">調整全部格時，只會同步本次修改的項目；例如修改注音，不會改掉各格原本的描紅或部件提示。</p></section>
 </div></section>
 <section id="copybook-preview" aria-labelledby="copybook-preview-heading" className="copybook-panel copybook-preview"><div className="copybook-panel-heading space-y-3"><h3 id="copybook-preview-heading" className="text-xl font-bold flex items-center gap-2"><Eye size={20}/>學習單即時預覽</h3><div className="flex flex-wrap gap-2" role="group" aria-label="預覽操作方式">{[['arrange','拖曳語詞排版'],['cells','編輯字格提示'],['paper','紙本版面']].map(([id,label])=><button type="button" className={button+(previewMode===id?' border-blue-700 bg-blue-50 text-blue-900':'')} aria-pressed={previewMode===id} onClick={()=>setPreviewMode(id)} key={id}>{label}</button>)}</div><div className="flex flex-wrap items-center gap-2"><button className={button} disabled={!plan.pages.length||shownPage===0} onClick={()=>setPreviewPage(shownPage-1)}>上一頁</button><label className="flex items-center gap-2">頁碼<select className={input} aria-label="預覽頁碼" disabled={!plan.pages.length} value={shownPage} onChange={e=>setPreviewPage(+e.target.value)}>{plan.pages.map((_,i)=><option key={i} value={i}>{i+1}／{plan.pages.length}</option>)}</select></label><button className={button} disabled={!plan.pages.length||shownPage>=plan.pages.length-1} onClick={()=>setPreviewPage(shownPage+1)}>下一頁</button><label className="flex items-center gap-2">大小<select className={input} aria-label="預覽縮放" value={previewZoom} onChange={e=>setPreviewZoom(+e.target.value)}><option value={100}>符合欄寬</option><option value={150}>放大 1.5 倍</option><option value={200}>放大 2 倍</option></select></label></div><p className="text-sm text-slate-600">{previewMode==='paper'?`${plan.paper.size}・${plan.cellSize} mm 字格。此畫面依紙張比例顯示，下載時保留實際尺寸。`:previewMode==='arrange'?'拖曳語詞調整排版，或點空白處「補入語詞」從其他頁移入。':'點字格設定提示；空白處可補入其他頁語詞，語詞旁的垃圾桶可刪除。'}</p>{previewMode==='cells'&&location&&<div className="flex flex-wrap items-center justify-between gap-2 text-sm text-blue-900"><span>已選「{entry.word}」的「{target}」・第 {repeat+1} 次<br/>{locationLabel}</span><button type="button" className={button} disabled={busy} onClick={()=>editPreviewCell(cell)}>回到這格設定</button></div>}</div>
 <div ref={previewBody} className="copybook-panel-body bg-slate-100 p-3" tabIndex={0} aria-label="生字本預覽，可捲動">{!entries.length?<p className="rounded-xl bg-white p-6">請在「語詞與版面」選取要練習的語詞。</p>:<div className="copybook-preview-paper bg-white shadow-sm" style={{width:`${previewZoom}%`,...(previewMode==='paper'?{padding:0,minHeight:0}:{})}}>{previewMode==='paper'?<div aria-label="完整紙本版面預覽" dangerouslySetInnerHTML={{__html:bookPageSVG(plan,shownPage,data,options,teachingSettings).replace(/width="[\d.]+" height="[\d.]+"/,'style="width:100%;height:auto;display:block"')}}/>:<><p className="text-sm text-slate-500 mb-3">第 {shownPage+1}／{plan.pages.length} 頁</p>{options.titlePosition==='top'&&<div className="mb-2" dangerouslySetInnerHTML={{__html:headerSVG(options).replace(/width="[\d.]+" height="[\d.]+"/,'style="width:100%;height:auto;display:block"')}}/>}<CopybookPreviewGrid entries={entries} options={options} plan={plan} page={shownPage} arranging={previewMode==='arrange'} disabled={busy} renderCell={previewSVG} onEditCell={editPreviewCell} onArrange={applyArrangement} onDelete={deleteWord} onStartArrange={()=>setPreviewMode('arrange')} onPageChange={setPreviewPage} active={active} repeat={repeat} index={index}/></>}</div>}</div></section>
 </div></div>
 <Dialog open={!!deleteTarget} onOpenChange={open=>{if(!open&&!operation.current)setDeleteTarget(null)}}><DialogContent className="max-h-[85dvh] overflow-y-auto" showCloseButton={!busy} onCloseAutoFocus={event=>{event.preventDefault();if(deleteOpener.current&&!deleteOpener.current.disabled)deleteOpener.current.focus();else editorBody.current?.querySelector('[aria-label="已存學習單設定"]')?.focus()}}>
 <DialogTitle className="text-xl">{deleteTarget?.legacy?'刪除早期原始學習單設定':'刪除已存學習單設定'}</DialogTitle><DialogDescription>確定刪除{deleteTarget?.legacy?'早期原始設定':''}「{deleteTarget?.title}」嗎？刪除後無法復原這筆已存設定。目前編輯中的語詞、排版與提示會保留，可再儲存為新的學習單。</DialogDescription>
 {deleteError&&<p role="alert" className="text-red-800">{deleteError}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={()=>setDeleteTarget(null)}>取消刪除</button><button type="button" className={button+' border-red-700 text-red-800'} disabled={busy} onClick={deleteWorksheet}>{busy?'正在刪除…':'確認刪除已存設定'}</button></div>
 </DialogContent></Dialog>
 <Dialog open={copyOpen} onOpenChange={open=>{if(!open)closeCopy()}}><DialogContent className="max-h-[85dvh] overflow-y-auto" showCloseButton={!busy} onCloseAutoFocus={event=>{event.preventDefault();copyOpener.current?.focus()}}>
 <DialogTitle className="text-xl">複製這份學習單</DialogTitle>{!!missingSource.length&&<p role="alert" className="text-amber-900">副本只包含目前可顯示的 {entries.length} 個語詞；缺漏的語詞不會加入，原始已存設定保留。</p>}<DialogDescription>將目前內容另存成一份新學習單，包含尚未儲存的修改。語詞順序、逐格提示與排版都會保留，原本已儲存的版本不會被覆蓋。</DialogDescription>
 <form onSubmit={copyWorksheet} className="space-y-4"><label className="block font-bold" htmlFor="copybook-copy-title">副本名稱<input id="copybook-copy-title" className={input+' block w-full mt-2 font-normal'} maxLength={45} required value={copyTitle} disabled={busy||copyPending} onChange={e=>{if(!operation.current&&!copyRequest.current)setCopyTitle(e.target.value)}}/></label>
 {copyPending&&<p role="status" className="text-amber-900">重試會確認同一份副本，不會重複新增。名稱及內容暫時保留準備時的版本，確認後可再修改。</p>}{(copyStorageBlocked||copyUnprotected)&&<p className="font-bold text-amber-900">此瀏覽器目前無法保留副本重試資料。若選擇仍另存，請留在本頁確認結果；關閉或重整後無法保證恢復這次請求。</p>}{copyError&&<p role="alert" className="text-red-800">{copyError}</p>}<div className="flex flex-wrap justify-end gap-2"><button type="button" className={button} disabled={busy} onClick={closeCopy}>{copyPending?'先關閉，稍後確認':'取消'}</button>{copyPending&&!copyRequest.current?.dispatched&&<button type="button" className={button} disabled={busy} onClick={()=>{copyRequest.current=null;setCopyPending(false);setCopyStorageBlocked(false);setCopyUnprotected(false);setCopyError('');setStatus('已取消尚未傳送的副本，目前編輯內容保留。')}}>取消這次副本</button>}{copyStorageBlocked&&<button type="button" className={button+' border-amber-700 text-amber-950'} disabled={busy} onClick={()=>copyWorksheet(null,{allowUnprotected:true})}>仍另存副本（無本機恢復保護）</button>}<button type="submit" className={button+' border-blue-700 text-blue-900'} disabled={busy||!copyPending&&!copyTitle.trim()}>{busy?'正在確認並另存…':copyPending?'重試確認副本':'另存副本'}</button></div></form>
 </DialogContent></Dialog>
 </section>
}

