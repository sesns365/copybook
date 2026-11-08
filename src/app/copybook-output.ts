// @ts-nocheck
// 簡易與進階模式共用：把每頁版面轉成圖片，再輸出 PDF 或送到印表機。
import {bookPageSVG, svgPNG, downloadBlob} from './copybook-export';
import {imagePDF} from './worksheet-pdf';

export async function renderPageImages(plan, data, options, teaching, extra = []) {
  await document.fonts.ready;
  const images = [];
  const svgs = [...plan.pages.map((_, page) => bookPageSVG(plan, page, data, options, teaching)), ...extra];
  for (const svg of svgs) {
    const png = await svgPNG(svg, 1);
    const url = URL.createObjectURL(new Blob([png], {type: 'image/png'}));
    try {
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(resolve => c.toBlob(resolve, 'image/jpeg', .92));
      images.push({bytes: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height, blob});
    } finally { URL.revokeObjectURL(url); }
  }
  return images;
}

export async function downloadPDF(plan, data, options, teaching, extra = []) {
  const images = await renderPageImages(plan, data, options, teaching, extra);
  downloadBlob(imagePDF(images, plan.paper), (options.title || '生字學習單') + '.pdf');
}

// 用隱藏的 iframe 列印，不會被彈出視窗封鎖。
export async function printPages(plan, data, options, teaching, extra = []) {
  const images = await renderPageImages(plan, data, options, teaching, extra);
  const urls = images.map(im => URL.createObjectURL(im.blob));
  const {width, height} = plan.paper;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><title>${String(options.title || '生字學習單').replace(/[<&]/g, '')}</title><style>@page{size:${width}mm ${height}mm;margin:0}html,body{margin:0;padding:0}img{display:block;width:${width}mm;height:${height}mm;page-break-after:always;break-after:page}img:last-child{page-break-after:auto;break-after:auto}</style></head><body>${urls.map(u => `<img src="${u}">`).join('')}</body></html>`);
  doc.close();
  await Promise.all([...doc.images].map(img => img.complete ? null : new Promise(r => { img.onload = r; img.onerror = r; })));
  const cleanup = () => { setTimeout(() => { urls.forEach(u => URL.revokeObjectURL(u)); frame.remove(); }, 1000); };
  frame.contentWindow.addEventListener('afterprint', cleanup);
  frame.contentWindow.focus();
  frame.contentWindow.print();
  setTimeout(cleanup, 120000);
}
