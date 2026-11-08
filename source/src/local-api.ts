// 以瀏覽器 localStorage 取代原網站的伺服器 API，介面與原本 api({action}) 相同。
const KEY = 'copybook-tool:worksheets:v1';

type Row = { id: string; title: string; config: string; version: number; updated: string };

export function readRows(): Row[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

export function writeRows(rows: Row[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(rows));
  } catch {
    throw new Error('此瀏覽器儲存空間不足或已封鎖本機儲存，請先下載備份檔');
  }
}

function fail(message: string, response: any) {
  const error = new Error(message) as Error & { response?: any };
  error.response = response;
  return error;
}

export async function localApi(payload: any): Promise<any> {
  const rows = readRows();
  switch (payload?.action) {
    case 'worksheets':
      return { rows };
    case 'saveWorksheet': {
      const { id, version, title, config } = payload;
      if (!id || typeof title !== 'string') throw fail('學習單資料不完整', { canEdit: true });
      const current = rows.find(r => r.id === id);
      if ((current?.version ?? 0) !== version) {
        throw fail('這份學習單已在其他分頁變更', { conflict: true, current: current || null, deleted: !current && version > 0 });
      }
      const next: Row = { id, title: title.trim() || '未命名學習單', config: JSON.stringify(config), version: version + 1, updated: new Date().toISOString() };
      writeRows([next, ...rows.filter(r => r.id !== id)]);
      return { id, version: next.version, updated: next.updated };
    }
    case 'deleteWorksheet': {
      const current = rows.find(r => r.id === payload.id);
      if (!current) throw fail('這份學習單已不存在', { conflict: true, current: null });
      if (current.version !== payload.version) throw fail('這份學習單已在其他分頁變更', { conflict: true, current });
      writeRows(rows.filter(r => r.id !== payload.id));
      return { ok: true };
    }
    default:
      throw new Error('不支援的動作');
  }
}

// 備份：把所有已存學習單匯出成一個 JSON 檔；匯入時以「較新版本」合併。
export function exportBackup() {
  const blob = new Blob([JSON.stringify({ app: 'copybook-tool', version: 1, exportedAt: new Date().toISOString(), rows: readRows() }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `學習單備份_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importBackup(file: File) {
  const data = JSON.parse(await file.text());
  const incoming: Row[] = Array.isArray(data?.rows) ? data.rows : [];
  const valid = incoming.filter(r => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.config === 'string' && (() => { try { return JSON.parse(r.config)?.layout; } catch { return false; } })());
  if (!valid.length) throw new Error('檔案中沒有可匯入的學習單');
  const map = new Map(readRows().map(r => [r.id, r]));
  let added = 0;
  for (const r of valid) {
    const old = map.get(r.id);
    if (!old || (r.version ?? 1) > (old.version ?? 1)) { map.set(r.id, { ...r, version: r.version ?? 1, updated: r.updated || new Date().toISOString() }); added++; }
  }
  writeRows([...map.values()].sort((a, b) => String(b.updated).localeCompare(String(a.updated))));
  return added;
}
