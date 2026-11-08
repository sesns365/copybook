// Physical sizes are shared by pagination, the full-page preview and both exports.
export function copybookPaper(options:any={}){
 const size=options?.paperSize==='A3'?'A3':'A4',width=size==='A3'?297:210,height=size==='A3'?420:297;
 return {size,width,height,left:14,right:14,top:12,bottom:12,contentWidth:width-28,contentHeight:height-37,footerY:height-7.2};
}
export function copybookCellSize(options:any={}){
 const size=Number(options?.cellSize);return [15,20,25,30].includes(size)?size:20;
}
export function copybookCrossOpacity(options:any={}){
 // The old #ccc line is equivalent to 20% black on the white paper.
 const raw=options?.crossOpacity;if(raw===undefined||raw===null||raw==='')return .2;
 const value=Number(raw);return Number.isFinite(value)?Math.min(1,Math.max(0,value)):.2;
}
