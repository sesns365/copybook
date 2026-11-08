// @ts-nocheck
// 簡易模式：把「勾選的語詞＋練習樣式」轉成進階模式同一份 {selected, options} 文件，
// 預覽、PDF、Word 與進階模式共用 copybook-export 的排版。
import {BOOK_DEFAULTS} from './copybook-export';

export const SIMPLE_PRESETS = [
  {id: 'trace', name: '描紅練習', note: '示範字之後都描紅', min: 2, defaultTimes: 3},
  {id: 'traceBlank', name: '描紅後自己寫', note: '先描紅，最後一次自己寫', min: 2, defaultTimes: 4},
  {id: 'progressive', name: '漸進練習', note: '描紅 → 描灰 → 自己寫', min: 3, defaultTimes: 5},
  {id: 'parts', name: '部件提示', note: '先寫部分部件，再補完整', min: 2, defaultTimes: 3},
  {id: 'blank', name: '看示範自己寫', note: '只有示範字，其餘留白', min: 2, defaultTimes: 3},
  {id: 'quiz', name: '看注音寫國字', note: '不印國字，只有注音（小考、複習用）', min: 1, defaultTimes: 1},
];

export const MODE_LABEL = {model: '示範', trace: '描紅', gray: '描灰', blank: '自己寫', parts: '部件'};

// 每個語詞第 1、2…次練習時，生字格的樣子。
export function presetSequence(preset, times) {
  const n = Math.max(1, times);
  if (preset === 'quiz') return Array(n).fill('blank');
  const seq = ['model'];
  for (let i = 1; i < n; i++) {
    if (preset === 'trace') seq.push('trace');
    else if (preset === 'parts') seq.push('parts');
    else if (preset === 'blank') seq.push('blank');
    else if (preset === 'traceBlank') seq.push(i === n - 1 ? 'blank' : 'trace');
    else {
      // progressive：最後一次自己寫，中間前半描紅、後半描灰
      const middle = n - 2, k = i - 1;
      seq.push(i === n - 1 ? 'blank' : k < Math.ceil(middle / 2) ? 'trace' : 'gray');
    }
  }
  return seq;
}

const PART_STYLES = {0: 'black', 1: 'gray'};

// 同一課、同一語詞有多個生字（例如「擦痕」的擦與痕）時合併成一組，兩個字都當生字練習。
export function groupWords(entries) {
  const groups = new Map();
  for (const e of entries) {
    const key = e.lesson + '|' + e.word;
    if (!groups.has(key)) groups.set(key, {key, lesson: e.lesson, word: e.word, entries: []});
    groups.get(key).entries.push(e);
  }
  return [...groups.values()].map(g => ({...g, targets: [...new Set(g.entries.map(e => e.targetIdx))].sort((a, b) => a - b)}));
}

export function buildSimpleDocument({groups, preset, times, contentMode, cellSize, showZhuyin, title, titleCustom, missingParts = new Set(), fieldValues = {}, keepZhuyinRail = false, zhuyinOverride = {}}) {
  const seq = presetSequence(preset, times);
  const items = {}, selected = [];
  const defaultMode = preset === 'parts' ? 'parts' : preset === 'blank' ? 'blank' : 'trace';
  // 只有 trace／traceBlank／parts／blank 可以靠整張預設表達；其餘逐格寫明，進階模式仍可再改。
  const needsCells = preset === 'progressive';
  const quiz = preset === 'quiz';
  const cellFor = (mode, char) => {
    const m = mode === 'parts' && missingParts.has(char) ? 'trace' : mode;
    return m === 'parts' ? {mode: m, styles: {...PART_STYLES}} : {mode: m};
  };
  for (const g of groups) {
    const units = contentMode === 'character' ? g.entries.map(e => ({entry: e, targets: [e.targetIdx]})) : [{entry: g.entries[0], targets: g.targets}];
    for (const {entry, targets} of units) {
      selected.push(entry.id);
      const cells = {};
      if (quiz) {
        // 看注音寫國字：整個語詞都留白，只保留注音
        const indices = contentMode === 'character' ? targets : [...entry.word].map((_, i) => i);
        seq.forEach((_, r) => indices.forEach(i => { cells[`${r}:${i}`] = {mode: 'blank', showZhuyin: true}; }));
        items[entry.id] = {word: entry.word, cells};
        continue;
      }
      for (const t of targets) {
        const isPrimary = t === entry.targetIdx;
        const char = entry.word[t];
        if (isPrimary && !needsCells && !(preset === 'parts' && missingParts.has(char))) continue;
        seq.forEach((mode, r) => { cells[`${r}:${t}`] = cellFor(mode, char); });
      }
      // 個別生字的注音（true 印注音／false 注音格空白）；不要注音格時不套用
      if (keepZhuyinRail || showZhuyin) for (const t of targets) {
        const want = zhuyinOverride[`${g.key}|${t}`];
        if (typeof want !== 'boolean' || want === showZhuyin) continue;
        seq.forEach((_, r) => { const k = `${r}:${t}`; cells[k] = {...(cells[k] || {}), showZhuyin: want}; });
      }
      if (Object.keys(cells).length) items[entry.id] = {word: entry.word, cells};
    }
  }
  const options = {
    ...BOOK_DEFAULTS,
    title, titleCustom,
    contentMode, cellSize, showZhuyin: quiz ? true : showZhuyin, keepZhuyinRail: quiz ? false : keepZhuyinRail,
    repetitions: seq.length,
    showModel: !quiz,
    blankLast: preset === 'traceBlank' || preset === 'progressive',
    defaultMode: quiz ? 'blank' : defaultMode,
    paperSize: 'A4',
    // 一欄放得下就接著放下一個語詞（中間空一格），短語詞或只寫一次時比較省紙
    wordsPerColumn: 0, wordGap: 1,
    fieldValues,
    items,
  };
  return {selected, options};
}

