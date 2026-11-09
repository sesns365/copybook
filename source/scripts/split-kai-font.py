# 把教育部標準楷書切成多個 woff2 小檔並產生 src/app/kai-font.css。
# 課本會用到的字（public/strokes 有資料的字）放在前面幾個檔，其餘罕用字放後面；
# 瀏覽器依 unicode-range 只下載畫面上用到的字。需要：pip install fonttools brotli
import os
from fontTools.ttLib import TTFont
from fontTools import subset
src = 'font-src/moe-standard-kai-5.1.ttf'
cmap = sorted(TTFont(src).getBestCmap().keys())
import json
# 依「最早出現在幾年級課本」分組：看二年級的課，只會下載一、二年級的字
grade = {}
def add(word, g):
    for ch in word:
        c = ord(ch); grade[c] = min(grade.get(c, 9), g)
for l in json.load(open('src/app/multi-curriculum.json')):
    g = int(l['bookId'].split('-')[1][0])
    for e in l['entries']: add(e['word'], g)
for es in json.load(open('src/app/nanyi-data.json')).values():
    for e in es: add(e['word'], 5)
for n in os.listdir('public/strokes'):
    if len(n[:-5]) == 1: grade.setdefault(ord(n[:-5]), 7)
have = set(cmap)
basic = sorted((set(range(0x20, 0x7f)) | set(range(0x3000, 0x3040)) | set(range(0x3100, 0x3130)) | set(range(0xff00, 0xff70)) | {0x2192, 0xb7, 0x2027}) & have)
slices = [basic]; used = set(basic)
for g in range(1, 8):
    cps = sorted(c for c, v in grade.items() if v == g and c in have and c not in used); used |= set(cps)
    slices += [cps[i:i + 250] for i in range(0, len(cps), 250)]
rest = [c for c in cmap if c not in used]
slices += [rest[i:i + 1200] for i in range(0, len(rest), 1200)]
os.makedirs('public/fonts/kai', exist_ok=True)
for fn in os.listdir('public/fonts/kai'): os.remove('public/fonts/kai/' + fn)
def ranges(cps):
    out = []; s = p = cps[0]
    for c in cps[1:]:
        if c == p + 1: p = c; continue
        out.append((s, p)); s = p = c
    out.append((s, p))
    return ','.join(f'U+{a:X}' if a == b else f'U+{a:X}-{b:X}' for a, b in out)
css = ['/* 教育部標準楷書，切成小檔：瀏覽器只下載畫面上用到的字（由 scripts/split-kai-font.py 產生） */']
for i, sl in enumerate(slices):
    opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.notdef_outline = True; opts.name_IDs = ['*']
    ft = TTFont(src); s = subset.Subsetter(opts); s.populate(unicodes=sl); s.subset(ft)
    ft.flavor = 'woff2'; ft.save(f'public/fonts/kai/kai-{i:03d}.woff2')
    css.append('@font-face{font-family:"MOE Standard Kai";src:url("/fonts/kai/kai-%03d.woff2") format("woff2");font-display:swap;unicode-range:%s}' % (i, ranges(sl)))
open('src/app/kai-font.css', 'w').write('\n'.join(css) + '\n')
print(len(slices), 'files')
