// PDF pages (A4 by default) embed locally rendered character paths; no student data leaves the site.
export function imagePDF(images:{bytes:Uint8Array;width:number;height:number;paper?:{width:number;height:number}}[],paper:{width:number;height:number}={width:210,height:297}){
 const pageSize=(value:{width:number;height:number})=>({width:Number.isFinite(value?.width)&&value.width>0?+(value.width*72/25.4).toFixed(2):595.28,height:Number.isFinite(value?.height)&&value.height>0?+(value.height*72/25.4).toFixed(2):841.89});
 const enc=new TextEncoder(),chunks:Uint8Array[]=[],offsets=[0];let length=0;
 const write=(v:string|Uint8Array)=>{const b=typeof v==='string'?enc.encode(v):v;chunks.push(b);length+=b.length;};
 const object=(id:number,body:string)=>{offsets[id]=length;write(`${id} 0 obj\n${body}\nendobj\n`);};
 write('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
 images.forEach((im,i)=>{const {width,height}=pageSize(im.paper||paper),n=3+i*3;object(n,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im ${n+2} 0 R >> >> /Contents ${n+1} 0 R >>`);const stream=`q ${width} 0 0 ${height} 0 0 cm /Im Do Q`;object(n+1,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);offsets[n+2]=length;write(`${n+2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${im.width} /Height ${im.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.bytes.length} >>\nstream\n`);write(im.bytes);write('\nendstream\nendobj\n');});
 const start=length,count=3+images.length*3;write(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)write(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);write(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);return new Blob(chunks.map(c=>new Uint8Array(c)),{type:'application/pdf'});
}
