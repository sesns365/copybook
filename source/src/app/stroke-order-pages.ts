// @ts-nocheck
// 筆順附頁：每個生字一列，依序畫出第 1、2…筆（之前的筆畫黑色、這一筆紅色），
// 最後幾格淡灰描寫。版面以 mm 計算，與學習單頁面同樣大小，可一起輸出 PDF／列印。
const esc = s => String(s).replace(/[<>&"']/g, c => ({'<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'}[c]));
const PAPER = {width: 210, height: 297, left: 14, right: 14, top: 14, bottom: 14};
const BOX = 12.5, LABEL = 17, GAP = 3, ROW_GAP = 4.5;
const TRACE_BOXES = 3;

function glyph(strokes, x, y, size, color) {
  const k = size / 240;
  return `<g transform="translate(${x + 8.3 * k},${y + 208.4 * k}) scale(${0.21818 * k},${-0.21818 * k})">${strokes.map((p, i) => `<path d="${esc(p)}" fill="${color(i)}"/>`).join('')}</g>`;
}
function box(x, y, size, cross = true) {
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" fill="white" stroke="#9a9a9a" stroke-width=".25"/>` +
    (cross ? `<path d="M${x + size / 2} ${y}V${y + size}M${x} ${y + size / 2}H${x + size}" stroke="#000" stroke-opacity=".18" stroke-width=".2" stroke-dasharray="1 1"/>` : '');
}

// 回傳每個字需要幾列、以及分頁後的 [{char, steps:[...]}] 版面
export function strokeOrderLayout(chars, data) {
  const usable = PAPER.width - PAPER.left - PAPER.right - LABEL - GAP;
  const perLine = Math.floor(usable / BOX);
  const titleH = 14, maxY = PAPER.height - PAPER.bottom - 6;
  const pages = [];
  let page = [], y = PAPER.top + titleH;
  for (const char of chars) {
    const strokes = data[char]?.strokes;
    if (!strokes?.length) continue;
    const boxes = strokes.length + TRACE_BOXES;
    const lines = Math.ceil(boxes / perLine);
    const h = Math.max(LABEL, lines * BOX) + ROW_GAP;
    if (y + h > maxY && page.length) { pages.push(page); page = []; y = PAPER.top + titleH; }
    page.push({char, y, lines});
    y += h;
  }
  if (page.length) pages.push(page);
  return {pages, perLine};
}

export function strokeOrderPageSVG(layout, index, data, title = '筆順練習') {
  const {pages, perLine} = layout, rows = pages[index] || [];
  const scale = 1500 / 210;
  let body = `<text x="${PAPER.width / 2}" y="${PAPER.top + 6}" text-anchor="middle" font-size="6" font-weight="700" font-family="Noto Sans CJK TC,PingFang TC,Microsoft JhengHei,sans-serif" fill="#222">${esc(title)}</text>`;
  body += `<text x="${PAPER.width / 2}" y="${PAPER.top + 11}" text-anchor="middle" font-size="3.2" font-family="Noto Sans CJK TC,PingFang TC,Microsoft JhengHei,sans-serif" fill="#555">紅色是這一筆，照著數字順序寫；最後幾格描寫練習</text>`;
  for (const row of rows) {
    const strokes = data[row.char].strokes, n = strokes.length;
    const lx = PAPER.left, ly = row.y;
    body += box(lx, ly, LABEL) + glyph(strokes, lx, ly, LABEL, () => '#222');
    body += `<text x="${lx + LABEL / 2}" y="${ly + LABEL + 3.4}" text-anchor="middle" font-size="2.8" fill="#555" font-family="sans-serif">${n} 畫</text>`;
    const sx = lx + LABEL + GAP;
    for (let i = 0; i < n + TRACE_BOXES; i++) {
      const x = sx + (i % perLine) * BOX, y = ly + Math.floor(i / perLine) * BOX;
      body += box(x, y, BOX);
      if (i < n) {
        body += glyph(strokes.slice(0, i + 1), x, y, BOX, k => k === i ? '#d33' : '#222');
        body += `<text x="${x + .9}" y="${y + 2.6}" font-size="2.3" fill="#888" font-family="sans-serif">${i + 1}</text>`;
      } else {
        body += glyph(strokes, x, y, BOX, () => '#cfcfcf');
      }
    }
  }
  body += `<text x="${PAPER.left}" y="${PAPER.height - 7.2}" fill="#222" font-size="2.8" font-family="Noto Sans CJK TC,sans-serif">筆順附頁 ${index + 1}／${pages.length}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(PAPER.width * scale)}" height="${Math.round(PAPER.height * scale)}" viewBox="0 0 ${PAPER.width} ${PAPER.height}"><rect width="${PAPER.width}" height="${PAPER.height}" fill="white"/>${body}</svg>`;
}
