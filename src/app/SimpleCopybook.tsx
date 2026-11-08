// @ts-nocheck
"use client";
import React, {useEffect, useMemo, useState} from 'react';
import {Download, Printer, FileText, ChevronLeft, ChevronRight, SlidersHorizontal, X, Maximize2, Link2, Plus, BookOpen, PencilLine, Lightbulb} from 'lucide-react';
import {useCurriculum} from './CurriculumTitle';
import {teachingCurriculum} from './curriculum-settings';
import {DEFAULT_BOOK, BOOKS, PUBLISHERS, GRADE_NAMES, getBook as baseGetBook} from './curriculum-source';
import {loadStrokeData, MISSING_STROKES} from './stroke-data';
import {bookColumns, orderedBookEntries, bookPageSVG, bookDOCX, downloadBlob} from './copybook-export';
import {automaticCopybookTitle} from './copybook-title';
import {SIMPLE_PRESETS, MODE_LABEL, presetSequence, groupWords, buildSimpleDocument, buildZhuyinIndex, guessZhuyin, parseCustomWords, validCustomWord, normalizeZhuyin, missingZhuyin, polyphones, customEntries, customLessonSnapshot, customBookSnapshot, CUSTOM_LESSON_ID, encodeShare, decodeShare} from './simple-copybook';
import {downloadPDF, printPages} from './copybook-output';
import {strokeOrderLayout, strokeOrderPageSVG} from './stroke-order-pages';

