// 產生單一 HTML 檔：JS、CSS、圖示與筆畫資料（gzip + base64）全部內嵌，可直接雙擊開啟。
import {build} from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const out = 'dist-single';
process.env.VITE_SINGLE = '1';
await build({build: {outDir: out, emptyOutDir: true, copyPublicDir: false, assetsInlineLimit: 1e9, cssCodeSplit: false, modulePreload: false}, logLevel: 'warn'});

let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const read = f => fs.readFileSync(path.join(out, f.replace(/^\.\//, '')), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, f) => `<style>${read(f).replace(/@font-face\{font-family:MOE Standard Kai;[^}]*\}/, '')}</style>`);
let js = '';
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, (_, f) => { js = read(f); return ''; });
const favicon = 'data:image/svg+xml;base64,' + fs.readFileSync('public/favicon.svg').toString('base64');
html = html.replace(/<link rel="icon" href="[^"]+">/, `<link rel="icon" href="${favicon}">`);

const strokes = {};
for (const f of fs.readdirSync('public/strokes')) strokes[f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(path.join('public/strokes', f), 'utf8'));
const gz = zlib.gzipSync(JSON.stringify(strokes), {level: 9}).toString('base64');
const loader = `<script>window.__strokeBundle=(function(){var p;return function(){return p||(p=(async function(){var b=Uint8Array.from(atob(document.getElementById('stroke-data').textContent),function(c){return c.charCodeAt(0)});var s=new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));return JSON.parse(await new Response(s).text())})())}})();</script>`;
const data = `<script type="application/octet-stream" id="stroke-data">${gz}</script>`;
const app = `<script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`;
html = html.replace('</body>', `${data}${loader}${app}</body>`);
fs.writeFileSync('直式生字學習單製作工具.html', html);
console.log('size MB', (Buffer.byteLength(html) / 1048576).toFixed(1));
