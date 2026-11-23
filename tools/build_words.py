"""สร้าง js/data-words.js จากรายการคำและความหมายภาษาไทย

แหล่งข้อมูล
  tools/words_raw.json   คำหลักสูตร HSK 2.0 (ระดับ 1 ถึง 6)
  tools/words_ext.json   คำ HSK 3.0 ที่ไม่มีใน HSK 2.0 (ระดับ 1 ถึง 6 และ 7 หมายถึง HSK 7-9)
  tools/word_meta.json   ตัวเต็มและลักษณนามของแต่ละคำ {คำ: [ตัวเต็ม, ลักษณนาม]}
  tools/thai/*.tsv       ความหมายไทย  ตัวจีน<TAB>ความหมายไทย[<TAB>พินอินที่แก้<TAB>ความหมายอังกฤษที่แก้]

รูปแบบแต่ละคำใน HSK_WORDS: [ตัวจีน, พินอิน, ไทย, อังกฤษ, ระดับ, คำเสริมHSK3, ตัวเต็ม, ลักษณนาม]
รัน:  python3 tools/build_words.py
"""
import glob, json, os
here = os.path.dirname(os.path.abspath(__file__))
load = lambda n: json.load(open(os.path.join(here, n), encoding='utf8'))
raw, ext, meta = load('words_raw.json'), load('words_ext.json'), load('word_meta.json')
th = {}
for f in sorted(glob.glob(os.path.join(here, 'thai', '*.tsv'))):
    for line in open(f, encoding='utf8'):
        line = line.rstrip('\n')
        if not line or line.startswith('#'):
            continue
        parts = line.split('\t') + ['', '', '']
        th[parts[0]] = parts[1:4]
out, missing = [], []
for x, words in ((0, raw), (1, ext)):
    for w in words:
        h, p, en = w['h'], w['p'], w['en']
        t = ''
        if h in th:
            t, po, eo = th[h]
            p = po or p
            en = eo or en
        else:
            missing.append(h)
        trad, cls = meta.get(h, ['', ''])
        row = [h, p.replace(' ', ''), t, en, w['l'], x, trad, cls]
        while row and row[-1] in ('', 0) and len(row) > 5:
            row.pop()
        out.append(row)
dest = os.path.join(here, '..', 'js', 'data-words.js')
open(dest, 'w', encoding='utf8').write('window.HSK_WORDS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
open(os.path.join(here, 'missing_thai.txt'), 'w', encoding='utf8').write('\n'.join(missing) + '\n')
print(f'{len(out)} words written, {len(missing)} without Thai meaning (listed in tools/missing_thai.txt)')