// ---- 自己輸入的語詞 ----
export const CUSTOM_LESSON_ID = 'simple-custom';
export const CUSTOM_BOOK_ID = 'simple-custom-book';
const NO_ZHUYIN = '？';

// 從三家課本語詞整理「字 → 最常見注音」，自訂語詞自動帶入注音。
export function buildZhuyinIndex(entries) {
  const counts = new Map();
  for (const e of entries) {
    const syl = String(e.pinyin || '').trim().split(/\s+/);
    if (syl.length !== e.word.length) continue;
    [...e.word].forEach((c, i) => {
      const m = counts.get(c) || new Map();
      m.set(syl[i], (m.get(syl[i]) || 0) + 1);
      counts.set(c, m);
    });
  }
  const index = new Map();
  for (const [c, m] of counts) index.set(c, [...m.entries()].sort((a, b) => b[1] - a[1])[0][0]);
  // 整個語詞在課本中出現過時，直接用課本注音（處理破音字）
  const words = new Map(entries.filter(e => String(e.pinyin || '').trim().split(/\s+/).length === e.word.length).map(e => [e.word, e.pinyin.trim()]));
  // 課本中出現過兩種以上讀音的字（破音字），自訂語詞用到時提醒確認
  const multi = new Set([...counts].filter(([, m]) => m.size > 1).map(([c]) => c));
  return {index, words, multi};
}
export function polyphones(word, zi) {
  if (zi.words.has(word)) return [];
  return [...new Set([...word].filter(c => zi.multi.has(c)))];
}

export function guessZhuyin(word, zi) {
  if (zi.words.has(word)) return zi.words.get(word);
  return [...word].map(c => zi.index.get(c) || NO_ZHUYIN).join(' ');
}

export function parseCustomWords(text) {
  return [...new Set(String(text).split(/[\s,，、;；。.／/|]+/).map(w => w.trim()).filter(Boolean))];
}
export const validCustomWord = w => /^[\u3400-\u9fff]{1,8}$/.test(w);

export function normalizeZhuyin(text, length) {
  const syl = String(text).trim().split(/\s+/).filter(Boolean).slice(0, length);
  while (syl.length < length) syl.push(NO_ZHUYIN);
  return syl.join(' ');
}
export const missingZhuyin = pinyin => String(pinyin).split(/\s+/).some(s => s === NO_ZHUYIN || !s);

// 自訂語詞可指定哪些字是生字（預設全部）；非生字每次都印黑字。
export function customTargets(c) {
  const all = [...c.word].map((_, i) => i);
  const t = Array.isArray(c.targets) ? [...new Set(c.targets)].filter(i => Number.isInteger(i) && i >= 0 && i < c.word.length).sort((a, b) => a - b) : [];
  return t.length ? t : all;
}
// 每個生字各一筆（同課本資料的做法），合併後同一語詞的生字一起練習。
export function customEntries(custom) {
  return custom.flatMap(c => customTargets(c).map(i => ({
    id: `${c.id}:${i}`, lesson: CUSTOM_LESSON_ID, bookId: CUSTOM_BOOK_ID, word: c.word,
    pinyin: c.pinyin, targetIdx: i, character: c.word[i], source: 'simple-custom',
  })));
}
export const customLessonSnapshot = {[CUSTOM_LESSON_ID]: {id: CUSTOM_LESSON_ID, bookId: CUSTOM_BOOK_ID, title: '自己輸入的語詞', number: 0}};
export const customBookSnapshot = {[CUSTOM_BOOK_ID]: {id: CUSTOM_BOOK_ID, label: '自訂語詞'}};

// ---- 分享連結 ----
export function encodeShare(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  let bin = ''; bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeShare(text) {
  try {
    const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))));
  } catch { return null; }
}
