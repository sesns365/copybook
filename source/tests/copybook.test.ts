// 自動測試：每次改版前執行 npm test，確認練習方式、文件產生與排版沒有被改壞。
import {describe, it, expect} from 'vitest';
import {SIMPLE_PRESETS, presetSequence, groupWords, buildSimpleDocument, cleanCustomSeq} from '../src/app/simple-copybook';
import {teachingCurriculum} from '../src/app/curriculum-settings';
import {bookColumns, orderedBookEntries, cellSVG, bookPageSVG} from '../src/app/copybook-export';
import {CELL_SIZES} from '../src/app/copybook-paper';
import {copybookComponentMapping} from '../src/app/copybook-grouping';

const all = Object.values(teachingCurriculum({}, {}, false)).flat() as any[];
const lesson = all[0].lesson;
const groups = groupWords(all.filter(e => e.lesson === lesson)).slice(0, 4);
const base = {groups, contentMode: 'word', cellSize: 20, showZhuyin: true, title: '測試', titleCustom: true};
const build = (o = {}) => { const doc = buildSimpleDocument({preset: 'traceBlank', times: 4, ...base, ...o}); const entries = orderedBookEntries(all, doc.selected); return {doc, entries, plan: bookColumns(entries, doc.options)}; };

describe('練習方式序列', () => {
  it('原本六種方式的結果不變', () => {
    expect(presetSequence('trace', 4)).toEqual(['model', 'trace', 'trace', 'trace']);
    expect(presetSequence('traceBlank', 4)).toEqual(['model', 'trace', 'trace', 'blank']);
    expect(presetSequence('progressive', 5)).toEqual(['model', 'trace', 'trace', 'gray', 'blank']);
    expect(presetSequence('parts', 3)).toEqual(['model', 'parts', 'parts']);
    expect(presetSequence('blank', 3)).toEqual(['model', 'blank', 'blank']);
    expect(presetSequence('quiz', 2)).toEqual(['blank', 'blank']);
  });
  it('新組合包含每一個階段', () => {
    expect(presetSequence('traceParts', 4)).toEqual(['model', 'trace', 'parts', 'blank']);
    expect(presetSequence('fullSteps', 5)).toEqual(['model', 'trace', 'gray', 'parts', 'blank']);
  });
  it('每種方式在最少到 8 次都有正確長度', () => {
    for (const p of SIMPLE_PRESETS) for (let n = p.min; n <= 8; n++) expect(presetSequence(p.id, n)).toHaveLength(n);
  });
  it('自訂組合照老師排的順序', () => {
    expect(presetSequence('custom', 4, cleanCustomSeq(['blank', 'parts', 'gray']))).toEqual(['model', 'blank', 'parts', 'gray']);
  });
});

describe('學習單文件與排版', () => {
  it('每種練習方式都能排版、產生頁面', () => {
    for (const p of SIMPLE_PRESETS) {
      const {plan, entries} = build({preset: p.id, times: Math.max(p.min, 4)});
      expect(entries.length).toBeGreaterThan(0);
      expect(plan.pages.length).toBeGreaterThan(0);
      expect(bookPageSVG(plan, 0, {}, plan.renderOptions)).toContain('<svg');
    }
  });
  it('所有字格大小都能排版', () => {
    for (const cellSize of CELL_SIZES) expect(build({cellSize}).plan.cellSize).toBe(cellSize);
  });
  it('個別語詞多寫：次數會增加', () => {
    const key = groups[0].key, {doc} = build({wordDelta: {[key]: 2}});
    const item = doc.options.items[groups[0].entries[0].id];
    expect(item.repetitions).toBe(6);
  });
  it('部件提示：提示部件可選顏色，其餘空白', () => {
    for (const tone of ['black', 'red', 'gray']) {
      const {doc} = build({preset: 'parts', times: 3, partsTone: tone});
      const cells = Object.values(doc.options.items).flatMap((it: any) => Object.values(it.cells)).filter((c: any) => c.mode === 'parts');
      expect(cells.length).toBeGreaterThan(0);
      for (const c of cells as any[]) expect(c.styles).toEqual({0: tone, 1: 'blank'});
    }
  });
  it('描紅加深與十字線深淺會套用到字格', () => {
    const {plan} = build({traceTone: 'dark', crossOpacity: .75});
    const cell = {kind: 'char', char: '小', mode: 'trace', pinyin: 'ㄒㄧㄠˇ'};
    const svg = cellSVG(cell, {}, plan.renderOptions);
    expect(svg).toContain('stroke-opacity="0.75"');
    const strokes = {小: {strokes: ['M0 0L1 1'], medians: [[[0, 0], [1, 1]]]}};
    expect(cellSVG(cell, strokes, plan.renderOptions)).toContain('#c45f5f');
    expect(cellSVG(cell, strokes, build().plan.renderOptions)).toContain('#da8e8e');
  });
  it('原本缺部件分組的字已補上（快 → 忄、樂 → 木）', () => {
    expect(copybookComponentMapping('快', 7, {}, {})).toEqual([0, 0, 0, 1, 1, 1, 1]);
    expect(copybookComponentMapping('樂', 15, {}, {}).slice(11)).toEqual([0, 0, 0, 0]);
  });
});

describe('114 學年度下學期教材', () => {
  it('三家出版社一到六年級下學期都有課次，注音音節數與語詞字數一致', async () => {
    const {BOOKS, getLessonMeta} = await import('../src/app/curriculum-source');
    const source = (await import('../src/app/curriculum-source')).default as Record<string, any[]>;
    const b = BOOKS.filter(x => x.semester === 'b');
    expect(b.length).toBe(18);
    for (const book of b) {
      expect(book.lessons.length).toBeGreaterThanOrEqual(9);
      expect(book.label).toContain('下學期');
      for (const id of book.lessons) {
        expect(getLessonMeta(id)?.title).toBeTruthy();
        for (const e of source[id]) {
          expect(e.pinyin.split(' ').length).toBe([...e.word].length);
          expect(e.pinyin).not.toContain('?');
          expect(e.targetIdx).toBeLessThan([...e.word].length);
        }
      }
    }
  });
});
