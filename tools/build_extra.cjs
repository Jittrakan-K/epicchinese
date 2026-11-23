/* สร้างไฟล์ข้อมูลเสริมที่เว็บโหลดเมื่อต้องใช้
     data/cedict.txt      พจนานุกรม CC-CEDICT ทั้งเล่ม (ตัวย่อ ตัวเต็ม พินอิน ความหมายอังกฤษ)
     data/sentences.json  ประโยคตัวอย่างจาก Tatoeba แปลงเป็นตัวย่อ ตัดคำ ใส่พินอิน และให้ระดับ
     data/chars.json      ส่วนประกอบและที่มาของอักษร จาก Make Me a Hanzi

   ต้องมีแพ็กเกจ npm: opencc-js pinyin-pro cedict-json tatoeba-sentence-pairs-in-mandarin-chinese-english
   และไฟล์ dictionary.txt ของ makemeahanzi
   รัน: NODE_PATH=<node_modules> node tools/build_extra.cjs <cedict.json> <sentences.json> <makemeahanzi dictionary.txt>
*/
const fs = require('fs');
const path = require('path');
const OpenCC = require('opencc-js');
const { pinyin, convert } = require('pinyin-pro');

const [cedictPath, tatoebaPath, mmahPath] = process.argv.slice(2);
const root = path.join(__dirname, '..');
const out = p => path.join(root, 'data', p);

/* ---------- คำในหลักสูตร ---------- */
const src = fs.readFileSync(path.join(root, 'js', 'data-words.js'), 'utf8');
const W = JSON.parse(src.slice(src.indexOf('['), src.lastIndexOf(']') + 1));
const levelOf = new Map();
W.forEach((w, i) => { if (!levelOf.has(w[0])) levelOf.set(w[0], { l: w[4], i }); });

/* ---------- CC-CEDICT ---------- */
const ced = JSON.parse(fs.readFileSync(cedictPath, 'utf8'));
const lines = [];
const dictWords = new Set();
for (const e of ced) {
  const py = convert(e.pinyin.replace(/u:/g, 'v'), { format: 'numToSymbol' }).replace(/\s+/g, ' ');
  const en = e.english.filter(x => !/^CL:/.test(x)).join('/');
  if (!en) continue;
  lines.push([e.simplified, e.traditional === e.simplified ? '' : e.traditional, py, en].join('\t'));
  if ([...e.simplified].length <= 6) dictWords.add(e.simplified);
}
fs.writeFileSync(out('cedict.txt'), lines.join('\n') + '\n');
console.log('cedict', lines.length);

/* ---------- ตัดคำแบบยาวสุดก่อน ---------- */
W.forEach(w => dictWords.add(w[0]));
const isHan = ch => /\p{Script=Han}/u.test(ch);
function segment(s) {
  const cs = [...s]; const tk = [];
  for (let i = 0; i < cs.length;) {
    if (!isHan(cs[i])) { let j = i; while (j < cs.length && !isHan(cs[j])) j++; tk.push(cs.slice(i, j).join('')); i = j; continue; }
    let n = Math.min(6, cs.length - i);
    while (n > 1 && !dictWords.has(cs.slice(i, i + n).join(''))) n--;
    tk.push(cs.slice(i, i + n).join('')); i += n;
  }
  return tk;
}

/* ---------- ประโยค Tatoeba ---------- */
const t2s = OpenCC.Converter({ from: 'tw', to: 'cn' });
const pairs = JSON.parse(fs.readFileSync(tatoebaPath, 'utf8'));
const byZh = new Map();
for (const [, zhRaw, , en] of pairs) {
  const zh = t2s(zhRaw.trim()).replace(/\s+/g, '');
  const n = [...zh].length;
  if (n < 3 || n > 26 || /[A-Za-z0-9]/.test(zh)) continue;
  const prev = byZh.get(zh);
  if (!prev || en.length < prev.length) byZh.set(zh, en.trim());
}
const sents = [];
for (const [zh, en] of byZh) {
  const tk = segment(zh);
  let lvl = 1, unknown = 0;
  for (const t of tk) {
    if (!isHan(t[0])) continue;
    const m = levelOf.get(t);
    if (m) lvl = Math.max(lvl, m.l);
    else { const cs = [...t]; const ml = Math.max(...cs.map(c => (levelOf.get(c) || { l: 8 }).l)); if (ml >= 8 || cs.length > 1) unknown++; lvl = Math.max(lvl, Math.min(ml, 7)); }
  }
  if (unknown > 1) continue;
  if (unknown === 1) lvl = Math.max(lvl, 7);
  sents.push({ zh, tk, en, lvl, len: [...zh].length });
}
sents.sort((a, b) => a.lvl - b.lvl || a.len - b.len);

/* เลือกประโยค: ทุกคำได้ถึง 3 ประโยคที่ง่ายและสั้นที่สุด และทุกระดับได้ประโยคอ่านเล่นเพิ่ม */
const perWord = new Map();
const keep = new Set();
sents.forEach((s, k) => {
  for (const t of new Set(s.tk)) {
    const m = levelOf.get(t); if (!m) continue;
    const a = perWord.get(m.i) || []; if (a.length < 3) { a.push(k); perWord.set(m.i, a); keep.add(k); }
  }
});
const perLevel = {};
sents.forEach((s, k) => { perLevel[s.lvl] = (perLevel[s.lvl] || 0) + 1; if (perLevel[s.lvl] <= 1200) keep.add(k); });
const kept = [...keep].sort((a, b) => a - b);
const remap = new Map(kept.map((k, j) => [k, j]));
const S = kept.map(k => {
  const s = sents[k];
  const py = s.tk.map(t => isHan(t[0]) ? pinyin(t, { toneType: 'symbol' }).replace(/\s+/g, '') : t).join('|');
  return [s.tk.join('|'), py, s.en, s.lvl];
});
const widx = W.map((_, i) => (perWord.get(i) || []).map(k => remap.get(k)));
fs.writeFileSync(out('sentences.json'), JSON.stringify({ s: S, w: widx }));
console.log('sentences', S.length, 'words with sentences', widx.filter(a => a.length).length, 'of', W.length);

/* ---------- ส่วนประกอบอักษร ---------- */
const need = new Set(); W.forEach(w => [...w[0]].forEach(c => need.add(c)));
const chars = {};
for (const line of fs.readFileSync(mmahPath, 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const c = JSON.parse(line);
  if (!need.has(c.character)) continue;
  const e = c.etymology || {};
  chars[c.character] = [c.definition || '', (c.decomposition || '').replace(/？/g, ''), c.radical || '', e.type || '', e.hint || '', e.semantic || '', e.phonetic || ''];
}
fs.writeFileSync(out('chars.json'), JSON.stringify(chars));
console.log('chars', Object.keys(chars).length, 'of', need.size);
