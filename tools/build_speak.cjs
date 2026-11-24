/* สร้าง js/data-speak.js จาก tools/speak_src.txt และใส่พินอินด้วย pinyin-pro
   รัน: NODE_PATH=<node_modules ที่มี pinyin-pro> node tools/build_speak.cjs */
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const src = fs.readFileSync(path.join(__dirname, 'speak_src.txt'), 'utf8').split('\n');
const py = zh => pinyin(zh.replace(/[A-Za-z]+/g, m => ` ${m} `), { toneType: 'symbol', nonZh: 'consecutive' })
  .replace(/，/g, ',').replace(/。/g, '.').replace(/？/g, '?').replace(/！/g, '!').replace(/、/g, ',').replace(/……/g, '...')
  .replace(/\s+([,.?!])/g, '$1').replace(/\s+/g, ' ').trim();
const phrases = [], dialogues = [];
let cat = null, dlg = null, pn = 0;
for (const raw of src) {
  const line = raw.trim();
  if (!line || line.startsWith('# ')) continue;
  let m;
  if ((m = line.match(/^## phrases (.+)$/))) { cat = m[1]; dlg = null; continue; }
  if ((m = line.match(/^## dialogue (\w+) \| (.+?) \| (\d) \| (.+)$/))) { dlg = { id: m[1], t: m[2], l: +m[3], d: m[4], lines: [] }; dialogues.push(dlg); cat = null; continue; }
  if (dlg && (m = line.match(/^([AB]): (.+?) \| (.+)$/))) { dlg.lines.push({ r: m[1], zh: m[2], py: py(m[2]), th: m[3] }); continue; }
  if (cat && (m = line.match(/^(.+?) \| (.+)$/))) { phrases.push({ id: 'p' + (++pn), c: cat, zh: m[1], py: py(m[1]), th: m[2] }); continue; }
  throw new Error('บรรทัดอ่านไม่ออก: ' + line);
}
fs.writeFileSync(path.join(__dirname, '..', 'js', 'data-speak.js'), 'window.SPEAK=' + JSON.stringify({ phrases, dialogues }) + ';\n');
console.log(phrases.length, 'phrases', dialogues.length, 'dialogues', dialogues.reduce((a, d) => a + d.lines.length, 0), 'lines');
