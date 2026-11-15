// 進階模式「我的預設設定」：把整張學習單的版面與提示設定存在這台裝置的瀏覽器，
// 之後按「製作新學習單」時直接套用。語詞、標題文字、學生姓名、逐字逐格與手動排版不會存。
import {BOOK_DEFAULTS} from './copybook-export';

const KEY = 'copybook-tool:my-defaults:v1';
const SKIP = new Set(['items', 'manualColumns', 'title', 'titleCustom', 'fieldValues', 'orderVersion']);

export function pickMyDefaults(options: Record<string, any>) {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(options || {})) if (!SKIP.has(k) && v !== undefined) out[k] = v;
  return out;
}

export function readMyDefaults(): Record<string, any> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' && v.settings && typeof v.settings === 'object' ? v.settings : null;
  } catch { return null; }
}

export function saveMyDefaults(options: Record<string, any>) {
  window.localStorage.setItem(KEY, JSON.stringify({version: 1, savedAt: new Date().toISOString(), settings: pickMyDefaults(options)}));
}

export function clearMyDefaults() {
  try { window.localStorage.removeItem(KEY); } catch {}
}

// 新學習單的起始設定：原始預設 → 我的預設；語詞與逐字設定一律清空
export function newWorksheetOptions() {
  return {...BOOK_DEFAULTS, ...(readMyDefaults() || {}), items: {}, titleCustom: false, title: BOOK_DEFAULTS.title};
}

// 目前設定和「我的預設」是否一樣（用來顯示狀態）
export function sameAsMyDefaults(options: Record<string, any>) {
  const mine = readMyDefaults();
  if (!mine) return false;
  const cur = pickMyDefaults(options);
  const keys = new Set([...Object.keys(mine), ...Object.keys(cur)]);
  for (const k of keys) if (JSON.stringify(mine[k] ?? (BOOK_DEFAULTS as any)[k]) !== JSON.stringify(cur[k] ?? (BOOK_DEFAULTS as any)[k])) return false;
  return true;
}
