"""สร้าง js/data-words.js จาก tools/words_raw.json และความหมายภาษาไทยใน tools/thai/*.tsv

รูปแบบแต่ละบรรทัดใน .tsv:  ตัวจีน<TAB>ความหมายไทย[<TAB>พินอินที่แก้<TAB>ความหมายอังกฤษที่แก้]
รัน:  python3 tools/build_words.py
"""
import glob, json, os
here = os.path.dirname(os.path.abspath(__file__))
raw = json.load(open(os.path.join(here, 'words_raw.json'), encoding='utf8'))
th = {}
for f in sorted(glob.glob(os.path.join(here, 'thai', '*.tsv'))):
    for line in open(f, encoding='utf8'):
        line = line.rstrip('\n')
        if not line:
            continue
        parts = line.split('\t') + ['', '', '']
        th[parts[0]] = parts[1:4]
out, missing = [], []
for w in raw:
    h, p, en = w['h'], w['p'], w['en']
    t = ''
    if h in th:
        t, po, eo = th[h]
        p = po or p
        en = eo or en
    else:
        missing.append(h)
    out.append([h, p.replace(' ', ''), t, en, w['l']])
dest = os.path.join(here, '..', 'js', 'data-words.js')
open(dest, 'w', encoding='utf8').write('window.HSK_WORDS=' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n')
print(f'{len(out)} words written, {len(missing)} without Thai meaning')
