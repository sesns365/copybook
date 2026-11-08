// @ts-nocheck
import zhuyinPaths from './zhuyin-paths.json';
import {copybookPaper,copybookCellSize,copybookCrossOpacity} from './copybook-paper';
import {copybookComponentMapping} from './copybook-grouping';
const esc=s=>String(s).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
export const BOOK_DEFAULTS={title:'南一五上 語詞生字本',worksheetType:'copybook',defaultMode:'trace',contentMode:'word',titlePosition:'top',titleCustom:false,titleFontSize:18,titleLetterSpacing:1,fieldDirection:'horizontal',fieldSpace:38,titleName:true,titleClass:true,titleDate:true,paperSize:'A4',crossOpacity:.2,cellSize:20,repetitions:3,showModel:true,blankLast:false,showZhuyin:true,wordsPerColumn:1,wordGap:1,orderVersion:1,items:{}};
const count=n=>Math.max(1,Math.min(20,Math.round(Number(n)||1)));
export function bookStoredItem(entry,options){const saved=options.items?.[entry.id]||{},changed=saved.word&&saved.word!==entry.word;return {...saved,word:entry.word,...(changed?{targetIdx:entry.targetIdx,mapping:null,characters:{},cells:{}}:{}),...(saved.targetIdx>=entry.word.length?{targetIdx:entry.targetIdx,mapping:null}:{})};}
export function bookItem(entry,options){const saved=bookStoredItem(entry,options),mode=saved.mode??options.defaultMode??(options.worksheetType==='parts'||(!options.worksheetType&&options.contentMode==='character')?'parts':'trace');return {targetIdx:entry.targetIdx,styles:mode==='parts'?{0:'black',1:'gray'}:{},...saved,mode};}
export function bookCount(entry,options){return count(bookItem(entry,options).repetitions??options.repetitions)}
export function bookCells(entry,options){
 const cfg=bookItem(entry,options),times=bookCount(entry,options),syllables=entry.pinyin.split(/\s+/),cells=[];
 const indices=options.contentMode==='character'?[cfg.targetIdx]:[...entry.word].map((_,i)=>i);
 for(let n=0;n<times;n++)for(const i of indices){const target=i===cfg.targetIdx;let mode=target?cfg.mode:'model';if(options.showModel&&n===0)mode='model';if(options.blankLast&&n===times-1&&target)mode='blank';
 cells.push({char:entry.word[i],pinyin:syllables[i]||'',target,mode,styles:target?cfg.styles:{},mapping:target?cfg.mapping:undefined,showZhuyin:options.showZhuyin,...cfg.characters?.[i],...cfg.cells?.[`${n}:${i}`],entryId:entry.id,repeat:n,charIndex:i,key:`${n}:${i}`});}return cells;
}
export function orderedBookEntries(all,selected){const lookup=new Map(all.map(e=>[e.id,e]));return [...new Set(selected)].map(id=>lookup.get(id)).filter(Boolean);}
export function bookCellLocation(plan,entryId,repeat,charIndex){
 for(let page=0;page<plan.pages.length;page++){
  let column=0;
  for(const col of plan.pages[page]){
   if(col.title)continue;
   column++;
   const row=col.cells.findIndex(c=>c.entryId===entryId&&c.repeat===repeat&&c.charIndex===charIndex);
   if(row>=0)return {page,column,row:row+1};
  }
 }
 return null;
}
export function moveBookEntry(ids,id,to){const next=[...ids],from=next.indexOf(id);if(from<0)return next;next.splice(from,1);next.splice(Math.max(0,Math.min(next.length,to)),0,id);return next;}
export function normalizedBookGroups(entries,groups){const valid=new Set(entries.map(e=>e.id)),seen=new Set(),result=[];for(const group of Array.isArray(groups)?groups:[]){if(!Array.isArray(group))continue;const ids=group.filter(id=>valid.has(id)&&!seen.has(id)&&seen.add(id));if(ids.length)result.push(ids);}for(const e of entries)if(!seen.has(e.id)){result.push([e.id]);seen.add(e.id)}return result;}
export function bookColumns(entries,options){
 const paper=copybookPaper(options),cellSize=copybookCellSize(options);
 options={...options,cellSize};
 // Reserve the same physical margins, image-paragraph room and footer on each paper size.
 const headerHeight=options.titlePosition==='top'?headerLayout(options).height:0,rows=Math.max(1,Math.floor((paper.contentHeight-headerHeight)/cellSize)),cols=[],tooLong=[],manual=Array.isArray(options.manualColumns);
 const limit=manual?0:[0,1,2,3].includes(options.wordsPerColumn)?options.wordsPerColumn:1,gap=[0,1,2].includes(options.wordGap)?options.wordGap:1;
 const blank=()=>({char:'',pinyin:'',mode:'blank',showZhuyin:false});let current={cells:[],entryIds:[]},packingGroup=0;
 const flush=()=>{if(!current.cells.length)return;cols.push({...current,groupIndex:packingGroup,cells:[...current.cells,...Array.from({length:rows-current.cells.length},blank)]});current={cells:[],entryIds:[]};};
 const pack=entry=>{
  const cells=bookCells(entry,options),length=options.contentMode==='character'?1:entry.word.length;
  if(length>rows)tooLong.push(entry.word);
  if((!manual&&bookItem(entry,options).newColumn)||(limit&&current.entryIds.length>=limit))flush();
  if(cells.length<=rows){
   const space=current.cells.length?gap:0;if(current.cells.length+space+cells.length>rows)flush();
   if(current.cells.length)current.cells.push(...Array.from({length:gap},blank));
   current.cells.push(...cells);current.entryIds.push(entry.id);
  }else{
   flush();const chunk=length<=rows?Math.floor(rows/length)*length:rows;
   for(let start=0;start<cells.length;start+=chunk){if(current.cells.length)flush();current={cells:cells.slice(start,start+chunk),entryIds:[entry.id]};}
  }
 };
 let groups;
 if(manual){groups=normalizedBookGroups(entries,options.manualColumns);const lookup=new Map(entries.map(e=>[e.id,e]));groups.forEach((group,i)=>{packingGroup=i;group.forEach(id=>pack(lookup.get(id)));flush()});}
 else{entries.forEach(pack);flush();groups=[];for(const col of cols){const existing=groups.find(g=>g.some(id=>col.entryIds.includes(id)));if(existing){for(const id of col.entryIds)if(!existing.includes(id))existing.push(id)}else groups.push([...col.entryIds]);}for(const col of cols)col.groupIndex=groups.findIndex(g=>g.includes(col.entryIds[0]));}
 const offsets=new Map();for(const col of cols){col.groupOffset=offsets.get(col.groupIndex)||0;offsets.set(col.groupIndex,col.groupOffset+1)}
 const rail=cols.some(c=>c.cells.some(x=>x.showZhuyin)),side=['right','left'].includes(options.titlePosition??'right'),width=options.cellSize*(rail?1.25:1),perPage=Math.max(1,Math.floor(paper.contentWidth/width)-(side?1:0)),pages=Array.from({length:Math.ceil(cols.length/perPage)},(_,i)=>{const page=cols.slice(i*perPage,(i+1)*perPage);if(side){const title={title:true,cells:Array.from({length:rows},(_,row)=>({kind:'title',row,rows,page:i+1}))};if((options.titlePosition??'right')==='right')page.unshift(title);else page.push(title)}return page});return {paper,cellSize,rows,perPage,pages,groups,rail,width,headerHeight,tooLong,renderOptions:{...options,rail},totalCells:cols.flatMap(c=>c.cells).filter(c=>c.char).length};
}
export function arrangeBookWord(entries,options,id,target){
 const plan=bookColumns(entries,options),groups=plan.groups.map(g=>[...g]),source=groups.findIndex(g=>g.includes(id));
 if(source<0||!target||!Number.isInteger(target.groupIndex)||target.groupIndex<0||target.groupIndex>(target.newColumn?groups.length:groups.length-1))return {error:'請選擇學習單上的放置位置。'};
 if(target.beforeId===id&&source===target.groupIndex)return {unchanged:true};
 groups[source]=groups[source].filter(x=>x!==id);
 if(target.newColumn)groups.splice(target.groupIndex,0,[id]);
 else{const group=groups[target.groupIndex],at=target.beforeId?group.indexOf(target.beforeId):group.length;if(at<0)return {error:'放置位置已更新，請重新選擇。'};group.splice(at,0,id);}
 const next=groups.filter(g=>g.length),nextOptions={...options,manualColumns:next};
 if(JSON.stringify(next)===JSON.stringify(plan.groups))return {unchanged:true};
 if(!target.newColumn){
  const after=bookColumns(entries,nextOptions),destination=next.findIndex(g=>g.includes(id)),columns=after.pages.flat().filter(c=>!c.title&&c.groupIndex===destination),old=plan.pages.flat().filter(c=>!c.title&&c.groupIndex===target.groupIndex),offset=columns.findIndex(c=>c.entryIds.includes(id));
  if(columns.length>old.length||offset!==(target.groupOffset??0))return {error:'這一欄放不下整組練習，請減少語詞練習次數，或放到新欄。'};
 }
 return {options:nextOptions,selected:next.flat()};
}
const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.max(min,Math.min(max,Number(value))):fallback;
const titleFields=options=>[options.titleClass!==false?'班級':null,options.titleName!==false?'姓名':null,options.titleDate!==false?'日期':null].filter(Boolean);
const titleStyle=options=>({font:bounded(options.titleFontSize,18,12,28)*25.4/72,gap:bounded(options.titleLetterSpacing,1,0,4),space:bounded(options.fieldSpace,38,28,48)});
export function titleLayout(cell,options){
 const size=copybookCellSize(options),width=size*(options.rail?1.25:1),height=cell.rows*size,fields=titleFields(options),style=titleStyle(options),chars=[...(options.title||'')],fieldHeight=Math.min(style.space,(height-45)/Math.max(1,fields.length)),fieldTop=height-11-fields.length*fieldHeight,available=Math.max(12,fieldTop-12),innerWidth=width-6;
 let best={font:style.font,gap:style.gap,columns:1,perColumn:chars.length};
 if(chars.length){best.font=0;for(let columns=1;columns<=Math.min(4,chars.length);columns++){const perColumn=Math.ceil(chars.length/columns),scale=Math.min(1,innerWidth/(columns*style.font+(columns-1)*2),available/(perColumn*style.font+(perColumn-1)*style.gap));if(style.font*scale>best.font)best={font:style.font*scale,gap:style.gap*scale,columns,perColumn}}}
 return {width,height,fields,fieldHeight,fieldTop,chars,...best};
}
function fieldSVG(label,x,y,width,height,options,unit){
 const vertical=options.fieldDirection!=='horizontal',font=4.2*unit;
 const text=vertical?[...label].map((c,i)=>`<text x="${(x+width-4)*unit}" y="${(y+6+i*5.2)*unit}" font-size="${font}">${c}</text>`).join(''):`<text x="${(x+width/2)*unit}" y="${(y+6)*unit}" font-size="${font}">${label}</text>`;
 const line=vertical?`M${(x+4)*unit} ${(y+5)*unit}V${(y+height-4)*unit}`:`M${(x+3)*unit} ${(y+height-5)*unit}H${(x+width-3)*unit}`;
 const value=String(options.fieldValues?.[label]||'').slice(0,80),chars=[...value],columns=chars.length>6?2:1,perColumn=Math.ceil(chars.length/columns),valueFont=Math.min(3.8,(height-9)/Math.max(1,perColumn),(width-10)/(columns+0.5));
 const filled=!value?'':vertical?chars.map((c,i)=>`<text x="${(x+width/2-2+(columns-1)*valueFont/2-Math.floor(i/perColumn)*valueFont)*unit}" y="${(y+5+(i%perColumn+1)*valueFont)*unit}" font-size="${valueFont*unit}">${esc(c)}</text>`).join(''):`<text x="${(x+width/2)*unit}" y="${(y+height-9)*unit}" font-size="${Math.min(4,(width-6)/Math.max(1,chars.length))*unit}">${esc(value)}</text>`;
 return `<path d="M${(x+2)*unit} ${y*unit}H${(x+width-2)*unit}" stroke="#ccc" stroke-width="${.15*unit}"/>${text}${filled}<path d="${line}" fill="none" stroke="#aaa" stroke-width="${.15*unit}"/>`;
}
export function titleSVG(cell,options){
 const l=titleLayout(cell,options),u=240/copybookCellSize(options),width=l.width*u,h=l.height*u,blockWidth=l.columns*l.font+(l.columns-1)*2;
 let offset=0;const title=l.chars.map((c,i)=>{const col=Math.floor(i/l.perColumn);if(i%l.perColumn===0)offset=0;const y=offset;offset+=titleAdvance(c,true)*l.font+l.gap;return /\s/.test(c)?'':`<text x="${(l.width/2+blockWidth/2-l.font/2-col*(l.font+2))*u}" y="${(5+l.font+y)*u}" font-size="${l.font*u}" font-weight="600">${esc(c)}</text>`}).join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="240" viewBox="0 ${cell.row*240} ${width} 240"><rect width="${width}" height="${h}" fill="white"/><rect x=".7" y=".7" width="${width-1.4}" height="${h-1.4}" fill="none" stroke="#a9a9a9" stroke-width="1.4"/><g font-family="Noto Sans CJK TC,sans-serif" fill="#222" text-anchor="middle">${title}${l.fields.map((label,i)=>fieldSVG(label,0,l.fieldTop+i*l.fieldHeight,l.width,l.fieldHeight,options,u)).join('')}<text x="${width/2}" y="${(l.height-4)*u}" font-size="${3.2*u}">第 ${cell.page} 頁</text></g></svg>`;
}
// 標題中的空白只佔約三分之一字寬，半形數字與英文約六成字寬，避免「第 1 課」看起來太鬆。
const titleAdvance=(c:string,vertical=false)=>/\s/.test(c)?.35:!vertical&&/[\x21-\x7e]/.test(c)?.62:1;
export function headerLayout(options){const contentWidth=copybookPaper(options).contentWidth,fields=titleFields(options),style=titleStyle(options),chars=[...(options.title||'')],units=chars.reduce((sum,c)=>sum+titleAdvance(c),0),natural=units*style.font+Math.max(0,chars.length-1)*style.gap,scale=Math.min(1,(contentWidth-8)/Math.max(1,natural)),font=style.font*scale,gap=style.gap*scale,titleHeight=chars.length?font+7:2,fieldHeight=14;return {contentWidth,fields,chars,font,gap,blockWidth:natural*scale,titleHeight,height:titleHeight+(fields.length?fieldHeight:0)+3,fieldHeight};}
// 頁面上方的資料欄一律橫式：「班級＿＿＿　姓名＿＿＿　日期＿＿＿」。
function topFieldSVG(label,x,y,width,height,options,unit){const font=4.6,labelWidth=[...label].length*font+1.5,lineStart=x+3+labelWidth,lineY=y+height-4,value=String(options.fieldValues?.[label]||'').slice(0,80),valueFont=Math.min(4.4,(x+width-4-lineStart)/Math.max(1,[...value].length));return `<text text-anchor="start" x="${(x+3)*unit}" y="${(lineY-1)*unit}" font-size="${font*unit}">${esc(label)}</text>${value?`<text x="${(lineStart+(x+width-4-lineStart)/2)*unit}" y="${(lineY-1)*unit}" font-size="${valueFont*unit}">${esc(value)}</text>`:''}<path d="M${lineStart*unit} ${lineY*unit}H${(x+width-4)*unit}" fill="none" stroke="#888" stroke-width="${.2*unit}"/>`;}
export function headerSVG(options){const l=headerLayout(options),u=10,width=l.contentWidth*u,height=l.height*u,left=Math.max(4,(l.contentWidth-l.blockWidth)/2);let cursor=left;return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/><g font-family="Noto Sans CJK TC,sans-serif" fill="#222" text-anchor="middle">${l.chars.map(c=>{const w=titleAdvance(c)*l.font,x=cursor+w/2;cursor+=w+l.gap;return /\s/.test(c)?'':`<text x="${x*u}" y="${(3+l.font)*u}" font-size="${l.font*u}" font-weight="600">${esc(c)}</text>`}).join('')}${l.fields.map((label,i)=>topFieldSVG(label,i*l.contentWidth/l.fields.length,l.titleHeight,l.contentWidth/l.fields.length,l.fieldHeight,options,u)).join('')}</g></svg>`;}
export function cellSVG(cell,data,options,teaching={}){if(cell.kind==='title')return titleSVG(cell,options);const rail=options.rail??options.showZhuyin,width=rail?300:240,strokes=data[cell.char]?.strokes,mapping=strokes?(cell.mapping?.length===strokes.length?cell.mapping:copybookComponentMapping(cell.char,strokes.length,options,teaching)):[];const fill=i=>cell.mode==='model'?'#222':cell.mode==='trace'?'#da8e8e':cell.mode==='gray'?'#c2c2c2':cell.mode==='blank'?'none':({black:'#222',gray:'#c2c2c2',red:'#da8e8e',blank:'none'}[cell.styles?.[mapping[i]]]|| (mapping[i]===0?'#222':'none'));
let glyph=strokes?`<g transform="translate(8.3,208.4) scale(.21818,-.21818)">${strokes.map((p,i)=>`<path d="${esc(p)}" fill="${fill(i)}"/>`).join('')}</g>`:cell.char&&['model','trace','gray'].includes(cell.mode)?`<text x="120" y="175" text-anchor="middle" font-family="DFKai-SB,Kaiti TC,serif" font-size="195" fill="${cell.mode==='trace'?'#da8e8e':cell.mode==='gray'?'#c2c2c2':'#222'}">${esc(cell.char)}</text>`:'';
const zh=(c,x,y,size)=>{const g=zhuyinPaths.glyphs[c];return g?`<g transform="translate(${x},${y}) scale(${size/zhuyinPaths.units},${-size/zhuyinPaths.units})"><path d="${g.path}" fill="#222"/></g>`:''};
let phonetic='';if(rail&&(cell.showZhuyin??options.showZhuyin)&&cell.pinyin){const symbols=[...cell.pinyin.replace(/[ˊˇˋ˙]/g,'')],tone=cell.pinyin.match(/[ˊˇˋ˙]/)?.[0],h=40,start=(240-symbols.length*h)/2+30;phonetic=symbols.map((c,i)=>zh(c,253,start+i*h,34)).join('');if(tone==='˙')phonetic+=zh(tone,264,start-23,28);else if(tone)phonetic+=zh(tone,279,start+(symbols.length-1)*h-10,25);}
return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="240" viewBox="0 0 ${width} 240"><rect width="${width}" height="240" fill="white"/><rect x=".7" y=".7" width="${width-1.4}" height="238.6" fill="none" stroke="#a9a9a9" stroke-width="1.4"/><path d="M120 0V240M0 120H240" fill="none" stroke="#000" stroke-opacity="${copybookCrossOpacity(options)}" stroke-dasharray="5 5"/>${rail?'<path d="M240 0V240" stroke="#a9a9a9"/>':''}${glyph}${phonetic}</svg>`;}
// Full-page preview and PDF share these exact millimetre placements.
export function bookPageLayout(plan,page){
 const paper=plan.paper||copybookPaper(plan.renderOptions),size=plan.cellSize||copybookCellSize(plan.renderOptions),cells=[];
 for(let column=0;column<(plan.pages[page]||[]).length;column++)for(let row=0;row<plan.rows;row++)cells.push({cell:plan.pages[page][column].cells[row],x:paper.width-paper.right-(column+1)*plan.width,y:paper.top+plan.headerHeight+row*size,width:plan.width,height:size});
 return {paper,cells,header:plan.headerHeight?{x:paper.left,y:paper.top,width:paper.contentWidth,height:plan.headerHeight}:null};
}
export function bookPageSVG(plan,page,data,options=plan.renderOptions,teaching={}){
 const {paper,cells,header}=bookPageLayout(plan,page),embed=(svg,box)=>svg.replace(/width="[^"]+" height="[^"]+"/,`x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}"`),pixelScale=1500/210;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(paper.width*pixelScale)}" height="${Math.round(paper.height*pixelScale)}" viewBox="0 0 ${paper.width} ${paper.height}"><rect width="${paper.width}" height="${paper.height}" fill="white"/>${header?embed(headerSVG(options),header):''}${cells.map(box=>embed(cellSVG(box.cell,data,plan.renderOptions,teaching),box)).join('')}<text x="${paper.left}" y="${paper.footerY}" fill="#222" font-size="2.8" font-family="Noto Sans CJK TC,sans-serif">第 ${page+1}／${plan.pages.length} 頁</text></svg>`;
}
export async function svgPNG(svg,pixelRatio=2){const img=new Image(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url});const c=document.createElement('canvas');c.width=img.width*pixelRatio;c.height=img.height*pixelRatio;c.getContext('2d').drawImage(img,0,0,c.width,c.height);return new Uint8Array(await (await new Promise(resolve=>c.toBlob(resolve,'image/png'))).arrayBuffer());}finally{URL.revokeObjectURL(url)}}
const encoder=new TextEncoder();
export function zipFiles(files){const parts=[],central=[],offsets=[];let offset=0;const u16=n=>[n&255,n>>>8&255],u32=n=>[n&255,n>>>8&255,n>>>16&255,n>>>24&255];const crc=data=>{let c=0xffffffff;for(const n of data){c^=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;}return (c^0xffffffff)>>>0};for(const [name,source]of Object.entries(files)){const data=typeof source==='string'?encoder.encode(source):source,n=encoder.encode(name),c=crc(data),header=new Uint8Array([80,75,3,4,...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(c),...u32(data.length),...u32(data.length),...u16(n.length),...u16(0),...n]);parts.push(header,data);const record=new Uint8Array([80,75,1,2,...u16(20),...u16(20),...u16(0x800),...u16(0),...u16(0),...u16(0),...u32(c),...u32(data.length),...u32(data.length),...u16(n.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...n]);central.push(record);offset+=header.length+data.length;}const length=central.reduce((n,p)=>n+p.length,0);return new Blob([...parts,...central,new Uint8Array([80,75,5,6,...u16(0),...u16(0),...u16(central.length),...u16(central.length),...u32(length),...u32(offset),...u16(0)])],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})}
export async function bookDOCX(entries,options,data,teaching={},renderer=svgPNG){const plan=bookColumns(entries,options),files={},media=new Map(),rels=[];if(plan.tooLong.length)throw Error('語詞超過一欄，請縮小字格：'+plan.tooLong.join('、'));let counter=0,docId=0;
 const image=async(svg)=>{if(media.has(svg))return media.get(svg);const id=++counter;files[`word/media/cell${id}.png`]=await renderer(svg);rels.push(`<Relationship Id="img${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/cell${id}.png"/>`);media.set(svg,id);return id};
 const picture=(id,cx,cy,name)=>`<w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${++docId}" name="${esc(name)}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="0" name="cell${id}.png"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="img${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
 const size=plan.cellSize,cx=Math.round(plan.width*36000),cy=Math.round(size*36000),twips=Math.round(plan.width*1440/25.4);let body='';
 for(let p=0;p<plan.pages.length;p++){if(p)body+='<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:br w:type="page"/></w:r></w:p>';
 if(options.titlePosition==='top'){const id=await image(headerSVG(options));body+=`<w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr>${picture(id,plan.paper.contentWidth*36000,Math.round(plan.headerHeight*36000),'自訂標題與姓名欄')}</w:p>`;}
 const cols=[...plan.pages[p]].reverse();body+=`<w:tbl><w:tblPr><w:tblW w:w="${cols.length*twips}" w:type="dxa"/><w:jc w:val="right"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="0" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="0" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${cols.map(()=>`<w:gridCol w:w="${twips}"/>`).join('')}</w:tblGrid>`;
 for(let row=0;row<plan.rows;row++){body+='<w:tr><w:trPr><w:cantSplit/></w:trPr>';for(const col of cols){const cell=col.cells[row],id=await image(cellSVG(cell,data,plan.renderOptions,teaching));body+=`<w:tc><w:tcPr><w:tcW w:w="${twips}" w:type="dxa"/></w:tcPr><w:p><w:pPr><w:spacing w:before="0" w:after="0"/><w:rPr><w:sz w:val="2"/><w:szCs w:val="2"/></w:rPr></w:pPr>${picture(id,cx,cy,cell.kind==='title'?'標題欄':cell.char||'空白書寫格')}</w:p></w:tc>`}body+='</w:tr>'}body+='</w:tbl><w:p><w:pPr><w:spacing w:after="0"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr></w:p>'}