const STORE = 'copybook-tool:simple:v1';
const firstLesson = baseGetBook(DEFAULT_BOOK).lessons[0];
const readStore = () => { try { return JSON.parse(window.localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } };
// 分享連結（#ws=...）優先於這台電腦記住的設定
const readShared = () => {
  const m = window.location.hash.match(/^#ws=(.+)$/);
  if (!m) return null;
  const s = decodeShare(m[1]);
  try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch {}
  return s && s.v === 1 ? {lesson: s.l, picked: s.p, custom: s.c, preset: s.s, times: s.t, contentMode: s.m, cellSize: s.z, showZhuyin: s.y, customTitle: s.h, shared: true} : null;
};
const GUIDE = 'copybook-tool:guide-closed';

// 簡易版選課：出版社、年級用按鈕，課次用下拉選單
function SimplePicker({lesson, onChange, getLessonMeta}) {
  const current = getLessonMeta(lesson);
  const book = BOOKS.find(b => b.id === current?.bookId) || BOOKS.find(b => b.id === DEFAULT_BOOK);
  const pick = (publisher, grade) => { const b = BOOKS.find(x => x.publisher === publisher && x.grade === grade); if (b?.lessons.length) onChange(b.lessons[0]); };
  const seg = on => 'rounded-xl border-2 px-4 py-2 font-bold ' + (on ? 'border-blue-700 bg-blue-50 text-blue-900' : 'bg-white hover:bg-slate-50');
  return <div className="space-y-3">
    <div className="space-y-1"><p className="font-bold">出版社</p><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="出版社">{PUBLISHERS.map(p => <button key={p.id} type="button" role="radio" aria-checked={book.publisher === p.id} className={seg(book.publisher === p.id)} onClick={() => pick(p.id, book.grade)}>{p.name}</button>)}</div></div>
    <div className="space-y-1"><p className="font-bold">年級（上學期）</p><div className="flex flex-wrap gap-2" role="radiogroup" aria-label="年級">{GRADE_NAMES.map((n, i) => <button key={n} type="button" role="radio" aria-checked={book.grade === i + 1} className={seg(book.grade === i + 1) + ' min-w-12'} onClick={() => pick(book.publisher, i + 1)}>{n}</button>)}</div></div>
    <label className="block space-y-1"><span className="font-bold">課次</span>
      <select className="block w-full max-w-md rounded-lg border-2 bg-white p-2 text-lg" value={lesson} onChange={e => onChange(e.target.value)}>
        {book.lessons.map(id => { const l = getLessonMeta(id); return <option key={id} value={id}>第 {l.number} 課　{l.title}</option>; })}
      </select></label>
    <p className="text-[15px] text-slate-600">不確定是哪一個版本？看孩子國語課本封面上的出版社和年級。</p>
  </div>;
}

const SWATCH = {
  model: <span className="text-slate-900">字</span>,
  trace: <span style={{color: '#da8e8e'}}>字</span>,
  gray: <span style={{color: '#b5b5b5'}}>字</span>,
  blank: <span className="opacity-0">字</span>,
  parts: <span className="relative inline-block"><span style={{color: '#c2c2c2'}}>字</span><span className="absolute inset-0 text-slate-900" style={{clipPath: 'inset(0 0 55% 0)'}}>字</span></span>,
};

function Sequence({seq, small = false}) {
  return <span className="inline-flex flex-wrap gap-1" aria-hidden="true">{seq.map((m, i) =>
    <span key={i} className={'hanzi-kai inline-flex items-center justify-center border border-slate-400 bg-white leading-none ' + (small ? 'h-7 w-7 text-lg' : 'h-9 w-9 text-2xl')}
      style={{backgroundImage: 'linear-gradient(#0001,#0001),linear-gradient(#0001,#0001)', backgroundSize: '1px 100%,100% 1px', backgroundPosition: 'center', backgroundRepeat: 'no-repeat'}}>{SWATCH[m]}</span>)}</span>;
}

const card = 'rounded-2xl border bg-white p-4 sm:p-5 space-y-4';
const stepTitle = 'flex items-center gap-3 text-xl font-bold';
const stepNo = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-base text-white';
const chip = (on) => 'rounded-xl border-2 px-3 py-2 font-bold ' + (on ? 'border-blue-700 bg-blue-50 text-blue-900' : 'bg-white hover:bg-slate-50');
const btn = 'inline-flex items-center justify-center gap-2 rounded-xl border-2 bg-white px-4 py-2 font-bold hover:bg-slate-50 disabled:opacity-40';

export default function SimpleCopybook({onAdvanced}) {
  const {getBook, getLessonMeta} = useCurriculum();
  const bookAll = useMemo(() => Object.values(teachingCurriculum({}, {}, false)).flat(), []);
  const zi = useMemo(() => buildZhuyinIndex(bookAll), [bookAll]);
  const saved = useMemo(() => readShared() || readStore(), []);
  const [custom, setCustom] = useState(() => (Array.isArray(saved.custom) ? saved.custom : []).filter(c => c && validCustomWord(c.word) && typeof c.id === 'string').map(c => ({...c, pinyin: normalizeZhuyin(c.pinyin || '', c.word.length)})));
  const all = useMemo(() => [...bookAll, ...customEntries(custom)], [bookAll, custom]);
  const byId = useMemo(() => new Map(all.map(e => [e.id, e])), [all]);
  const [source, setSource] = useState('book');
  const [customText, setCustomText] = useState('');
  const [guide, setGuide] = useState(() => { try { return !window.localStorage.getItem(GUIDE); } catch { return true; } });
  const [shareNote, setShareNote] = useState(saved.shared ? '已開啟同事分享的學習單設定。' : '');
  const [lesson, setLesson] = useState(saved.lesson && getLessonMeta(saved.lesson) ? saved.lesson : firstLesson);
  const [picked, setPicked] = useState(() => (saved.picked || []).filter(id => byId.has(id) || String(id).startsWith('custom:')));
  const [preset, setPreset] = useState(SIMPLE_PRESETS.some(p => p.id === saved.preset) ? saved.preset : 'traceBlank');
  const [times, setTimes] = useState(Number.isInteger(saved.times) ? saved.times : 4);
  const [contentMode, setContentMode] = useState(saved.contentMode === 'character' ? 'character' : 'word');
  const [cellSize, setCellSize] = useState([20, 25, 30].includes(saved.cellSize) ? saved.cellSize : 20);
  const [showZhuyin, setShowZhuyin] = useState(saved.showZhuyin !== false);
  const [strokeAppendix, setStrokeAppendix] = useState(saved.strokeAppendix === true);
  const [customTitle, setCustomTitle] = useState(typeof saved.customTitle === 'string' ? saved.customTitle : '');
  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(saved.zoom === 'page' ? 'page' : 'width');
  const [full, setFull] = useState(false);
  const [studentClass, setStudentClass] = useState('');
  const [studentName, setStudentName] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [customMsg, setCustomMsg] = useState('');

  useEffect(() => { try { window.localStorage.setItem(STORE, JSON.stringify({lesson, picked, custom, preset, times, contentMode, cellSize, showZhuyin, customTitle, zoom, strokeAppendix})); } catch {} }, [lesson, picked, custom, preset, times, contentMode, cellSize, showZhuyin, customTitle, zoom, strokeAppendix]);

  const addCustom = () => {
    const words = parseCustomWords(customText), ok = words.filter(validCustomWord), bad = words.filter(w => !validCustomWord(w));
    const existing = new Set(custom.map(c => c.word)), fresh = ok.filter(w => !existing.has(w));
    const rows = fresh.map(w => ({id: 'custom:' + crypto.randomUUID(), word: w, pinyin: guessZhuyin(w, zi)}));
    setCustom(v => [...v, ...rows]);
    setPicked(v => [...v, ...rows.flatMap(r => [...r.word].map((_, i) => `${r.id}:${i}`))]);
    setCustomText(bad.join(' '));
    setCustomMsg(bad.length ? `「${bad.join('、')}」不是 1 到 8 個國字的語詞，沒有加入，請修改後再按一次。` : rows.length ? `已加入 ${rows.length} 個語詞，請到第 2 步檢查注音。` : '這些語詞已經在清單裡了。');
  };
  const updateCustomZhuyin = (id, text) => setCustom(v => v.map(c => c.id === id ? {...c, pinyin: text} : c));
  const fixCustomZhuyin = id => setCustom(v => v.map(c => c.id === id ? {...c, pinyin: normalizeZhuyin(c.pinyin, c.word.length)} : c));
  const removeCustom = id => { setCustom(v => v.filter(c => c.id !== id)); setPicked(v => v.filter(x => !x.startsWith(id + ':'))); };
  const copyShare = async () => {
    const code = encodeShare({v: 1, l: lesson, p: picked.filter(id => !id.startsWith('custom:') || custom.some(c => id.startsWith(c.id + ':'))), c: custom, s: preset, t: times, m: contentMode, z: cellSize, y: showZhuyin, h: customTitle});
    const url = window.location.href.split('#')[0] + '#ws=' + code;
    try { await navigator.clipboard.writeText(url); setMessage('已複製分享連結，貼給同事或家長，打開就是同一份學習單。'); }
    catch { window.prompt('請複製這個連結：', url); }
  };

  const lessonGroups = useMemo(() => groupWords(all.filter(e => e.lesson === lesson)), [all, lesson]);
  const pickedEntries = useMemo(() => picked.map(id => byId.get(id)).filter(Boolean), [picked, byId]);
  const groups = useMemo(() => groupWords(pickedEntries), [pickedEntries]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const isPicked = g => g.entries.every(e => pickedSet.has(e.id));
  const toggle = g => setPicked(v => isPicked(g) ? v.filter(id => !g.entries.some(e => e.id === id)) : [...v, ...g.entries.map(e => e.id).filter(id => !v.includes(id))]);
  const addLesson = () => setPicked(v => [...v, ...lessonGroups.flatMap(g => g.entries.map(e => e.id)).filter(id => !v.includes(id))]);
  const clearLesson = () => setPicked(v => v.filter(id => byId.get(id)?.lesson !== lesson));
  const removeGroup = g => { if (g.lesson === CUSTOM_LESSON_ID) removeCustom(g.entries[0].id.replace(/:\d+$/, '')); else setPicked(v => v.filter(id => !g.entries.some(e => e.id === id))); };

  const presetInfo = SIMPLE_PRESETS.find(p => p.id === preset);
  const shownTimes = Math.max(presetInfo.min, times);
  const choosePreset = p => { if ((p.id === 'quiz') !== (preset === 'quiz')) setTimes(p.defaultTimes); else setTimes(t => Math.max(p.min, t)); setPreset(p.id); };

  // 載入筆畫（部件提示與字形都需要）
  const needed = useMemo(() => [...new Set(pickedEntries.flatMap(e => [...e.word]))].join(''), [pickedEntries]);
  const [data, setData] = useState({});
  const [failed, setFailed] = useState({});
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const missing = [...needed].filter(c => !(c in data) && !(c in failed));
    (async () => {
      for (let i = 0; i < missing.length; i += 20) {
        const batch = await Promise.all(missing.slice(i, i + 20).map(async c => {
          try { return {c, d: await loadStrokeData(c)}; }
          catch (e) { return e?.message === MISSING_STROKES ? {c, d: null} : {c, err: true}; }
        }));
        if (cancelled) return;
        setData(v => ({...v, ...Object.fromEntries(batch.filter(b => !b.err).map(b => [b.c, b.d]))}));
        const bad = batch.filter(b => b.err);
        if (bad.length) setFailed(v => ({...v, ...Object.fromEntries(bad.map(b => [b.c, true]))}));
      }
    })();
    return () => { cancelled = true; };
  }, [needed, retry]);
  const loading = [...needed].some(c => !(c in data) && !(c in failed));
  const failedChars = [...needed].filter(c => c in failed);

  const autoTitle = automaticCopybookTitle(pickedEntries, lesson, getLessonMeta, getBook);
  const title = customTitle.trim() ? customTitle : autoTitle;
  const missingParts = useMemo(() => new Set(preset === 'parts' ? [...needed].filter(c => data[c] === null) : []), [preset, needed, data]);
  const doc = useMemo(() => buildSimpleDocument({groups, preset, times: shownTimes, contentMode, cellSize, showZhuyin, title, titleCustom: !!customTitle.trim(), missingParts, fieldValues: {班級: studentClass.trim(), 姓名: studentName.trim()}}), [groups, preset, shownTimes, contentMode, cellSize, showZhuyin, title, customTitle, missingParts, studentClass, studentName]);
  const entries = useMemo(() => orderedBookEntries(all, doc.selected), [all, doc.selected]);
  const plan = useMemo(() => bookColumns(entries, doc.options), [entries, doc.options]);
  const targetChars = useMemo(() => [...new Set(groups.flatMap(g => g.targets.map(i => g.word[i])))], [groups]);
  const strokeLayout = useMemo(() => strokeAppendix ? strokeOrderLayout(targetChars, data) : {pages: [], perLine: 0}, [strokeAppendix, targetChars, data]);
  const noStrokeChars = strokeAppendix ? targetChars.filter(c => data[c] === null) : [];
  const bookPages = plan.pages.length, strokePages = strokeLayout.pages.length;
  const pages = bookPages + strokePages;
  const shown = Math.min(page, Math.max(0, pages - 1));
  useEffect(() => { if (page > pages - 1) setPage(Math.max(0, pages - 1)); }, [pages]);
  const strokeSVGs = () => strokeLayout.pages.map((_, i) => strokeOrderPageSVG(strokeLayout, i, data, (title.replace(/\s*生字學習單$/, '') + ' 筆順練習').trim()));
  const firstDoc = React.useRef(true);
  useEffect(() => { if (firstDoc.current) { firstDoc.current = false; return; } if (!busy) { setMessage(''); setShareNote(''); } }, [doc, strokeAppendix]);
  const ready = !!entries.length && !loading && !failedChars.length && !plan.tooLong.length;
  const pageSVG = useMemo(() => entries.length ? (shown >= bookPages ? strokeOrderPageSVG(strokeLayout, shown - bookPages, data, (title.replace(/\s*生字學習單$/, '') + ' 筆順練習').trim()) : bookPageSVG(plan, shown, data, doc.options)).replace(/width="[\d.]+" height="[\d.]+"/, 'style="width:100%;height:auto;display:block"') : '', [plan, shown, data, doc.options, entries.length, strokeLayout, bookPages, title]);

  const run = async (label, fn, done) => {
    if (busy || !ready) return;
    setBusy(label); setMessage(label + '，請稍候…');
    try { await fn(); setMessage(done); } catch (e) { setMessage('製作失敗：' + (e?.message || '請再試一次')); } finally { setBusy(''); }
  };
  const doPDF = () => run('正在製作 PDF', () => downloadPDF(plan, data, doc.options, undefined, strokeSVGs()), `已下載「${title}.pdf」，通常會在電腦的「下載」資料夾。`);
  const doPrint = () => run('正在準備列印', () => printPages(plan, data, doc.options, undefined, strokeSVGs()), '已開啟列印視窗。若印出來太小，請在列印設定選「實際大小」或「100%」。');
  const doWord = () => run('正在製作 Word', async () => downloadBlob(await bookDOCX(entries, doc.options, data), title + '.docx'), `已下載「${title}.docx」，通常會在電腦的「下載」資料夾。${strokePages ? 'Word 檔不含筆順附頁，需要的話請用 PDF 或列印。' : ''}`);

  const seq = presetSequence(preset, shownTimes);
  const quiz = preset === 'quiz';
  const noZhuyin = custom.filter(c => missingZhuyin(c.pinyin) && groups.some(g => g.entries[0]?.id.startsWith(c.id + ':')));
  const [previewVisible, setPreviewVisible] = useState(false);
  useEffect(() => {
    const el = document.getElementById('simple-preview');
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => setPreviewVisible(e.isIntersecting), {threshold: .15});
    io.observe(el); return () => io.disconnect();
  }, []);
  const lessonCount = new Set(groups.filter(g => g.lesson !== CUSTOM_LESSON_ID).map(g => g.lesson)).size, hasCustom = groups.some(g => g.lesson === CUSTOM_LESSON_ID);

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
    {guide && <div role="note" className="flex items-start gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 lg:col-span-2">
      <Lightbulb className="mt-0.5 shrink-0 text-amber-700" size={22}/>
      <div className="flex-1 space-y-1"><p className="text-lg font-bold">第一次使用？照 1 → 2 → 3 → 4 做就好</p>
        <p>選課本 → 勾語詞 → 選練習方式 → 下載或列印。其他設定都選好了，不改也能直接印。</p></div>
      <button type="button" className="shrink-0 rounded-xl border-2 border-amber-400 bg-white px-3 py-1.5 font-bold" onClick={() => { setGuide(false); try { window.localStorage.setItem(GUIDE, '1'); } catch {} }}>知道了</button>
    </div>}
    <div className="space-y-5">
      <section className={card} aria-labelledby="s1">
        <h2 id="s1" className={stepTitle}><span className={stepNo}>1</span>{source === 'book' ? '選課本與課次' : '輸入要練習的語詞'}</h2>
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="語詞來源">
          {[['book', '從課本選', BookOpen], ['custom', '自己輸入語詞', PencilLine]].map(([v, l, Icon]) => <button key={v} type="button" role="tab" aria-selected={source === v} onClick={() => setSource(v)}
            className={'flex items-center justify-center gap-2 rounded-xl border-2 px-2 py-3 text-base font-bold sm:text-lg ' + (source === v ? 'border-blue-700 bg-blue-50 text-blue-900' : 'bg-white text-slate-700 hover:bg-slate-50')}><Icon size={20}/>{l}</button>)}
        </div>
        {source === 'book' ? <SimplePicker lesson={lesson} getLessonMeta={getLessonMeta} onChange={id => { if (id) setLesson(id); }}/> : <div className="space-y-2">
          <label htmlFor="custom-words" className="block text-slate-700">把語詞打在下面，用空白、逗號或換行隔開，例如：<span className="hanzi-kai">快樂　朋友　學校</span></label>
          <textarea id="custom-words" rows={3} className="hanzi-kai block w-full rounded-lg border-2 p-2 text-xl" value={customText} onChange={e => setCustomText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) addCustom(); }} placeholder="例如：聯絡簿上的訂正語詞"/>
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border-2 border-blue-700 bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-40" disabled={!customText.trim()} onClick={addCustom}><Plus size={18}/>加入語詞</button>
          {customMsg && <p role="status" className="rounded-lg bg-blue-50 p-2 text-blue-950">{customMsg}</p>}
          <p className="text-[15px] text-slate-600">注音會依課本資料自動帶入，可在下一步檢查、修改。每個字都會當生字練習。</p>
        </div>}
      </section>

      <section className={card} aria-labelledby="s2">
        <h2 id="s2" className={stepTitle}><span className={stepNo}>2</span>{source === 'book' ? '勾選要練習的語詞' : '檢查注音'}</h2>
        {source === 'custom' ? <div className="space-y-2">
          {!custom.length && <p className="rounded-xl bg-slate-50 p-4 text-slate-600">還沒有輸入語詞。請在第 1 步打字後按「加入語詞」。</p>}
          {custom.map(c => { const miss = missingZhuyin(c.pinyin), poly = !miss && polyphones(c.word, zi).length; return <div key={c.id} className={'flex flex-wrap items-center gap-2 rounded-xl border-2 p-2 ' + (miss ? 'border-amber-400 bg-amber-50' : poly ? 'border-amber-300' : 'border-slate-200')}>
            <span className="hanzi-kai min-w-20 text-2xl text-red-700">{c.word}</span>
            <label className="flex min-w-0 flex-1 items-center gap-2 text-sm">注音
              <input className="min-w-0 flex-1 rounded-lg border-2 bg-white p-1.5 text-lg" value={c.pinyin} aria-label={`${c.word} 的注音，每個字用空白隔開`} onChange={e => updateCustomZhuyin(c.id, e.target.value)} onBlur={() => fixCustomZhuyin(c.id)}/></label>
            <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`刪除 ${c.word}`} onClick={() => removeCustom(c.id)}><X size={18}/></button>
            {miss && <p className="basis-full text-sm text-amber-900">「？」是查不到注音的字，請改成正確注音（每個字用空白隔開），或留著不印注音。</p>}
            {!miss && !!polyphones(c.word, zi).length && <p className="basis-full text-sm text-amber-900">「{polyphones(c.word, zi).join('、')}」有不只一種讀音，請確認注音是否正確。</p>}
          </div>; })}
        </div> : <>
        <p className="text-[15px] text-slate-600">紅色的字是本課生字。換到其他課次，已勾選的語詞會保留，可以一起印在同一份學習單。</p>
        <div className="flex flex-wrap gap-2">
          {lessonGroups.map(g => { const on = isPicked(g); return <button key={g.key} type="button" aria-pressed={on} onClick={() => toggle(g)}
            className={'hanzi-kai flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-2xl ' + (on ? 'border-blue-700 bg-blue-50' : 'border-slate-300 bg-white hover:bg-slate-50')}>
            <span aria-hidden="true" className={'inline-flex h-5 w-5 items-center justify-center rounded border-2 text-sm font-sans ' + (on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-400')}>{on ? '✓' : ''}</span>
            <span>{[...g.word].map((c, i) => <span key={i} className={g.targets.includes(i) ? 'text-red-700' : ''}>{c}</span>)}</span>
            <span className="sr-only">生字：{g.targets.map(i => g.word[i]).join('、')}</span>
          </button>; })}
          {!lessonGroups.length && <p className="text-slate-600">這一課沒有語詞資料，請換一課。</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} onClick={addLesson} disabled={!lessonGroups.length || lessonGroups.every(isPicked)}>全選這一課</button>
          <button type="button" className={btn} onClick={clearLesson} disabled={!lessonGroups.some(g => g.entries.some(e => pickedSet.has(e.id)))}>取消這一課</button>
        </div></>}
        {!!groups.length && <div className="rounded-xl bg-slate-50 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold">已選 {groups.length} 個語詞{lessonCount > 1 ? `（${lessonCount} 課${hasCustom ? '＋自訂' : ''}）` : hasCustom && lessonCount ? '（課本＋自訂）' : ''}</p>
            <button type="button" className="text-sm font-bold text-red-800 underline" onClick={() => { if (window.confirm('要清除全部已選語詞嗎？')) { setPicked([]); setCustom([]); } }}>全部清除</button>
          </div>
          <div className="flex flex-wrap gap-1.5">{groups.map(g => <span key={g.key} className="hanzi-kai inline-flex items-center gap-1 rounded-lg border bg-white py-0.5 pl-2 pr-1 text-lg">{g.word}
            <button type="button" className="rounded p-0.5 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label={`移除 ${g.word}`} onClick={() => removeGroup(g)}><X size={16}/></button></span>)}</div>
        </div>}
      </section>

      <section className={card} aria-labelledby="s3">
        <h2 id="s3" className={stepTitle}><span className={stepNo}>3</span>選擇練習方式</h2>
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="練習方式">
          {SIMPLE_PRESETS.map(p => { const on = p.id === preset; return <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => choosePreset(p)}
            className={'flex flex-col items-start gap-2 rounded-xl border-2 p-3 text-left ' + (on ? 'border-blue-700 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-300 bg-white hover:bg-slate-50')}>
            <span className="font-bold text-lg">{p.name}</span>
            <span className="text-[15px] text-slate-600">{p.note}</span>
            <Sequence small seq={presetSequence(p.id, Math.max(p.min, Math.min(5, on ? shownTimes : p.defaultTimes)))}/>
          </button>; })}
        </div>

        <div className="space-y-2">
          <p className="font-bold">每個語詞寫幾次<span className="font-normal text-slate-600 text-sm">{quiz ? '（每次都只有注音）' : '（含第 1 次示範字）'}</span></p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="每個語詞寫幾次">
            {(quiz ? [1, 2, 3, 4] : [2, 3, 4, 5, 6, 8]).map(n => <button key={n} type="button" role="radio" aria-checked={shownTimes === n} disabled={n < presetInfo.min} className={chip(shownTimes === n) + ' min-w-12 disabled:opacity-30'} onClick={() => setTimes(n)}>{n} 次</button>)}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-700"><span>生字會依序這樣印：</span><Sequence seq={seq}/></div>
          <p className="text-[15px] text-slate-600">{seq.map((m, i) => `第 ${i + 1} 次${MODE_LABEL[m]}`).join('、')}</p>
          {!!noZhuyin.length && <p role="status" className="text-sm text-amber-900">「{noZhuyin.map(c => c.word).join('、')}」有字沒有注音，印出來那格的注音會空白。可回到第 2 步補上。</p>}
          {!!missingParts.size && <p role="status" className="text-sm text-amber-900">「{[...missingParts].join('、')}」沒有部件資料，這些字改用描紅。</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <fieldset className="space-y-2"><legend className="font-bold">印出內容</legend>
            <div className="flex flex-wrap gap-2">{[['word', '整個語詞'], ['character', '只印生字']].map(([v, l]) => <button key={v} type="button" aria-pressed={contentMode === v} className={chip(contentMode === v)} onClick={() => setContentMode(v)}>{l}</button>)}</div></fieldset>
          <fieldset className="space-y-2"><legend className="font-bold">字格大小</legend>
            <div className="flex flex-wrap gap-2">{[[20, '一般'], [25, '大'], [30, '特大']].map(([v, l]) => <button key={v} type="button" aria-pressed={cellSize === v} className={chip(cellSize === v)} onClick={() => setCellSize(v)}>{l}</button>)}</div></fieldset>
          <fieldset className="space-y-2"><legend className="font-bold">注音</legend>
            <div className="flex flex-wrap gap-2">{[[true, '顯示'], [false, '不顯示']].map(([v, l]) => <button key={String(v)} type="button" disabled={quiz} aria-pressed={(quiz || showZhuyin) === v} className={chip((quiz || showZhuyin) === v) + ' disabled:opacity-50'} onClick={() => setShowZhuyin(v)}>{l}</button>)}</div>
            {quiz && <p className="text-[15px] text-slate-600">看注音寫國字一定會印注音。</p>}</fieldset>
        </div>

        <fieldset className="space-y-2"><legend className="font-bold">筆順附頁</legend>
          <div className="flex flex-wrap gap-2">{[[false, '不需要'], [true, '加印筆順附頁']].map(([v, l]) => <button key={String(v)} type="button" aria-pressed={strokeAppendix === v} className={chip(strokeAppendix === v)} onClick={() => setStrokeAppendix(v)}>{l}</button>)}</div>
          <p className="text-[15px] text-slate-600">在學習單後面加印每個生字的筆順分解（一筆一格，紅色是這一筆），適合剛學寫字或需要筆順提示的孩子。只會加在 PDF 與列印，Word 檔不含。</p>
          {!!noStrokeChars.length && <p role="status" className="text-sm text-amber-900">「{noStrokeChars.join('、')}」沒有筆順資料，附頁會略過這些字。</p>}
        </fieldset>
        <label className="block space-y-1"><span className="font-bold">學習單標題</span>
          <input className="block w-full rounded-lg border-2 p-2" maxLength={45} value={title} onChange={e => setCustomTitle(e.target.value)} aria-describedby="title-hint"/>
          <span id="title-hint" className="flex flex-wrap items-center gap-2 text-[15px] text-slate-600">{customTitle.trim() ? <>已自訂標題。<button type="button" className="font-bold text-blue-800 underline" onClick={() => setCustomTitle('')}>改回自動標題</button></> : '會依勾選的課次自動命名，也可以直接修改。'}</span>
        </label>
        <details className="rounded-xl border bg-slate-50 p-3" open={!!(studentName || studentClass)}>
          <summary className="cursor-pointer font-bold">預先印上班級、姓名（選填）</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1"><span>班級</span><input className="block w-full rounded-lg border-2 bg-white p-2" maxLength={20} value={studentClass} onChange={e => setStudentClass(e.target.value)} placeholder="例如：五年三班"/></label>
            <label className="block space-y-1"><span>姓名</span><input className="block w-full rounded-lg border-2 bg-white p-2" maxLength={20} value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="例如：王小明"/></label>
          </div>
          <p className="mt-2 text-[15px] text-slate-600">適合幫個別學生準備專屬學習單。為了保護隱私，姓名不會被記住，也不會放進分享連結。</p>
        </details>
      </section>
      <details className="rounded-2xl border bg-white p-4">
        <summary className="cursor-pointer text-lg font-bold">常見問題</summary>
        <dl className="mt-3 space-y-3 text-slate-700">
          <div><dt className="font-bold">印出來的格子太小？</dt><dd>第 3 步把「字格大小」改成「大」或「特大」；列印時選「實際大小」或「100%」，不要選「符合頁面」。</dd></div>
          <div><dt className="font-bold">孩子的語詞不在課本清單裡？</dt><dd>第 1 步按「自己輸入語詞」，把聯絡簿或考卷上的語詞打進去。</dd></div>
          <div><dt className="font-bold">同一張想放好幾課？</dt><dd>勾完一課後換到下一課繼續勾，已勾選的語詞都會保留。</dd></div>
          <div><dt className="font-bold">下次還要重選嗎？</dt><dd>不用，這台電腦的瀏覽器會記住你上次的選擇（學生姓名除外）。</dd></div>
          <div><dt className="font-bold">只有手機可以用嗎？</dt><dd>可以。按「下載 PDF」存到手機，再用印表機 App 或傳到電腦列印。</dd></div>
          <div><dt className="font-bold">目前有哪些教材？</dt><dd>南一、康軒、翰林一到六年級上學期。下學期的語詞可以用「自己輸入語詞」。</dd></div>
        </dl>
      </details>
      <div className="rounded-2xl border border-dashed bg-white p-4 text-[15px] text-slate-600 space-y-2">
        <p>想調整語詞位置、單一字格的提示，或改 A3 紙、十字線？</p>
        <button type="button" className={btn + ' text-sm'} disabled={!entries.length} onClick={() => onAdvanced?.({lesson, selected: doc.selected, options: doc.options, entrySnapshots: entries.filter(e => e.lesson === CUSTOM_LESSON_ID), lessonSnapshots: customLessonSnapshot, bookSnapshots: customBookSnapshot})}><SlidersHorizontal size={16}/>帶到進階模式細調</button>
      </div>
    </div>

    <section id="simple-preview" aria-labelledby="s4" className={card + ' lg:sticky lg:top-4'}>
      <h2 id="s4" className={stepTitle}><span className={stepNo}>4</span>預覽與列印</h2>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-blue-700 bg-blue-700 px-4 py-2 font-bold text-white hover:bg-blue-800 disabled:opacity-40" disabled={!ready || !!busy} onClick={doPDF}><Download size={18}/>下載 PDF</button>
        <button type="button" className={btn + ' border-blue-700 text-blue-900'} disabled={!ready || !!busy} onClick={doPrint}><Printer size={18}/>列印</button>
        <button type="button" className={btn + ' text-sm'} disabled={!ready || !!busy} onClick={doWord}><FileText size={16}/>Word 檔</button>
      </div>
      <p role="status" aria-live="polite" className="min-h-6 text-sm text-blue-900">
        {message || shareNote || (!entries.length ? '' : loading ? '正在載入字形…' : `共 ${groups.length} 個語詞・${bookPages} 頁${strokePages ? `＋筆順附頁 ${strokePages} 頁` : ''}（A4）`)}
      </p>
      {!!plan.tooLong.length && <p role="alert" className="rounded-lg bg-amber-50 p-2 text-sm text-amber-900">「{plan.tooLong.join('、')}」太長，一欄放不下，請把字格改成「一般」或選「只印生字」。</p>}
      {!!failedChars.length && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">網路不穩，有 {failedChars.length} 個字的字形還沒載入。<button type="button" className="font-bold underline" onClick={() => { setFailed({}); setRetry(n => n + 1); }}>重新載入</button></p>}
      {!!entries.length && <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="預覽大小" className="flex rounded-xl border-2 bg-slate-100 p-1 text-sm">
          {[['width', '放大（捲動看全頁）'], ['page', '看整頁']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={zoom === v} onClick={() => setZoom(v)} className={'rounded-lg px-3 py-1.5 font-bold ' + (zoom === v ? 'bg-white text-blue-900 shadow' : 'text-slate-600')}>{l}</button>)}
        </div>
        <button type="button" className={btn + ' text-sm py-1.5'} onClick={() => setFull(true)}><Maximize2 size={16}/>全螢幕預覽</button>
        <button type="button" className={btn + ' text-sm py-1.5'} onClick={copyShare} title="把目前的語詞與設定變成一個連結"><Link2 size={16}/>複製分享連結</button>
        {pages > 1 && <div className="ml-auto flex items-center gap-2">
          <button type="button" className={btn + ' px-2 py-1.5'} disabled={shown === 0} onClick={() => setPage(shown - 1)} aria-label="上一頁"><ChevronLeft size={18}/></button>
          <span className="text-sm whitespace-nowrap">第 {shown + 1}／{pages} 頁</span>
          <button type="button" className={btn + ' px-2 py-1.5'} disabled={shown >= pages - 1} onClick={() => setPage(shown + 1)} aria-label="下一頁"><ChevronRight size={18}/></button>
        </div>}
      </div>}
      <div className={'rounded-xl bg-slate-100 p-2 sm:p-3 ' + (entries.length && zoom === 'width' ? 'lg:max-h-[calc(100dvh-15.5rem)] lg:overflow-auto' : '')}>
        {!entries.length ? <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-lg bg-white p-6 text-center text-slate-600">
          <p className="text-lg font-bold text-slate-800">還沒有選語詞</p><p>先在第 1 步選課次，再到第 2 步勾選要練習的語詞，這裡就會出現學習單。</p></div>
          : loading ? <div className="flex min-h-96 items-center justify-center rounded-lg bg-white text-slate-600" role="status">正在準備字形，請稍候…</div>
          : <button type="button" title="點一下全螢幕預覽" onClick={() => setFull(true)} className={'mx-auto block cursor-zoom-in bg-white shadow ' + (zoom === 'page' ? 'lg:h-[calc(100dvh-16rem)] lg:w-auto' : 'w-full')} style={{aspectRatio: `${plan.paper.width}/${plan.paper.height}`}} aria-label={`學習單第 ${shown + 1} 頁預覽，點一下全螢幕`} dangerouslySetInnerHTML={{__html: pageSVG}}/>}
      </div>

    </section>

    {full && !!entries.length && <FullPreview svg={pageSVG} page={shown} pages={pages} onPage={setPage} onClose={() => setFull(false)}/>}
    {!!entries.length && !previewVisible && <a href="#simple-preview" className="fixed inset-x-3 bottom-3 z-40 flex items-center justify-between rounded-2xl bg-blue-700 px-4 py-3 font-bold text-white shadow-lg lg:hidden">
      <span>已選 {groups.length} 個語詞・{pages} 頁</span><span>看預覽、列印 ↓</span></a>}
  </div>;
}

function FullPreview({svg, page, pages, onPage, onClose}) {
  useEffect(() => {
    const key = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft' && page > 0) onPage(page - 1); if (e.key === 'ArrowRight' && page < pages - 1) onPage(page + 1); };
    window.addEventListener('keydown', key); const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [page, pages]);
  const nav = 'rounded-full bg-white/90 p-3 text-slate-900 shadow disabled:opacity-30';
  return <div role="dialog" aria-modal="true" aria-label="全螢幕預覽" className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm" onClick={onClose}>
    <div className="flex items-center justify-between gap-3 px-4 py-2 text-white" onClick={e => e.stopPropagation()}>
      <span className="font-bold">第 {page + 1}／{pages} 頁</span>
      <button type="button" autoFocus className="inline-flex items-center gap-1 rounded-xl bg-white px-4 py-2 font-bold text-slate-900" onClick={onClose}><X size={18}/>關閉</button>
    </div>
    <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto px-2 pb-3">
      <div className="h-full max-w-full bg-white shadow-2xl" style={{aspectRatio: '210/297'}} onClick={e => e.stopPropagation()} dangerouslySetInnerHTML={{__html: svg}}/>
      {pages > 1 && <>
        <button type="button" className={nav + ' absolute left-3 top-1/2 -translate-y-1/2'} disabled={page === 0} aria-label="上一頁" onClick={e => { e.stopPropagation(); onPage(page - 1); }}><ChevronLeft size={28}/></button>
        <button type="button" className={nav + ' absolute right-3 top-1/2 -translate-y-1/2'} disabled={page >= pages - 1} aria-label="下一頁" onClick={e => { e.stopPropagation(); onPage(page + 1); }}><ChevronRight size={28}/></button>
      </>}
    </div>
  </div>;
}
