export const PALETTE=['#ff6699','#56b4e9','#009e73','#f0e442','#ff9933','#ffbaa3','#9169ec','#7b92be'];
export const GLYPH_SCALE=.34375;
export const glyphPoint=(p:number[])=>({x:84+p[0]*GLYPH_SCALE,y:393.375-p[1]*GLYPH_SCALE});
export type InkLine={color:number;width:number;points:number[][]};
export function segmentDistance(p:number[],a:number[],b:number[]){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);}
export function inkCoverage(medians:number[][][],ink:InkLine[]){return medians.map(line=>{const samples:number[][]=[];line.forEach((b,i)=>{if(!i){samples.push(b);return;}const a=line[i-1],n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/12));for(let j=1;j<=n;j++)samples.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);});const counts=Array(8).fill(0);for(const point of samples){for(let i=ink.length-1;i>=0;i--){const l=ink[i];const hit=l.points.length===1?Math.hypot(point[0]-l.points[0][0],point[1]-l.points[0][1])<=l.width/2:l.points.some((b,j)=>j>0&&segmentDistance(point,l.points[j-1],b)<=l.width/2);if(hit){if(l.color>=0)counts[l.color]++;break;}}}return counts.map(n=>n/(samples.length||1));});}
export function coverageMapping(coverage:number[][]){return coverage.map(row=>{const best=Math.max(...row);return best>=.65?row.indexOf(best):-1;});}
export function trayLayout(groups:number[],bounds:Record<number,{cx:number;cy:number;width:number;height:number}>,random=Math.random){const columns=groups.length>4?3:2,cellWidth=480/columns,rows=Math.ceil(groups.length/columns),height=570+rows*185;const order=[...groups];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}const positions:Record<number,{x:number;y:number;scale:number}>={};order.forEach((g,i)=>{const b=bounds[g];positions[g]={x:20+cellWidth*(i%columns+.5),y:590+185*Math.floor(i/columns)+65,scale:Math.min(1,(cellWidth-42)/b.width,130/b.height)};});return {positions,height,columns,rows,cellWidth};}
export function assemblyTrayLayout(groups:number[],bounds:Record<number,{cx:number;cy:number;width:number;height:number}>,side:'bottom'|'left'|'right'='bottom',random=Math.random){
 if(side==='bottom'){
  const layout=trayLayout(groups,bounds,random);
  return {...layout,viewBox:`0 0 520 ${layout.height}`,frame:{x:16,y:515,width:488,height:layout.height-523},label:{x:36,y:550},cells:groups.map((_,i)=>({x:24+(i%layout.columns)*layout.cellWidth,y:579+Math.floor(i/layout.columns)*185,width:layout.cellWidth-12,height:165}))};
 }
 const left=side==='left',x=left?-272:528,columns=groups.length>3?2:1,rows=Math.max(1,Math.ceil(groups.length/columns)),cellWidth=232/columns,cellHeight=416/rows;
 const order=[...groups];for(let i=order.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
 const cells=groups.map((_,i)=>({x:x+12+(i%columns)*cellWidth,y:72+Math.floor(i/columns)*cellHeight,width:cellWidth-8,height:cellHeight-8}));
 const positions:Record<number,{x:number;y:number;scale:number}>={};order.forEach((g,i)=>{const cell=cells[i],b=bounds[g];positions[g]={x:cell.x+cell.width/2,y:cell.y+cell.height/2,scale:Math.min(1,(cell.width-20)/b.width,(cell.height-20)/b.height)};});
 return {positions,height:520,columns,rows,cellWidth,viewBox:`${left?-280:0} 0 800 520`,frame:{x,y:16,width:256,height:488},label:{x:x+16,y:49},cells};
}
export const nearTarget=(p:{x:number;y:number},b:{cx:number;cy:number})=>Math.hypot(p.x-b.cx,p.y-b.cy)<35;

export function matchesStroke(line:number[][],median:number[][]){
 if(line.length<2||median.length<2)return false;
 const distance=(a:number[],b:number[])=>Math.hypot(a[0]-b[0],a[1]-b[1]);
 const length=(points:number[][])=>points.slice(1).reduce((n,p,i)=>n+distance(p,points[i]),0);
 const expectedLength=length(median),actualLength=length(line);
 if(distance(median[0],median.at(-1)!)>15&&distance(line[0],median[0])+distance(line.at(-1)!,median.at(-1)!)>distance(line[0],median.at(-1)!)+distance(line.at(-1)!,median[0]))return false;
 if(actualLength<expectedLength*.4||actualLength>expectedLength*2.4)return false;
 const startTolerance=Math.min(145,Math.max(50,expectedLength*.28));
 if(distance(line[0],median[0])>startTolerance||distance(line.at(-1)!,median.at(-1)!)>160)return false;
 const samples:number[][]=[];median.forEach((b,i)=>{if(!i){samples.push(b);return;}const a=median[i-1],n=Math.max(1,Math.ceil(distance(a,b)/25));for(let j=1;j<=n;j++)samples.push([a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n]);});
 const near=(p:number[],path:number[][])=>Math.min(...path.slice(1).map((b,i)=>segmentDistance(p,path[i],b)));
 return line.filter(p=>near(p,median)<125).length/line.length>=.8&&samples.filter(p=>near(p,line)<145).length/samples.length>=.8;
}