files['[Content_Types].xml']='<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>';
files['_rels/.rels']='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="document" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
files['word/_rels/document.xml.rels']=`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="footer1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>${rels.join('')}</Relationships>`;
files['word/styles.xml']='<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:eastAsia="Noto Sans CJK TC"/><w:sz w:val="20"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:before="0" w:after="60"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:pPr><w:spacing w:after="100"/></w:pPr><w:rPr><w:b/><w:color w:val="000000"/><w:sz w:val="28"/></w:rPr></w:style></w:styles>';
files['word/footer1.xml']='<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">第 </w:t></w:r><w:fldSimple w:instr="PAGE"><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>1</w:t></w:r></w:fldSimple><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>／</w:t></w:r><w:fldSimple w:instr="NUMPAGES"><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t>'+plan.pages.length+'</w:t></w:r></w:fldSimple><w:r><w:rPr><w:sz w:val="16"/></w:rPr><w:t xml:space="preserve"> 頁</w:t></w:r></w:p></w:ftr>';
files['word/document.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${body}<w:sectPr><w:footerReference w:type="default" r:id="footer1"/><w:pgSz w:w="${Math.round(plan.paper.width*1440/25.4)}" w:h="${Math.round(plan.paper.height*1440/25.4)}"/><w:pgMar w:top="680" w:right="794" w:bottom="680" w:left="794" w:header="0" w:footer="284"/></w:sectPr></w:body></w:document>`;return zipFiles(files);}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);}
