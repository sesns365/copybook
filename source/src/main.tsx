import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './app/globals.css';
import Copybook from './app/Copybook';
import SimpleCopybook from './app/SimpleCopybook';
import { CurriculumTitleProvider } from './app/CurriculumContext';
import { localApi, exportBackup, importBackup, readRows, readFavorites } from './local-api';

import logoUrl from './assets/logo-badge.png?inline';

const base = import.meta.env.BASE_URL;
const single = import.meta.env.VITE_SINGLE === '1';

function App() {
  const [reloadKey, setReloadKey] = useState(0);
  const [message, setMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [mode, setModeState] = useState<'simple' | 'advanced'>(() => { try { return window.localStorage.getItem('copybook-tool:mode') === 'advanced' ? 'advanced' : 'simple'; } catch { return 'simple'; } });
  const [seed, setSeed] = useState<any>(null);
  const setMode = (m: 'simple' | 'advanced') => { setModeState(m); setMessage(''); try { window.localStorage.setItem('copybook-tool:mode', m); } catch {} window.scrollTo({top: 0}); };

  const onImport = async (file?: File) => {
    if (!file) return;
    if (dirty && !window.confirm('目前有尚未儲存的修改，匯入後畫面會重新整理。要繼續嗎？')) return;
    try {
      const added = await importBackup(file);
      setMessage(`已匯入 ${added} 份學習單（常用設定也一併匯入），可在「開啟或管理已存學習單」中選取。`);
      setReloadKey(k => k + 1);
    } catch (e: any) {
      setMessage('匯入失敗：' + (e?.message || '檔案格式不正確'));
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const btn = 'rounded-xl border-2 bg-white px-3 py-1.5 text-sm font-bold hover:bg-slate-50';
  return (
    <CurriculumTitleProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="relative border-b bg-white">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 pr-20">
            <h1 className="min-w-0 text-2xl font-bold">直式生字學習單製作工具</h1>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="操作模式" className="flex rounded-xl border-2 bg-slate-100 p-1">
                {([['simple', '簡易模式'], ['advanced', '進階模式']] as const).map(([m, label]) => <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={'min-h-9 rounded-lg px-3 py-1.5 text-sm font-bold ' + (mode === m ? 'bg-white text-blue-900 shadow' : 'text-slate-600 hover:text-slate-900')}>{label}</button>)}
              </div>
              {mode === 'advanced' && <><button type="button" className={btn} onClick={() => { const n = readRows().length, f = readFavorites().length; if (!n && !f) { setMessage('目前沒有已儲存的學習單或常用設定可以備份。'); return; } exportBackup(); setMessage(`已下載備份檔：${n} 份學習單${f ? `、${f} 組常用設定` : ''}。`); }}>下載備份檔</button>
              <button type="button" className={btn} onClick={() => fileInput.current?.click()}>匯入備份檔</button>
              <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={e => onImport(e.target.files?.[0])} /></>}
            </div>
          </div>
          <img src={logoUrl} alt="特工365" className="pointer-events-none absolute right-4 top-1/2 h-14 w-14 -translate-y-1/2 opacity-80 max-sm:right-2.5 max-sm:h-11 max-sm:w-11" />
        </header>
        <main className="mx-auto max-w-[1600px] px-4 py-4 max-lg:pb-24">
          <div hidden={mode !== 'simple'}><SimpleCopybook onAdvanced={(doc: any) => { if (doc.extraSaved?.length) { setReloadKey(k => k + 1); setMessage(`已開啟 A 版；${doc.extraSaved.join('、')} 版已另存，可在「開啟或管理已存學習單」找到。`); } setSeed({...doc, nonce: Date.now()}); setModeState('advanced'); try { window.localStorage.setItem('copybook-tool:mode', 'advanced'); } catch {} window.scrollTo({top: 0}); }} /></div>
          <div hidden={mode !== 'advanced'}>
            <p className="mb-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-950">
              進階模式可拖曳排版、逐字逐格調整並儲存多份學習單。儲存的設定只留在這台裝置的這個瀏覽器，換電腦前請按右上「下載備份檔」。
              {message && <strong className="ml-2" role="status">{message}</strong>}
            </p>
            <Copybook key={reloadKey} seed={seed} api={localApi} classroomId="local" userId="teacher" onDirty={setDirty} />
          </div>
        </main>
        <footer className="mx-auto max-w-[1600px] px-4 pb-8 text-xs text-slate-500">
          {single ? <>筆畫資料來源：Make Me a Hanzi、Hanzi Writer Data（ARPHIC PL）、教育部標準楷書與補充資料（授權條款見網站版 licenses 資料夾）。</> : <>
          筆畫資料來源與授權：
          <a className="underline" href={base + 'licenses/makemeahanzi-COPYING.txt'}>Make Me a Hanzi</a>、
          <a className="underline" href={base + 'licenses/hanzi-writer-data-ARPHICPL.txt'}>Hanzi Writer Data（ARPHIC PL）</a>、
          <a className="underline" href={base + 'licenses/moe-standard-kai.txt'}>教育部標準楷書</a>、
          <a className="underline" href={base + 'licenses/moe-supplement-attribution.txt'}>教育部補充資料</a>。
          </>}
          <p className="mt-1">各版本語詞依課本整理，僅供教學練習使用。</p>
        </footer>
      </div>
    </CurriculumTitleProvider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
