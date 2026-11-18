/* Epic Chinese — แอปเรียนภาษาจีนจากศูนย์ถึง HSK 6
   ไม่มี build step: เปิด index.html ได้เลย หรือวางบน GitHub Pages */
(() => {
  'use strict';

  /* ---------- helpers ---------- */
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ic = (n, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${(window.ICONS || {})[n] || ''}</svg>`;
  const fmt = n => Number(n).toLocaleString('en-US');
  const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a, n) => shuffle(a).slice(0, n);
  const DAY = 864e5;
  const CN = '零一二三四五六七八九';
  const cn = n => n < 10 ? CN[n] : n < 20 ? '十' + (n % 10 ? CN[n % 10] : '') : CN[(n / 10) | 0] + '十' + (n % 10 ? CN[n % 10] : '');
  const pct = (a, b) => b ? Math.round((a / b) * 100) : 0;
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const dkey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const C = window.CONTENT;

  /* ---------- data ---------- */
  const W = window.HSK_WORDS.map((a, i) => ({ id: i, h: a[0], p: a[1], th: a[2], en: a[3], l: a[4] }));
  const mean = w => w.th || w.en;
  const short = w => w.th || w.en.split(';').slice(0, 2).join(';');
  const LEVELS = [1, 2, 3, 4, 5, 6];
  const SIZE = { 1: 15, 2: 15, 3: 20, 4: 25, 5: 30, 6: 40 };
  const UNITS = {};
  const unitOf = {};
  LEVELS.forEach(l => {
    const ws = W.filter(w => w.l === l);
    const s = SIZE[l];
    const chunks = [];
    for (let i = 0; i < ws.length; i += s) chunks.push(ws.slice(i, i + s));
    if (chunks.length > 1 && chunks[chunks.length - 1].length < s / 2) { const last = chunks.pop(); chunks[chunks.length - 1] = chunks[chunks.length - 1].concat(last); }
    UNITS[l] = chunks.map((words, i) => ({ key: `${l}-${i + 1}`, level: l, n: i + 1, words }));
    UNITS[l].forEach(u => u.words.forEach(w => { unitOf[w.id] = u; }));
  });
  const BASE = [
    { key: 'tones', glyph: '声', title: 'วรรณยุกต์ 4 เสียง', sub: '妈 麻 马 骂' },
    { key: 'pinyin', glyph: '拼', title: 'พินอิน พยัญชนะและสระ', sub: 'b p m f' },
    { key: 'strokes', glyph: '笔', title: 'ขีดและลำดับการเขียน', sub: '一 丨 丿 丶' },
    { key: 'radicals', glyph: '部', title: 'หมวดนำ ตัวช่วยจำอักษร', sub: '亻 口 氵 木' }
  ];
  const INT = [0, 1, 2, 4, 7, 15, 30, 60, 120];

  /* ---------- store ---------- */
  const KEY = 'epicchinese.v1';
  const DEF = { units: {}, base: {}, tests: {}, srs: {}, written: {}, xp: 0, days: {}, settings: { pinyin: true, rate: 0.85, goal: 50, theme: 'auto', free: false } };
  const clone = o => JSON.parse(JSON.stringify(o));
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && typeof s === 'object') return Object.assign(clone(DEF), s, { settings: Object.assign(clone(DEF.settings), s.settings || {}) });
    } catch (e) { /* ignore */ }
    return clone(DEF);
  }
  let S = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage full or blocked */ } };

  function addXP(n) {
    S.xp += n;
    const k = dkey();
    S.days[k] = (S.days[k] || 0) + n;
    save();
    renderMeta();
  }
  const todayXP = () => S.days[dkey()] || 0;
  function streak() {
    let n = 0;
    const d = new Date();
    if (!S.days[dkey(d)]) d.setDate(d.getDate() - 1);
    while (S.days[dkey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  /* ---------- progress ---------- */
  const unitDone = k => !!(S.units[k] && S.units[k].done);
  const levelPassed = l => !!(S.tests[l] && S.tests[l].passed);
  const levelDone = l => levelPassed(l) || UNITS[l].every(u => unitDone(u.key));
  const baseDoneAll = () => BASE.every(b => S.base[b.key]);
  const levelUnlocked = l => l === 1 || S.settings.free || levelDone(l - 1) || UNITS[l].some(u => unitDone(u.key));
  const unitUnlocked = (l, n) => S.settings.free || levelPassed(l) || unitDone(`${l}-${n}`) || (n === 1 ? levelUnlocked(l) : unitDone(`${l}-${n - 1}`));
  const learnedIds = () => { const ids = []; LEVELS.forEach(l => UNITS[l].forEach(u => { if (unitDone(u.key)) u.words.forEach(w => ids.push(w.id)); })); return ids; };
  const unitsDoneIn = l => UNITS[l].filter(u => unitDone(u.key)).length;

  function current() {
    const anyHSK = Object.values(S.units).some(u => u.done);
    if (!anyHSK) for (const b of BASE) if (!S.base[b.key]) return { type: 'base', key: b.key, level: 0, b };
    for (const l of LEVELS) {
      if (levelPassed(l)) continue;
      const u = UNITS[l].find(x => !unitDone(x.key));
      if (u) return { type: 'unit', level: l, unit: u };
      const nextStarted = l < 6 && UNITS[l + 1].some(x => unitDone(x.key));
      if (!nextStarted) return { type: 'test', level: l };
    }
    return { type: 'done', level: 6 };
  }
  const curLevel = () => current().level;

  /* ---------- spaced repetition ---------- */
  function addToSRS(ids) {
    const now = Date.now();
    ids.forEach(id => { if (!S.srs[id]) S.srs[id] = { b: 1, d: now + DAY * 0.9 }; });
    save();
  }
  const dueIds = () => { const now = Date.now(); return Object.keys(S.srs).filter(id => S.srs[id].d <= now).map(Number); };
  function grade(id, g) {
    const c = S.srs[id] || { b: 1, d: 0 };
    if (g === 0) { c.b = 1; c.d = Date.now() + 10 * 60e3; }
    else { c.b = Math.min(8, c.b + g); c.d = Date.now() + INT[c.b] * DAY * 0.95; }
    S.srs[id] = c;
    save();
  }
  function nextDueText() {
    const ds = Object.values(S.srs).map(c => c.d).filter(d => d > Date.now());
    if (!ds.length) return '';
    const m = Math.min(...ds) - Date.now();
    if (m < 3600e3) return `อีก ${Math.max(1, Math.round(m / 60e3))} นาที`;
    if (m < DAY) return `อีก ${Math.round(m / 3600e3)} ชั่วโมง`;
    return `อีก ${Math.round(m / DAY)} วัน`;
  }

  /* ---------- speech ---------- */
  let voice = null; let warned = false;
  const hasTTS = 'speechSynthesis' in window;
  function pickVoice() {
    const vs = speechSynthesis.getVoices();
    voice = vs.find(v => /zh[-_]CN/i.test(v.lang) && /xiaoxiao|yunxi|google|ting|tian/i.test(v.name))
      || vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang) && !/HK|yue/i.test(v.lang)) || null;
  }
  if (hasTTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function speak(text, rate) {
    if (!hasTTS) { toast('เบราว์เซอร์นี้อ่านออกเสียงไม่ได้'); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (voice) u.voice = voice;
    u.rate = rate || S.settings.rate;
    speechSynthesis.speak(u);
    if (!voice && !warned) { warned = true; toast('ไม่พบเสียงภาษาจีนในเครื่อง ลองติดตั้งเสียง Chinese (zh-CN) ในการตั้งค่าภาษาของระบบ'); }
  }

  /* ---------- pinyin utils ---------- */
  const TONES = { a: 'āáǎà', e: 'ēéěè', i: 'īíǐì', o: 'ōóǒò', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  const MARK = {};
  Object.entries(TONES).forEach(([v, s]) => [...s].forEach((c, i) => { MARK[c] = [v, i + 1]; MARK[c.toUpperCase()] = [v.toUpperCase(), i + 1]; }));
  function retone(p) {
    const ch = [...p];
    const idx = ch.map((c, i) => MARK[c] ? i : -1).filter(i => i >= 0);
    if (!idx.length) return null;
    const i = idx[(Math.random() * idx.length) | 0];
    const [v, t] = MARK[ch[i]];
    let nt; do { nt = 1 + ((Math.random() * 4) | 0); } while (nt === t);
    const low = v.toLowerCase();
    const mk = TONES[low][nt - 1];
    ch[i] = v === low ? mk : mk.toUpperCase();
    return ch.join('');
  }
  const plain = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ü/g, 'v').toLowerCase().replace(/[\s']/g, '');

  /* ---------- stroke data ---------- */
  function charLoader(ch, done, fail) {
    const cdn = () => fetch(`https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(ch)}.json`).then(r => r.json()).then(done).catch(fail);
    fetch(`data/strokes/${encodeURIComponent(ch)}.json`).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(done).catch(cdn);
  }
  const MIZI = `<svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><g stroke="currentColor" stroke-width="1" stroke-dasharray="3 3" opacity=".35" vector-effect="non-scaling-stroke"><line x1="0" y1="50" x2="100" y2="50" vector-effect="non-scaling-stroke"/><line x1="50" y1="0" x2="50" y2="100" vector-effect="non-scaling-stroke"/><line x1="0" y1="0" x2="100" y2="100" vector-effect="non-scaling-stroke"/><line x1="100" y1="0" x2="0" y2="100" vector-effect="non-scaling-stroke"/></g></svg>`;
  function writerBox(ch, size, extra = {}) {
    const box = document.createElement('div');
    box.className = 'mizi' + (size < 120 ? ' small' : '');
    box.style.width = box.style.height = size + 'px';
    box.innerHTML = MIZI;
    const t = document.createElement('div');
    t.className = 'hw';
    box.appendChild(t);
    let w = null;
    if (window.HanziWriter) {
      w = HanziWriter.create(t, ch, Object.assign({
        width: size, height: size, padding: Math.round(size * 0.08), showCharacter: true, showOutline: true,
        strokeColor: cssVar('--text'), outlineColor: cssVar('--line-2'), highlightColor: cssVar('--accent'),
        drawingColor: cssVar('--text'), drawingWidth: Math.max(4, Math.round(size / 28)),
        strokeAnimationSpeed: 1.1, delayBetweenStrokes: 160, charDataLoader: charLoader,
        onLoadCharDataError: () => { t.innerHTML = `<div class="han" style="font-size:${size * 0.72}px;line-height:${size}px;text-align:center">${esc(ch)}</div>`; }
      }, extra));
    } else {
      t.innerHTML = `<div class="han" style="font-size:${size * 0.72}px;line-height:${size}px;text-align:center">${esc(ch)}</div>`;
    }
    return { el: box, w };
  }
  const animate = w => new Promise(res => { if (!w) return res(); w.animateCharacter({ onComplete: res }); });
  async function animateWord(host, text, size) {
    host.innerHTML = '';
    const ws = [...text].filter(c => /[一-鿿]/.test(c)).map(c => { const b = writerBox(c, size, { showCharacter: false }); host.appendChild(b.el); return b.w; });
    for (const w of ws) { if (!host.isConnected) return; await animate(w); }
  }

  /* ---------- chrome ---------- */
  const app = $('#app');
  const NAV = [
    ['/', 'map', 'แผนที่'], ['/review', 'rotate-ccw', 'ทบทวน'], ['/dict', 'book-open', 'คลังคำ'],
    ['/grammar', 'scroll-text', 'ไวยากรณ์'], ['/sounds', 'audio-lines', 'ฝึกเสียง'], ['/stats', 'chart-column', 'สถิติ']
  ];
  function navOn(path, href) {
    if (href === '/') return path === '/' || /^\/(level|unit|test|base)/.test(path);
    return path.startsWith(href);
  }
  function renderChrome(path) {
    const due = dueIds().length;
    const link = ([href, icon, label]) => `<a href="#${href}" class="${navOn(path, href) ? 'on' : ''}">${ic(icon)}<span class="lbl">${label}</span>${href === '/review' && due ? `<span class="count">${due}</span>` : ''}</a>`;
    $('#nav').innerHTML = NAV.map(link).join('');
    $('#tabbar').innerHTML = NAV.filter(n => n[0] !== '/grammar').map(link).join('');
    renderMeta();
  }
  function renderMeta() {
    const st = streak(); const t = todayXP(); const g = S.settings.goal;
    const el = $('#topmeta'); if (!el) return;
    el.innerHTML = `<span class="item" title="วันที่เรียนต่อเนื่อง">${ic('flame', 's16')}<span class="mono">${st} วัน</span></span>
      <span class="item goal" title="เป้าหมายวันนี้"><span class="mono">${t}/${g} XP</span><span class="goal-bar"><i style="width:${Math.min(100, pct(t, g))}%"></i></span></span>`;
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    $('#toasts').appendChild(t);
    setTimeout(() => { t.style.transition = 'opacity 200ms'; t.style.opacity = '0'; setTimeout(() => t.remove(), 220); }, 2600);
  }
  function modal(html, mount) {
    const scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><button class="btn ghost icon-only x" aria-label="ปิด">${ic('x')}</button>${html}</div>`;
    const close = () => { scrim.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape') close(); };
    scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
    $('.x', scrim).onclick = close;
    document.addEventListener('keydown', onKey);
    document.body.appendChild(scrim);
    if (mount) mount($('.modal', scrim), close);
    return close;
  }

  /* ---------- router ---------- */
  let cleanups = [];
  const onView = (type, fn, target = window) => { target.addEventListener(type, fn); cleanups.push(() => target.removeEventListener(type, fn)); };
  const ROUTES = [
    [/^\/$/, () => viewHome()],
    [/^\/level\/([0-6])$/, m => viewLevel(+m[1])],
    [/^\/unit\/([1-6])-(\d+)(?:\/(words|write|quiz))?$/, m => viewUnit(+m[1], +m[2], m[3] || 'words')],
    [/^\/test\/([1-6])$/, m => viewTest(+m[1])],
    [/^\/base\/(tones|pinyin|strokes|radicals)$/, m => viewBase(m[1])],
    [/^\/review$/, () => viewReview()],
    [/^\/dict$/, () => viewDict()],
    [/^\/grammar(?:\/([1-6]))?$/, m => viewGrammar(+(m[1] || Math.max(1, curLevel())))],
    [/^\/sounds$/, () => viewSounds()],
    [/^\/stats$/, () => viewStats()]
  ];
  function route() {
    cleanups.forEach(f => f()); cleanups = [];
    if (hasTTS) speechSynthesis.cancel();
    const path = location.hash.replace(/^#/, '') || '/';
    for (const [re, fn] of ROUTES) {
      const m = path.match(re);
      if (m) { app.innerHTML = ''; renderChrome(path); fn(m); window.scrollTo(0, 0); return; }
    }
    location.hash = '#/';
  }
  window.addEventListener('hashchange', route);

  /* ---------- hero map ---------- */
  const TRAIL = [[455, 428], [590, 404], [690, 372], [760, 318], [815, 258], [858, 192], [890, 104]];
  function segs(pts) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2, t = 1 / 6;
      out.push(`C${(p1.x + (p2.x - p0.x) * t).toFixed(1)},${(p1.y + (p2.y - p0.y) * t).toFixed(1)} ${(p2.x - (p3.x - p1.x) * t).toFixed(1)},${(p2.y - (p3.y - p1.y) * t).toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`);
    }
    return out;
  }
  function stationState(i) {
    const cl = curLevel();
    if (i === 0) return baseDoneAll() ? 'done' : (cl === 0 ? 'cur' : 'todo');
    if (levelDone(i)) return 'done';
    return cl === i ? 'cur' : 'todo';
  }
  function heroSVG() {
    const narrow = matchMedia('(max-width: 760px)').matches;
    const vb = narrow ? '430 56 640 400' : '0 0 1200 460';
    const par = narrow ? 'xMidYMid meet' : 'xMaxYMax slice';
    const pts = TRAIL.map(([x, y]) => ({ x, y }));
    const sg = segs(pts);
    const states = pts.map((_, i) => stationState(i));
    let k = states.findIndex(s => s !== 'done'); if (k === -1) k = pts.length - 1;
    const solid = k > 0 ? `M${pts[0].x},${pts[0].y} ${sg.slice(0, k).join(' ')}` : '';
    const dashed = k < pts.length - 1 ? `M${pts[k].x},${pts[k].y} ${sg.slice(k).join(' ')}` : '';
    const names = ['ฐาน', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'];
    const marks = pts.map((p, i) => {
      const s = states[i];
      const m = s === 'done'
        ? `<rect x="${p.x - 8}" y="${p.y - 8}" width="16" height="16" rx="3" transform="rotate(-6 ${p.x} ${p.y})" style="fill:var(--accent)"/>`
        : s === 'cur'
          ? `<circle class="st-ring" cx="${p.x}" cy="${p.y}" r="14" fill="none" style="stroke:var(--accent)" stroke-width="2"/><circle cx="${p.x}" cy="${p.y}" r="8" fill="currentColor"/>`
          : `<circle class="st-ring" cx="${p.x}" cy="${p.y}" r="7" style="fill:var(--card)" stroke="currentColor" stroke-width="1.5"/>`;
      const flag = i === 6 ? `<path d="M${p.x} ${p.y - 10} V${p.y - 42}" stroke="currentColor" stroke-width="1.5"/><path d="M${p.x} ${p.y - 42} L${p.x + 22} ${p.y - 36} L${p.x} ${p.y - 30} Z" style="fill:${s === 'done' ? 'var(--accent)' : 'none'}" stroke="${s === 'done' ? 'none' : 'currentColor'}" stroke-width="1.2"/>` : '';
      return `<g class="st-hit" data-go="#/level/${i}" role="link" tabindex="0" aria-label="${names[i]}"><circle cx="${p.x}" cy="${p.y}" r="22" fill="transparent"/>${flag}${m}<text class="st-label ${s === 'cur' ? 'on' : ''}" x="${p.x + 20}" y="${p.y + (narrow ? 6 : 4)}" style="${narrow ? 'font-size:17px' : ''}">${names[i]}</text></g>`;
    }).join('');
    const pine = (x, y, s = 1) => `<path d="M${x} ${y} l${-7 * s} 0 l${7 * s} ${-13 * s} l${7 * s} ${13 * s} z M${x} ${y - 7 * s} l${-5 * s} 0 l${5 * s} ${-10 * s} l${5 * s} ${10 * s} z" fill="currentColor" opacity=".42"/><path d="M${x} ${y} v${4 * s}" stroke="currentColor" opacity=".42"/>`;
    return `<svg class="land" viewBox="${vb}" preserveAspectRatio="${par}" role="img" aria-label="แผนที่เส้นทางจากฐานถึงยอดเขา HSK 6">
      <defs>
        <linearGradient id="gFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".1"/><stop offset="1" stop-color="currentColor" stop-opacity=".015"/></linearGradient>
        <linearGradient id="gMid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".2"/><stop offset="1" stop-color="currentColor" stop-opacity=".03"/></linearGradient>
        <linearGradient id="gMain" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".32"/><stop offset=".7" stop-color="currentColor" stop-opacity=".07"/><stop offset="1" stop-color="currentColor" stop-opacity=".04"/></linearGradient>
        <radialGradient id="gMist"><stop offset="0" style="stop-color:var(--card);stop-opacity:var(--mist)"/><stop offset="1" style="stop-color:var(--card)" stop-opacity="0"/></radialGradient>
      </defs>
      <circle cx="1018" cy="116" r="42" style="fill:var(--accent)" opacity=".9"/>
      <path d="M958 178 q6 -6 12 0 q6 -6 12 0 M1000 200 q4 -4 8 0 q4 -4 8 0" stroke="currentColor" stroke-width="1.3" fill="none" opacity=".45" stroke-linecap="round"/>
      <path d="M300 460 L300 336 C360 322 400 292 450 298 C500 304 530 272 580 264 C640 254 660 216 720 208 C780 200 800 232 850 224 C900 216 960 170 1030 178 C1090 184 1130 216 1200 222 L1200 460 Z" fill="url(#gFar)"/>
      <path d="M640 460 C720 400 780 362 840 332 C900 302 960 232 1010 216 C1050 204 1080 192 1110 208 C1150 228 1170 252 1200 264 L1200 460 Z" fill="url(#gMid)"/>
      <path d="M520 460 C600 432 660 392 710 342 C760 292 800 222 840 162 C860 130 876 102 890 94 C904 88 916 98 928 116 C960 162 990 222 1030 272 C1070 322 1120 352 1200 374 L1200 460 Z" fill="url(#gMain)"/>
      <g stroke="currentColor" fill="none" stroke-linecap="round" opacity=".22" stroke-width="1.2">
        <path d="M908 112 C926 158 938 196 952 238"/><path d="M920 130 C948 176 970 214 994 252"/>
        <path d="M1082 196 C1094 214 1114 232 1140 246"/>
      </g>
      <ellipse cx="760" cy="300" rx="250" ry="26" fill="url(#gMist)"/>
      <ellipse cx="1070" cy="318" rx="190" ry="22" fill="url(#gMist)"/>
      <path d="M0 460 L0 434 C140 422 260 428 380 416 C480 406 560 422 650 406 C740 392 800 412 900 400 C1000 390 1080 406 1200 394 L1200 460 Z" fill="currentColor" opacity=".08"/>
      <path d="M930 460 C990 432 1050 420 1110 412 C1150 406 1180 402 1200 400 L1200 460 Z" fill="currentColor" opacity=".14"/>
      ${pine(1000, 404)}${pine(1018, 400, 0.85)}${pine(1140, 398, 1.1)}${pine(1160, 402, 0.8)}${pine(400, 424, 0.8)}
      ${solid ? `<path d="${solid}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".75"/>` : ''}
      ${dashed ? `<path d="${dashed}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="1 7" stroke-linecap="round" opacity=".7"/>` : ''}
      ${marks}
    </svg>`;
  }
  function bindHero(root) {
    $$('.st-hit', root).forEach(g => {
      const go = () => { location.hash = g.dataset.go; };
      g.addEventListener('click', go);
      g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
  }

  /* ---------- level path ---------- */
  function pathItems(l) {
    const cur = current();
    if (l === 0) {
      return BASE.map(b => ({
        title: b.title, sub: b.sub, glyph: b.glyph, href: `#/base/${b.key}`,
        state: S.base[b.key] ? 'done' : (cur.type === 'base' && cur.key === b.key ? 'cur' : 'open')
      }));
    }
    let openMarked = false;
    const items = UNITS[l].map(u => {
      let state;
      if (unitDone(u.key)) state = 'done';
      else if (cur.type === 'unit' && cur.unit.key === u.key) state = 'cur';
      else if (unitUnlocked(l, u.n)) { state = openMarked ? 'open' : 'open'; openMarked = true; }
      else state = 'lock';
      return { title: `บทที่ ${u.n}`, sub: u.words.slice(0, 4).map(w => w.h).join(' '), glyph: cn(u.n), href: `#/unit/${u.key}`, state, han: true, unitN: u.n };
    });
    const t = S.tests[l];
    items.push({
      title: `สอบวัดระดับ HSK ${l}`, sub: levelPassed(l) ? `ผ่านแล้ว ${t.best}%` : 'ผ่าน 80% เพื่อประทับตราทั้งระดับ',
      glyph: '考', href: `#/test/${l}`, state: levelPassed(l) ? 'done' : (cur.type === 'test' && cur.level === l ? 'cur' : 'open'), gate: true
    });
    return items;
  }
  function drawPath(host, l) {
    const items = pathItems(l);
    const w = host.clientWidth || 600;
    const narrow = w < 520;
    const cx = w / 2, A = Math.min(120, w * 0.2), gap = narrow ? 92 : 100;
    const pts = items.map((_, i) => ({ x: cx + A * Math.sin(i * Math.PI / 3), y: 52 + i * gap }));
    host.style.height = (pts[pts.length - 1].y + 60) + 'px';
    const sg = segs(pts);
    let k = items.findIndex(it => it.state !== 'done'); if (k === -1) k = pts.length - 1;
    const solid = k > 0 ? `M${pts[0].x},${pts[0].y} ${sg.slice(0, k).join(' ')}` : '';
    const dashed = k < pts.length - 1 ? `M${pts[k].x},${pts[k].y} ${sg.slice(k).join(' ')}` : '';
    const lw = narrow ? 132 : 200;
    const nodes = items.map((it, i) => {
      const p = pts[i];
      const left = Math.sin(i * Math.PI / 3) > 0.2;
      const lx = left ? Math.max(4, p.x - 44 - lw) : p.x + 44;
      const width = left ? Math.min(lw, p.x - 44 - 4) : Math.min(lw, w - p.x - 44);
      const label = it.state === 'cur' ? (it.gate ? 'พร้อมสอบแล้ว' : 'ต่อจากตรงนี้') : it.sub;
      return `<button class="node ${it.state} ${it.gate ? 'gate' : ''}" style="left:${p.x}px;top:${p.y}px" data-href="${it.href}" data-i="${i}" aria-label="${esc(it.title)}">
          <span class="disc">${it.state === 'lock' ? ic('lock', 's16') : esc(it.glyph)}</span></button>
        <div class="node-label ${left ? 'l' : ''} ${it.state === 'cur' ? 'cur' : ''}" style="left:${lx}px;top:${p.y}px;width:${width}px">
          <b>${esc(it.title)}</b>${it.han && it.state !== 'cur' ? `<span class="han">${esc(label)}</span>` : `<span>${esc(label)}</span>`}</div>`;
    }).join('');
    host.innerHTML = `<svg width="${w}" height="${host.style.height}" aria-hidden="true">
        ${solid ? `<path d="${solid}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>` : ''}
        ${dashed ? `<path d="${dashed}" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="1 9" stroke-linecap="round" opacity=".55"/>` : ''}
      </svg>${nodes}`;
    $$('.node', host).forEach(b => b.addEventListener('click', () => {
      const it = items[+b.dataset.i];
      if (it.state === 'lock') { toast(`ผ่านบทที่ ${it.unitN - 1} ก่อน หรือเปิดโหมดอิสระในหน้าสถิติ`); return; }
      location.hash = it.href;
    }));
    const curNode = $('.node.cur', host);
    return curNode;
  }
  function mountPath(host, l, scrollToCur) {
    const draw = () => drawPath(host, l);
    const curNode = draw();
    let t; onView('resize', () => { clearTimeout(t); t = setTimeout(draw, 120); });
    if (scrollToCur && curNode) {
      const y = curNode.getBoundingClientRect().top + window.scrollY;
      if (y > window.innerHeight * 0.9) setTimeout(() => window.scrollTo({ top: y - window.innerHeight / 2, behavior: 'smooth' }), 300);
    }
  }

  /* ---------- side cards ---------- */
  function todayCard() {
    const t = todayXP(), g = S.settings.goal, due = dueIds().length;
    return `<div class="card pad side-card">
      <h3>วันนี้</h3>
      <div class="row" style="margin-top:12px;align-items:baseline;gap:8px"><span class="stat-big">${t}</span><span class="muted mono">/ ${g} XP</span></div>
      <div class="bar accent" style="margin-top:12px"><i style="width:${Math.min(100, pct(t, g))}%"></i></div>
      <div style="margin-top:16px">
        <div class="kv"><span>เรียนต่อเนื่อง</span><span>${streak()} วัน</span></div>
        <div class="kv"><span>รอทบทวน</span><span>${due} คำ</span></div>
        <div class="kv"><span>คำที่เรียนแล้ว</span><span>${fmt(learnedIds().length)}</span></div>
      </div>
      ${due ? `<a class="btn" style="width:100%;margin-top:16px" href="#/review">${ic('rotate-ccw')}ทบทวน ${due} คำ</a>` : ''}
    </div>`;
  }
  function levelRow(l, sel) {
    const isBase = l === 0;
    const done = isBase ? baseDoneAll() : levelDone(l);
    const cl = curLevel();
    const total = isBase ? BASE.length : UNITS[l].length;
    const d = isBase ? BASE.filter(b => S.base[b.key]).length : unitsDoneIn(l);
    const name = isBase ? 'ฐาน' : `HSK ${l}`;
    const info = isBase ? 'เสียง พินอิน ขีด' : C.levelInfo[l].name;
    return `<a class="lv-row ${sel === l ? 'on' : ''}" href="#/level/${l}">
      <span class="lv-badge ${done ? 'done' : cl === l ? 'cur' : ''}">${isBase ? '基' : cn(l)}</span>
      <span><b style="font-weight:500">${name}</b> <span class="muted" style="font-size:13px">${info}</span>
        <span class="bar" style="margin-top:6px;display:block"><i style="width:${pct(d, total)}%"></i></span></span>
      <span class="lv-tag" style="text-align:right">${d}/${total}</span></a>`;
  }
  const levelsCard = sel => `<div class="card pad"><h3>ทุกระดับ</h3><p class="muted" style="font-size:13px">${fmt(W.length)} คำ ตามหลักสูตร HSK 2.0</p>
      <div class="lv-list" style="margin:12px -12px -8px">${[0, ...LEVELS].map(l => levelRow(l, sel)).join('')}</div></div>`;

  function primaryCTA(cur) {
    if (cur.type === 'base') {
      const fresh = !Object.keys(S.base).length && !S.xp;
      return `<a class="btn red lg" href="#/base/${cur.key}">${fresh ? 'เริ่มจากก้าวแรก' : 'เรียนต่อ'}: ${cur.b.title}${ic('arrow-right')}</a>`;
    }
    if (cur.type === 'unit') return `<a class="btn red lg" href="#/unit/${cur.unit.key}">เรียนต่อ: HSK ${cur.level} บทที่ ${cur.unit.n}${ic('arrow-right')}</a>`;
    if (cur.type === 'test') return `<a class="btn red lg" href="#/test/${cur.level}">สอบวัดระดับ HSK ${cur.level}${ic('arrow-right')}</a>`;
    return `<a class="btn red lg" href="#/review">ทบทวนคำศัพท์${ic('arrow-right')}</a>`;
  }
  function secondaryCTA() {
    const due = dueIds().length;
    if (due) return `<a class="btn lg" href="#/review">${ic('rotate-ccw')}ทบทวน ${due} คำ</a>`;
    if (!learnedIds().length) return `<a class="btn lg" href="#/test/1">${ic('flag')}มีพื้นฐานแล้ว สอบข้ามระดับ</a>`;
    return `<a class="btn lg" href="#/dict">${ic('book-open')}เปิดคลังคำ</a>`;
  }

  /* ---------- views: home & level ---------- */
  function viewHome() {
    const cur = current(); const lv = cur.level;
    const title = lv === 0 ? 'ฐาน: ปูพื้นก่อนเริ่ม HSK' : `HSK ${lv} · ${C.levelInfo[lv].name}`;
    app.innerHTML = `<div class="enter">
      <section class="hero">${heroSVG()}
        <div class="hero-text">
          <h1>千里之行，<br>始于足下</h1>
          <p class="tr">การเดินทางพันลี้ เริ่มต้นจากก้าวแรก</p>
          <p class="lead">เส้นทางเรียนภาษาจีนสำหรับคนไทย จากยังไม่รู้สักตัวไปจนถึง HSK 6 ทีละบท ฟัง อ่าน เขียน และทบทวนในที่เดียว</p>
          <div class="actions">${primaryCTA(cur)}${secondaryCTA()}</div>
          <p class="meta mono">เรียนแล้ว ${fmt(learnedIds().length)} จาก ${fmt(W.length)} คำ</p>
        </div>
      </section>
      <section class="section grid-2">
        <div>
          <div class="section-head"><div><h2>${esc(title)}</h2><p class="muted" style="font-size:14px;margin-top:4px">${lv === 0 ? 'ฝึกหูและมือให้คุ้นกับภาษาจีน ทำข้ามได้ถ้ามีพื้นฐานแล้ว' : esc(C.levelInfo[lv].blurb)}</p></div>
            <a class="link" href="#/level/${lv}">ดูทั้งระดับ${ic('chevron-right', 's16')}</a></div>
          <div class="path-wrap" id="path"></div>
        </div>
        <aside class="stack">${todayCard()}${levelsCard(lv)}</aside>
      </section></div>`;
    bindHero(app);
    mountPath($('#path'), lv, false);
    let t; onView('resize', () => { clearTimeout(t); t = setTimeout(() => { const h = $('.hero'); if (h) { $('svg.land', h).outerHTML = heroSVG(); bindHero(h); } }, 150); });
  }

  function viewLevel(l) {
    const isBase = l === 0;
    const total = isBase ? BASE.length : UNITS[l].length;
    const d = isBase ? BASE.filter(b => S.base[b.key]).length : unitsDoneIn(l);
    const words = isBase ? 0 : UNITS[l].reduce((a, u) => a + u.words.length, 0);
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div>
        <div class="crumb"><a href="#/">แผนที่</a>${ic('chevron-right', 's16')}<span>${isBase ? 'ฐาน' : `HSK ${l}`}</span></div>
        <h1>${isBase ? 'ฐาน · ปูพื้นก่อนเริ่ม' : `HSK ${l} · ${esc(C.levelInfo[l].name)}`}</h1>
        <p class="lead">${isBase ? 'วรรณยุกต์ พินอิน ขีด และหมวดนำ สี่เรื่องที่ทำให้ทุกบทต่อจากนี้ง่ายขึ้น' : esc(C.levelInfo[l].blurb)}</p>
      </div></div>
      <div class="grid-2">
        <div class="path-wrap" id="path"></div>
        <aside class="stack">
          <div class="card pad">
            <h3>${isBase ? 'ความคืบหน้า' : 'ระดับนี้'}</h3>
            <div class="row" style="margin-top:12px;align-items:baseline;gap:8px"><span class="stat-big">${d}</span><span class="muted mono">/ ${total} ${isBase ? 'ด่าน' : 'บท'}</span></div>
            <div class="bar accent" style="margin-top:12px"><i style="width:${pct(d, total)}%"></i></div>
            ${isBase ? '' : `<div style="margin-top:16px">
              <div class="kv"><span>คำศัพท์</span><span>${fmt(words)} คำ</span></div>
              <div class="kv"><span>คำต่อบท</span><span>${SIZE[l]} คำ</span></div>
              <div class="kv"><span>สอบวัดระดับ</span><span>${levelPassed(l) ? `ผ่าน ${S.tests[l].best}%` : 'ยังไม่สอบ'}</span></div>
              <div class="kv"><span>ความหมาย</span><span>${l <= 3 ? 'ไทย + อังกฤษ' : 'อังกฤษ'}</span></div>
            </div>
            <div class="stack" style="gap:8px;margin-top:16px">
              <a class="btn" href="#/grammar/${l}">${ic('scroll-text')}ไวยากรณ์ HSK ${l}</a>
              <a class="btn" href="#/test/${l}">${ic('flag')}${levelPassed(l) ? 'สอบอีกครั้ง' : 'สอบข้ามระดับ'}</a>
            </div>`}
          </div>
          ${levelsCard(l)}
        </aside>
      </div></div>`;
    mountPath($('#path'), l, true);
  }

  /* ---------- quiz engine ---------- */
  function wordQuestions(words, n, pool) {
    pool = pool || words;
    const list = [];
    let src = shuffle(words);
    while (list.length < n) { list.push(...src); src = shuffle(words); }
    const types = ['meaning', 'hanzi', 'listen', 'pinyin'];
    return list.slice(0, n).map((w, i) => makeQ(w, types[(i + ((Math.random() * 2) | 0)) % 4], pool));
  }
  function distract(w, pool, k, key) {
    const seen = new Set([key(w)]);
    const same = shuffle(pool.filter(x => x.id !== w.id && [...x.h].length === [...w.h].length));
    const rest = shuffle(pool.filter(x => x.id !== w.id));
    const out = [];
    for (const x of [...same, ...rest, ...shuffle(W.filter(x => x.l === w.l))]) {
      const v = key(x);
      if (!seen.has(v)) { seen.add(v); out.push(x); }
      if (out.length === k) break;
    }
    return out;
  }
  function makeQ(w, type, pool) {
    const showPy = S.settings.pinyin;
    if (type === 'pinyin') {
      const opts = new Set([w.p]);
      for (let t = 0; t < 20 && opts.size < 4; t++) { const r = retone(w.p); if (r) opts.add(r); }
      if (opts.size < 4) distract(w, pool, 4, x => x.p).forEach(x => { if (opts.size < 4) opts.add(x.p); });
      return {
        ask: 'เลือกพินอินที่ถูกต้อง', prompt: `<span class="han">${esc(w.h)}</span><span class="mean" style="font-size:16px;color:var(--text-2)">${esc(short(w))}</span>`,
        options: shuffle([...opts]).map(p => ({ html: esc(p), ok: p === w.p })), word: w, say: w.h, sayAfter: true
      };
    }
    if (type === 'meaning') {
      const ds = distract(w, pool, 3, x => short(x));
      return {
        ask: 'คำนี้แปลว่าอะไร', prompt: `<span class="han">${esc(w.h)}</span>${showPy ? `<span class="py">${esc(w.p)}</span>` : ''}`,
        options: shuffle([w, ...ds]).map(x => ({ html: esc(short(x)), ok: x.id === w.id })), word: w, say: w.h, sayAfter: true
      };
    }
    const ds = distract(w, pool, 3, x => x.h);
    const opts = shuffle([w, ...ds]).map(x => ({ html: `<span class="han">${esc(x.h)}</span>${type === 'hanzi' && showPy ? `<span class="muted" style="font-size:13px">${esc(x.p)}</span>` : ''}`, ok: x.id === w.id }));
    if (type === 'listen') {
      return { ask: 'ฟังแล้วเลือกคำที่ได้ยิน', prompt: `<button class="q-play" data-play aria-label="ฟังอีกครั้ง">${ic('volume-2')}</button>`, options: opts, word: w, say: w.h, autoplay: true };
    }
    return { ask: 'คำไหนหมายถึง', prompt: `<span class="mean">${esc(short(w))}</span>`, options: opts, word: w, say: w.h, sayAfter: true };
  }

  /* runQuiz: generic multiple-choice runner */
  function runQuiz(host, qs, { onFinish, xpEach = 3, label = '' } = {}) {
    let i = 0, score = 0; const wrong = [];
    let answered = false;
    function show() {
      const q = qs[i]; answered = false;
      host.innerHTML = `<div class="quiz">
        <div class="q-top"><span class="mono muted" style="font-size:13px">${i + 1} / ${qs.length}</span><div class="bar accent"><i style="width:${pct(i, qs.length)}%"></i></div><span class="mono muted" style="font-size:13px">${label}</span></div>
        <div class="card q-card">
          <p class="q-ask">${esc(q.ask)}</p>
          <div class="q-prompt">${q.prompt}</div>
          <div class="q-opts">${q.options.map((o, k) => `<button class="q-opt" data-k="${k}"><kbd>${k + 1}</kbd><span style="display:flex;flex-direction:column;gap:2px">${o.html}</span></button>`).join('')}</div>
          <div class="q-note" id="qnote"></div>
        </div></div>`;
      const play = $('[data-play]', host);
      if (play) play.onclick = () => speak(q.say);
      if (q.autoplay) setTimeout(() => speak(q.say), 250);
      $$('.q-opt', host).forEach(b => b.onclick = () => choose(+b.dataset.k));
    }
    function choose(k) {
      if (answered) return;
      answered = true;
      const q = qs[i];
      const btns = $$('.q-opt', host);
      btns.forEach((b, j) => { b.disabled = true; if (q.options[j].ok) b.classList.add('right'); });
      const ok = q.options[k].ok;
      if (ok) { score++; addXP(xpEach); } else { btns[k].classList.add('wrong'); if (q.word) wrong.push(q.word); }
      if (q.say && (q.sayAfter || !ok)) speak(q.say);
      const w = q.word;
      const note = w ? `<span class="han" style="font-size:20px">${esc(w.h)}</span> <span class="sec">${esc(w.p)}</span> <span class="muted">· ${esc(short(w))}</span>` : (q.note || '');
      $('#qnote', host).innerHTML = `<span>${ok ? `<b class="ok">ถูกต้อง</b>` : `<b class="no">ยังไม่ใช่</b>`} ${note}</span>
        <button class="btn primary" id="qnext">${i + 1 < qs.length ? 'ข้อต่อไป' : 'ดูผล'} <kbd style="background:transparent;color:inherit;border-color:currentColor;opacity:.6">Enter</kbd></button>`;
      $('#qnext', host).onclick = next;
      $('#qnext', host).focus({ preventScroll: true });
      if (ok) clearTimeout(host._t), host._t = setTimeout(() => { if (answered && qs[i] === q) next(); }, 1100);
    }
    function next() {
      clearTimeout(host._t);
      if (!answered) return;
      i++;
      if (i < qs.length) show(); else onFinish({ score, total: qs.length, wrong });
    }
    const key = e => {
      if (!host.isConnected) return;
      if (e.target.tagName === 'INPUT') return;
      if (!answered && /^[1-4]$/.test(e.key)) { const k = +e.key - 1; if (qs[i] && k < qs[i].options.length) choose(k); }
      else if (answered && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); next(); }
    };
    onView('keydown', key, document);
    show();
  }

  function resultHTML({ score, total, wrong }, { passed, glyph = '印', title, actions }) {
    const p = pct(score, total);
    return `<div class="card result enter">
      <div class="stamp ${passed ? '' : 'grey'}">${esc(passed ? glyph : '再')}</div>
      <div class="score">${p}%</div>
      <p class="sec" style="margin-top:8px">${esc(title)} · ตอบถูก ${score} จาก ${total} ข้อ</p>
      <div class="row wrap" style="justify-content:center;margin-top:24px">${actions}</div>
      ${wrong.length ? `<div class="missed"><h3 style="margin-bottom:8px">คำที่ควรดูอีกรอบ</h3><div class="wlist">${[...new Map(wrong.map(w => [w.id, w])).values()].map(w => `<button class="wrow" data-say="${esc(w.h)}"><span class="han">${esc(w.h)}</span><span><div class="t">${esc(short(w))}</div><div class="p">${esc(w.p)}</div></span></button>`).join('')}</div></div>` : ''}
    </div>`;
  }
  function bindSay(root) { $$('[data-say]', root).forEach(b => b.addEventListener('click', () => speak(b.dataset.say))); }

  /* ---------- unit ---------- */
  function viewUnit(l, n, tab) {
    const u = UNITS[l] && UNITS[l][n - 1];
    if (!u) { location.hash = '#/'; return; }
    if (!unitUnlocked(l, n)) {
      app.innerHTML = `<div class="card empty enter"><div class="stamp grey">${ic('lock')}</div><h2>บทที่ ${n} ยังไม่เปิด</h2>
        <p>เรียนบทที่ ${n - 1} ให้ผ่านก่อน หรือถ้ามีพื้นฐานแล้ว ลองสอบข้ามระดับ HSK ${l}</p>
        <div class="row" style="justify-content:center;margin-top:24px"><a class="btn primary" href="#/unit/${l}-${n - 1}">ไปบทที่ ${n - 1}</a><a class="btn" href="#/test/${l}">สอบข้ามระดับ</a></div></div>`;
      return;
    }
    const st = S.units[u.key];
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div>
        <div class="crumb"><a href="#/">แผนที่</a>${ic('chevron-right', 's16')}<a href="#/level/${l}">HSK ${l}</a>${ic('chevron-right', 's16')}<span>บทที่ ${n}</span></div>
        <h1>HSK ${l} · บทที่ ${n}</h1>
        <p class="lead">${u.words.length} คำ · <span class="han" style="letter-spacing:.08em">${u.words.slice(0, 6).map(w => esc(w.h)).join(' ')}</span></p>
      </div>
      <div class="row">${st && st.done ? `<span class="done-note"><span class="seal" style="width:22px;height:22px;font-size:14px">印</span>ผ่านแล้ว ${st.best}%</span>` : ''}</div></div>
      <div class="tabs" role="tablist" style="margin-bottom:24px">
        <button data-tab="words" class="${tab === 'words' ? 'on' : ''}">${ic('layers', 's16')}คำศัพท์</button>
        <button data-tab="write" class="${tab === 'write' ? 'on' : ''}">${ic('pen-line', 's16')}ฝึกเขียน</button>
        <button data-tab="quiz" class="${tab === 'quiz' ? 'on' : ''}">${ic('circle-check', 's16')}แบบทดสอบ</button>
      </div>
      <div id="tab"></div></div>`;
    $$('[data-tab]').forEach(b => b.onclick = () => { history.replaceState(null, '', `#/unit/${u.key}/${b.dataset.tab}`); viewUnit(l, n, b.dataset.tab); });
    const host = $('#tab');
    cleanups.forEach(f => f()); cleanups = [];
    if (tab === 'words') unitWords(host, u);
    else if (tab === 'write') unitWrite(host, u);
    else unitQuiz(host, u);
  }

  function unitWords(host, u) {
    let idx = 0;
    host.innerHTML = `<div class="grid-2">
      <div class="card word-card" id="wc"></div>
      <div class="card pad" style="padding:12px"><div class="wlist" id="wl">${u.words.map((w, i) => `<button class="wrow" data-i="${i}"><span class="han">${esc(w.h)}</span><span style="min-width:0"><div class="t">${esc(short(w))}</div><div class="p">${esc(w.p)}</div></span></button>`).join('')}</div></div>
    </div>`;
    const wc = $('#wc', host);
    function show(i) {
      idx = (i + u.words.length) % u.words.length;
      const w = u.words[idx];
      wc.innerHTML = `<div class="row" style="width:100%;justify-content:space-between"><span class="mono muted" style="font-size:13px">${idx + 1} / ${u.words.length}</span><span class="mono muted" style="font-size:13px">HSK ${w.l}</span></div>
        <div class="big">${esc(w.h)}</div>
        <div class="py">${esc(w.p)}</div>
        ${w.th ? `<div class="mean">${esc(w.th)}</div><div class="en">${esc(w.en)}</div>` : `<div class="mean">${esc(w.en)}</div>`}
        <div class="tools">
          <button class="btn" id="say">${ic('volume-2')}ฟังเสียง <kbd>Space</kbd></button>
          <button class="btn" id="strk">${ic('pen-line')}ลำดับขีด</button>
        </div>
        <div class="stroke-box" id="sb"></div>
        <div class="nav-row">
          <button class="btn" id="prev">${ic('chevron-left')}ก่อนหน้า</button>
          ${idx === u.words.length - 1 ? `<a class="btn primary" href="#/unit/${u.key}/quiz">ทำแบบทดสอบ${ic('arrow-right')}</a>` : `<button class="btn primary" id="next">ถัดไป${ic('chevron-right')}</button>`}
        </div>`;
      $('#say', wc).onclick = () => speak(w.h);
      $('#strk', wc).onclick = () => animateWord($('#sb', wc), w.h, 96);
      $('#prev', wc).onclick = () => show(idx - 1);
      const nx = $('#next', wc); if (nx) nx.onclick = () => show(idx + 1);
      $$('.wrow', host).forEach((r, j) => r.classList.toggle('on', j === idx));
    }
    $$('#wl .wrow', host).forEach(r => r.onclick = () => { show(+r.dataset.i); speak(u.words[+r.dataset.i].h); if (innerWidth < 1080) wc.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    onView('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') show(idx + 1);
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === ' ') { e.preventDefault(); speak(u.words[idx].h); }
    }, document);
    show(0);
  }

  function writePractice(host, chars, { onWritten, infoFor } = {}) {
    let cur = chars[0];
    host.innerHTML = `<div class="grid-2">
      <div class="card pad" style="display:flex;flex-direction:column;align-items:center;gap:20px">
        <div id="wbox"></div>
        <div class="row wrap" style="justify-content:center">
          <button class="btn" id="wanim">${ic('play')}ดูลำดับขีด</button>
          <button class="btn primary" id="wquiz">${ic('pen-line')}ลองเขียน</button>
          <button class="btn ghost" id="wsay">${ic('volume-2')}ฟัง</button>
        </div>
        <p class="muted" id="wmsg" style="font-size:14px;text-align:center;min-height:22px">กดลองเขียน แล้วลากเส้นตามลำดับขีดในตาราง</p>
      </div>
      <div class="card pad"><h3>เลือกตัวอักษร</h3><p class="muted" style="font-size:13px;margin:4px 0 16px">${chars.length} ตัว · จุดแดงคือตัวที่เคยเขียนถูกแล้ว</p>
        <div class="char-pick" id="cp">${chars.map(c => `<button data-c="${esc(c)}" class="${S.written[c] ? 'ok' : ''}">${esc(c)}</button>`).join('')}</div>
        <div id="winfo" style="margin-top:20px"></div></div>
    </div>`;
    let writer = null;
    const size = Math.min(280, (host.clientWidth || 320) - 64);
    function load(c) {
      cur = c;
      const b = writerBox(c, size);
      $('#wbox', host).innerHTML = ''; $('#wbox', host).appendChild(b.el);
      writer = b.w;
      $$('#cp button', host).forEach(x => x.classList.toggle('on', x.dataset.c === c));
      $('#winfo', host).innerHTML = infoFor ? infoFor(c) : '';
      $('#wmsg', host).textContent = 'กดลองเขียน แล้วลากเส้นตามลำดับขีดในตาราง';
    }
    $$('#cp button', host).forEach(b => b.onclick = () => load(b.dataset.c));
    $('#wanim', host).onclick = () => { if (writer) { writer.showCharacter(); writer.animateCharacter(); } };
    $('#wsay', host).onclick = () => speak(cur);
    $('#wquiz', host).onclick = () => {
      if (!writer) return;
      $('#wmsg', host).textContent = 'เขียนทีละขีด ถ้าพลาดสองครั้งจะมีเส้นใบ้ให้';
      writer.quiz({
        showHintAfterMisses: 2,
        onComplete: sum => {
          const miss = sum.totalMistakes;
          $('#wmsg', host).innerHTML = miss === 0 ? `<span style="color:var(--good)">เขียนถูกทุกขีด</span>` : `เขียนเสร็จแล้ว พลาด ${miss} ครั้ง ลองอีกรอบได้`;
          S.written[cur] = (S.written[cur] || 0) + 1; save(); addXP(miss === 0 ? 4 : 2);
          const btn = $(`#cp button[data-c="${CSS.escape(cur)}"]`, host); if (btn) btn.classList.add('ok');
          if (onWritten) onWritten(cur, miss);
        }
      });
    };
    load(cur);
  }

  function unitWrite(host, u) {
    const chars = [...new Set(u.words.flatMap(w => [...w.h]).filter(c => /[一-鿿]/.test(c)))];
    writePractice(host, chars, {
      infoFor: c => {
        const ws = u.words.filter(w => w.h.includes(c));
        return `<h3 style="margin-bottom:8px">อยู่ในคำ</h3><div class="wlist">${ws.map(w => `<button class="wrow" data-say="${esc(w.h)}"><span class="han">${esc(w.h)}</span><span style="min-width:0"><div class="t">${esc(short(w))}</div><div class="p">${esc(w.p)}</div></span></button>`).join('')}</div>`;
      }
    });
    host.addEventListener('click', e => { const b = e.target.closest('[data-say]'); if (b) speak(b.dataset.say); });
  }

  function unitQuiz(host, u) {
    const n = Math.min(20, Math.max(10, u.words.length));
    host.innerHTML = `<div class="card result" style="max-width:560px;margin:0 auto">
      <div class="stamp grey">${cn(u.n)}</div>
      <h2 style="margin-top:24px">แบบทดสอบบทที่ ${u.n}</h2>
      <p class="sec" style="margin-top:8px">${n} ข้อ ทั้งความหมาย ตัวอักษร การฟัง และพินอิน ตอบถูก 80% ขึ้นไปเพื่อประทับตราบทนี้ แล้วคำทั้งหมดจะเข้าสู่การทบทวน</p>
      <div class="row" style="justify-content:center;margin-top:24px"><button class="btn red lg" id="go">เริ่มทำ${ic('arrow-right')}</button></div>
      <p class="muted" style="font-size:13px;margin-top:16px">ตอบด้วยปุ่ม <kbd>1</kbd> ถึง <kbd>4</kbd> และไปข้อต่อไปด้วย <kbd>Enter</kbd></p></div>`;
    $('#go', host).onclick = () => {
      const pool = W.filter(w => w.l === u.level);
      runQuiz(host, wordQuestions(u.words, n, pool), {
        label: `บทที่ ${u.n}`,
        onFinish: r => {
          const passed = r.score / r.total >= 0.8;
          const prev = S.units[u.key];
          const first = passed && !(prev && prev.done);
          S.units[u.key] = { done: passed || !!(prev && prev.done), best: Math.max(pct(r.score, r.total), prev ? prev.best : 0), at: Date.now() };
          save();
          if (first) { addToSRS(u.words.map(w => w.id)); addXP(20); }
          const nxt = UNITS[u.level][u.n];
          const nextHref = nxt ? `#/unit/${nxt.key}` : `#/test/${u.level}`;
          host.innerHTML = resultHTML(r, {
            passed, glyph: cn(u.n), title: passed ? `ประทับตราบทที่ ${u.n} แล้ว` : 'อีกนิดเดียว ทบทวนคำแล้วลองใหม่',
            actions: passed
              ? `<a class="btn red lg" href="${nextHref}">${nxt ? `บทที่ ${nxt.n}` : `สอบวัดระดับ HSK ${u.level}`}${ic('arrow-right')}</a><a class="btn lg" href="#/level/${u.level}">${ic('map')}กลับแผนที่</a>`
              : `<button class="btn red lg" id="again">${ic('refresh-cw')}ลองอีกครั้ง</button><a class="btn lg" href="#/unit/${u.key}/words">${ic('layers')}ดูคำศัพท์</a>`
          });
          bindSay(host);
          const ag = $('#again', host); if (ag) ag.onclick = () => unitQuiz(host, u) || $('#go', host).click();
          renderChrome(location.hash.slice(1));
        }
      });
    };
  }

  /* ---------- level test ---------- */
  function viewTest(l) {
    const pool = W.filter(w => w.l === l);
    const n = l <= 2 ? 20 : 30;
    const t = S.tests[l];
    app.innerHTML = `<div class="enter">
      <div class="crumb"><a href="#/">แผนที่</a>${ic('chevron-right', 's16')}<a href="#/level/${l}">HSK ${l}</a>${ic('chevron-right', 's16')}<span>สอบวัดระดับ</span></div>
      <div id="tbox" style="margin-top:16px"><div class="card result" style="max-width:600px;margin:0 auto">
        <div class="stamp grey">考</div>
        <h2 style="margin-top:24px">สอบวัดระดับ HSK ${l}</h2>
        <p class="sec" style="margin-top:8px">${n} ข้อ สุ่มจากคำศัพท์ทั้งหมด ${fmt(pool.length)} คำของระดับนี้ ผ่าน 80% จะประทับตราทุกบทใน HSK ${l} และเปิดทางสู่ ${l < 6 ? `HSK ${l + 1}` : 'ยอดเขา'}</p>
        ${t ? `<p class="mono muted" style="font-size:13px;margin-top:12px">คะแนนดีที่สุด ${t.best}%</p>` : ''}
        <div class="row" style="justify-content:center;margin-top:24px"><button class="btn red lg" id="go">เริ่มสอบ${ic('arrow-right')}</button><a class="btn lg" href="#/level/${l}">ยังก่อน</a></div>
      </div></div></div>`;
    $('#go').onclick = () => {
      const host = $('#tbox');
      runQuiz(host, wordQuestions(pick(pool, n), n, pool), {
        label: `HSK ${l}`, xpEach: 2,
        onFinish: r => {
          const p = pct(r.score, r.total); const passed = p >= 80;
          const prev = S.tests[l];
          const first = passed && !(prev && prev.passed);
          S.tests[l] = { passed: passed || !!(prev && prev.passed), best: Math.max(p, prev ? prev.best : 0) };
          if (first) {
            UNITS[l].forEach(u => { if (!unitDone(u.key)) S.units[u.key] = { done: true, best: p, at: Date.now(), viaTest: true }; });
            addToSRS(pool.map(w => w.id));
            addXP(50);
          }
          save();
          host.innerHTML = resultHTML(r, {
            passed, glyph: cn(l), title: passed ? `ผ่าน HSK ${l} แล้ว ประทับตราทุกบทให้เรียบร้อย` : 'ยังไม่ถึง 80% ลองเรียนบทที่เหลือก่อนแล้วกลับมาสอบใหม่',
            actions: passed
              ? (l < 6 ? `<a class="btn red lg" href="#/level/${l + 1}">ไป HSK ${l + 1}${ic('arrow-right')}</a>` : `<a class="btn red lg" href="#/stats">ดูเส้นทางทั้งหมด</a>`) + `<a class="btn lg" href="#/">${ic('map')}แผนที่</a>`
              : `<button class="btn red lg" id="again">${ic('refresh-cw')}สอบอีกครั้ง</button><a class="btn lg" href="#/level/${l}">${ic('map')}กลับไปเรียน</a>`
          });
          bindSay(host);
          const ag = $('#again', host); if (ag) ag.onclick = () => viewTest(l);
          renderChrome(location.hash.slice(1));
        }
      });
    };
  }

  /* ---------- base camp & sounds ---------- */
  const toneSVG = (t, w = 64, h = 48) => `<svg viewBox="0 0 64 48" width="${w}" height="${h}" aria-hidden="true"><g stroke="currentColor" opacity=".18" stroke-width="1"><line x1="4" y1="8" x2="60" y2="8"/><line x1="4" y1="24" x2="60" y2="24"/><line x1="4" y1="40" x2="60" y2="40"/></g><path d="${t.path}" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  function toneCards() {
    return `<div class="tone-grid">${C.tones.map(t => `<button class="card tone" data-tone="${t.n}">${toneSVG(t)}<span class="m">m${t.mark}</span><span class="n">${t.name}</span><span class="s">${t.shape}</span><span class="s muted">${t.thai}</span></button>`).join('')}</div>`;
  }
  function bindToneCards(root) {
    $$('[data-tone]', root).forEach(b => b.onclick = () => {
      const n = +b.dataset.tone;
      speak(n === 0 ? '妈妈' : C.toneSets[0].c[n - 1], 0.7);
    });
  }
  const sandhiTable = () => `<div class="card" style="overflow-x:auto"><table class="table"><thead><tr><th>กฎ</th><th>ผลลัพธ์</th><th>ตัวอย่าง</th><th></th></tr></thead><tbody>${C.sandhi.map(s => `<tr><td>${s.rule}</td><td class="sec">${s.becomes}</td><td><span class="han" style="font-size:20px">${s.ex}</span> <span class="muted" style="text-decoration:line-through">${s.from}</span> → <b style="font-weight:500">${s.to}</b></td><td style="text-align:right"><button class="btn sm icon-only ghost" data-say="${s.ex}" aria-label="ฟัง">${ic('volume-2', 's16')}</button></td></tr>`).join('')}</tbody></table></div>`;
  const pyGrid = list => `<div class="py-grid">${list.map(([k, th, c, p]) => `<button class="py-cell" data-say="${c}"><b>${k}</b><span>${th}</span><em><span class="han">${c}</span> ${p}</em></button>`).join('')}</div>`;

  function toneQuestions(n) {
    return Array.from({ length: n }, () => {
      const set = C.toneSets[(Math.random() * C.toneSets.length) | 0];
      const t = (Math.random() * 4) | 0;
      return {
        ask: 'ได้ยินวรรณยุกต์เสียงที่เท่าไร', prompt: `<button class="q-play" data-play aria-label="ฟังอีกครั้ง">${ic('volume-2')}</button>`, say: set.c[t], autoplay: true,
        options: [0, 1, 2, 3].map(k => ({ html: `<span class="row" style="gap:12px"><span style="color:var(--accent)">${toneSVG(C.tones[k], 40, 30)}</span><span>เสียง ${k + 1} <span class="muted">${set.syl.replace(/[aeiou]/, m => TONES[m][k])}</span></span></span>`, ok: k === t })),
        note: `<span class="han" style="font-size:20px">${set.c[t]}</span> <span class="sec">${set.p[t]}</span> <span class="muted">· ${set.th[t]}</span>`
      };
    });
  }
  const GROUPS = [['b', 'p', 'm', 'f'], ['d', 't', 'n', 'l'], ['g', 'k', 'h'], ['j', 'q', 'x'], ['zh', 'ch', 'sh', 'r'], ['z', 'c', 's'], ['y', 'w']];
  function pinyinQuestions(n) {
    return Array.from({ length: n }, (_, i) => {
      const isIni = i % 2 === 0;
      const list = isIni ? C.initials : C.finals;
      const item = list[(Math.random() * list.length) | 0];
      let others;
      if (isIni) {
        const g = GROUPS.find(x => x.includes(item[0])) || [];
        others = shuffle(g.filter(x => x !== item[0]));
        shuffle(C.initials.map(x => x[0])).forEach(x => { if (x !== item[0] && !others.includes(x)) others.push(x); });
      } else others = shuffle(C.finals.map(x => x[0]).filter(x => x !== item[0]));
      const opts = shuffle([item[0], ...others.slice(0, 3)]);
      return {
        ask: isIni ? 'ได้ยินพยัญชนะต้นตัวไหน' : 'ได้ยินสระตัวไหน', prompt: `<button class="q-play" data-play aria-label="ฟังอีกครั้ง">${ic('volume-2')}</button>`, say: item[2], autoplay: true,
        options: opts.map(o => ({ html: `<b style="font-weight:500;font-size:20px">${o}</b>`, ok: o === item[0] })),
        note: `<span class="han" style="font-size:20px">${item[2]}</span> <span class="sec">${item[3]}</span> <span class="muted">· ${item[0]} ออกเสียงคล้าย ${item[1]}</span>`
      };
    });
  }
  function radicalQuestions(n) {
    return pick(C.radicals, n).map(r => {
      const ds = pick(C.radicals.filter(x => x.r !== r.r), 3);
      return {
        ask: 'หมวดนำนี้เกี่ยวกับอะไร', prompt: `<span class="han">${r.r}</span><span class="muted han" style="font-size:20px;letter-spacing:.1em">${r.ex}</span>`,
        options: shuffle([r, ...ds]).map(x => ({ html: esc(x.name), ok: x.r === r.r })),
        note: `<span class="han" style="font-size:20px">${r.r}</span> <span class="sec">${r.name}</span> <span class="muted">เช่น <span class="han">${r.ex}</span></span>`
      };
    });
  }

  function baseQuizBlock(key, make, title) {
    const st = S.base[key];
    return `<section class="section" id="bq"><div class="section-head"><div><h2>${title}</h2><p class="muted" style="font-size:14px;margin-top:4px">10 ข้อ ตอบถูก 8 ข้อขึ้นไปเพื่อประทับตราด่านนี้</p></div>${st ? `<span class="done-note"><span class="seal" style="width:22px;height:22px;font-size:14px">印</span>ผ่านแล้ว</span>` : ''}</div>
      <div id="bqhost"><div class="card pad row wrap" style="justify-content:space-between"><span class="sec">พร้อมแล้วกดเริ่ม เสียงจะเล่นเองทุกข้อ</span><button class="btn red" id="bqgo">เริ่มทำแบบฝึก${ic('arrow-right')}</button></div></div></section>`;
  }
  function bindBaseQuiz(key, make, glyph) {
    $('#bqgo').onclick = () => {
      const host = $('#bqhost');
      runQuiz(host, make(10), {
        label: 'ฐาน', xpEach: 2,
        onFinish: r => {
          const passed = r.score >= 8;
          const first = passed && !S.base[key];
          if (passed) S.base[key] = { done: true, best: pct(r.score, r.total) };
          save(); if (first) addXP(20);
          const idx = BASE.findIndex(b => b.key === key);
          const nb = BASE[idx + 1];
          host.innerHTML = resultHTML(r, {
            passed, glyph, title: passed ? 'ประทับตราด่านนี้แล้ว' : 'ฟังอีกสักรอบแล้วลองใหม่',
            actions: passed
              ? `<a class="btn red lg" href="${nb ? `#/base/${nb.key}` : '#/unit/1-1'}">${nb ? nb.title : 'เริ่ม HSK 1 บทที่ 1'}${ic('arrow-right')}</a><a class="btn lg" href="#/level/0">${ic('map')}แผนที่</a>`
              : `<button class="btn red lg" id="again">${ic('refresh-cw')}ลองอีกครั้ง</button>`
          });
          const ag = $('#again', host); if (ag) ag.onclick = () => { host.innerHTML = '<div></div>'; viewBase(key); setTimeout(() => { const g = $('#bqgo'); if (g) { g.click(); $('#bq').scrollIntoView(); } }, 50); };
          renderChrome(location.hash.slice(1));
        }
      });
      $('#bq').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  }

  function baseHead(b, lead) {
    const i = BASE.indexOf(b);
    return `<div class="page-head"><div>
      <div class="crumb"><a href="#/">แผนที่</a>${ic('chevron-right', 's16')}<a href="#/level/0">ฐาน</a>${ic('chevron-right', 's16')}<span>ด่านที่ ${i + 1}</span></div>
      <h1>${b.title}</h1><p class="lead">${lead}</p></div>
      <div class="row">${i > 0 ? `<a class="btn" href="#/base/${BASE[i - 1].key}">${ic('chevron-left')}${BASE[i - 1].title}</a>` : ''}${i < BASE.length - 1 ? `<a class="btn" href="#/base/${BASE[i + 1].key}">${BASE[i + 1].title}${ic('chevron-right')}</a>` : ''}</div></div>`;
  }

  function viewBase(key) {
    const b = BASE.find(x => x.key === key);
    if (key === 'tones') {
      app.innerHTML = `<div class="enter">${baseHead(b, 'ภาษาจีนกลางมี 4 เสียงกับเสียงเบาอีกหนึ่ง พยางค์เดียวกันแต่เสียงต่างกันคือคนละคำ เช่น mā แม่ กับ mǎ ม้า คนไทยได้เปรียบเพราะคุ้นกับวรรณยุกต์อยู่แล้ว')}
        ${toneCards()}
        <section class="section"><div class="section-head"><h2>เสียงเปลี่ยนเมื่ออยู่ติดกัน</h2></div>${sandhiTable()}</section>
        ${baseQuizBlock(key, toneQuestions, 'ฝึกฟังวรรณยุกต์')}</div>`;
      bindToneCards(app); bindSay(app); bindBaseQuiz(key, toneQuestions, '声');
    } else if (key === 'pinyin') {
      app.innerHTML = `<div class="enter">${baseHead(b, 'พินอินคือการเขียนเสียงจีนด้วยอักษรโรมัน หนึ่งพยางค์ประกอบด้วยพยัญชนะต้น สระ และวรรณยุกต์ กดแต่ละช่องเพื่อฟังตัวอย่าง')}
        <section><div class="section-head"><h2>พยัญชนะต้น <span class="muted mono" style="font-size:14px">${C.initials.length}</span></h2></div>${pyGrid(C.initials)}</section>
        <section class="section"><div class="section-head"><h2>สระ <span class="muted mono" style="font-size:14px">${C.finals.length}</span></h2></div>${pyGrid(C.finals)}</section>
        <section class="section"><div class="card pad"><h3>จุดที่คนไทยมักพลาด</h3><div class="stack" style="gap:8px;margin-top:12px;color:var(--text-2)">
          <p><b style="color:var(--text);font-weight:500">b d g</b> ไม่ใช่ บ ด ก แต่ใกล้ ป ต ก ไม่มีลม ส่วน <b style="color:var(--text);font-weight:500">p t k</b> คือ พ ท ค ที่มีลมพ่นออกมาชัดๆ</p>
          <p><b style="color:var(--text);font-weight:500">zh ch sh r</b> ต้องม้วนปลายลิ้นขึ้นแตะเพดาน ส่วน <b style="color:var(--text);font-weight:500">z c s</b> ลิ้นแบนแตะหลังฟัน</p>
          <p><b style="color:var(--text);font-weight:500">ü</b> ทำปากจู๋เหมือนจะพูด อู แต่ออกเสียง อี หลัง j q x y จะเขียนเป็น u เฉยๆ เช่น <span class="han">去</span> qù</p>
        </div></div></section>
        ${baseQuizBlock(key, pinyinQuestions, 'ฝึกฟังพินอิน')}</div>`;
      bindSay(app); bindBaseQuiz(key, pinyinQuestions, '拼');
    } else if (key === 'strokes') {
      const need = 5;
      const doneN = () => C.practiceChars.filter(c => S.written[c]).length;
      app.innerHTML = `<div class="enter">${baseHead(b, 'อักษรจีนทุกตัวประกอบจากขีดพื้นฐานไม่กี่แบบ ถ้าเขียนตามลำดับที่ถูก ตัวจะสวยและจำได้ง่ายขึ้น')}
        <section><div class="section-head"><h2>ขีดพื้นฐาน 8 แบบ</h2></div><div class="stroke-grid">${C.strokes.map(s => `<div class="card stroke-item"><span class="han">${s.c}</span><span><b style="font-weight:500">${s.n}</b><br><span class="sec" style="font-size:14px">${s.th}</span></span></div>`).join('')}</div></section>
        <section class="section"><div class="section-head"><h2>หลักการเรียงขีด</h2><span class="muted" style="font-size:14px">กดที่ตัวอย่างเพื่อดูการเขียน</span></div>
          <div class="rad-grid">${C.strokeRules.map((r, i) => `<button class="card rad" data-anim="${r.ex}" style="cursor:pointer;text-align:left"><span class="r" id="sr${i}">${r.ex}</span><span class="sec" style="font-size:14px">${r.rule}</span></button>`).join('')}</div></section>
        <section class="section" id="bq"><div class="section-head"><div><h2>ลองเขียน</h2><p class="muted" style="font-size:14px;margin-top:4px" id="wneed">เขียนให้ครบ ${need} ตัวเพื่อประทับตราด่านนี้ · ตอนนี้ ${doneN()}/${need}</p></div>${S.base[key] ? `<span class="done-note"><span class="seal" style="width:22px;height:22px;font-size:14px">印</span>ผ่านแล้ว</span>` : ''}</div><div id="wp"></div></section></div>`;
      $$('[data-anim]', app).forEach(btn => btn.onclick = () => { const s = $('.r', btn); s.innerHTML = ''; s.style.width = s.style.height = '56px'; const bx = writerBox(btn.dataset.anim, 56, { showCharacter: false }); s.appendChild(bx.el); animate(bx.w); });
      writePractice($('#wp'), C.practiceChars, {
        infoFor: c => `<p class="sec" style="font-size:14px">เส้นประในตารางคือ 米字格 ช่วยกะสัดส่วนของตัวอักษร</p>`,
        onWritten: () => {
          const d = doneN();
          $('#wneed').textContent = `เขียนให้ครบ ${need} ตัวเพื่อประทับตราด่านนี้ · ตอนนี้ ${Math.min(d, need)}/${need}`;
          if (d >= need && !S.base[key]) { S.base[key] = { done: true, best: 100 }; save(); addXP(20); toast('ประทับตราด่านขีดและลำดับการเขียนแล้ว'); }
        }
      });
    } else {
      app.innerHTML = `<div class="enter">${baseHead(b, 'หมวดนำคือส่วนประกอบที่บอกใบ้ความหมายของอักษร เช่น 氵 เกี่ยวกับน้ำ เห็นแล้วเดาได้ว่า 河 洗 澡 เกี่ยวกับน้ำ กดที่ตัวอย่างเพื่อฟังเสียง')}
        <div class="rad-grid">${C.radicals.map(r => `<div class="card rad"><span class="r">${r.r}</span><span><b style="font-weight:500">${r.name}</b><br><span class="x">${[...r.ex].map(c => `<button data-say="${c}">${c}</button>`).join('')}</span></span></div>`).join('')}</div>
        ${baseQuizBlock(key, radicalQuestions, 'ทายความหมายหมวดนำ')}</div>`;
      bindSay(app); bindBaseQuiz(key, radicalQuestions, '部');
    }
  }

  function viewSounds() {
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div><h1>ฝึกเสียง</h1><p class="lead">วรรณยุกต์ การเปลี่ยนเสียง และตารางพินอินทั้งหมด กดที่ไหนก็ได้เพื่อฟัง</p></div>
        <button class="btn red" id="game">${ic('shuffle')}เกมทายวรรณยุกต์</button></div>
      <div id="gamehost"></div>
      <section>${toneCards()}</section>
      <section class="section"><div class="section-head"><h2>เสียงเปลี่ยนเมื่ออยู่ติดกัน</h2></div>${sandhiTable()}</section>
      <section class="section"><div class="section-head"><h2>พยัญชนะต้น</h2></div>${pyGrid(C.initials)}</section>
      <section class="section"><div class="section-head"><h2>สระ</h2></div>${pyGrid(C.finals)}</section></div>`;
    bindToneCards(app); bindSay(app);
    $('#game').onclick = () => {
      const host = $('#gamehost'); host.style.marginBottom = '48px';
      const run = () => runQuiz(host, toneQuestions(10), {
        label: 'วรรณยุกต์', xpEach: 1, onFinish: r => {
          host.innerHTML = resultHTML(r, { passed: r.score >= 8, glyph: '声', title: 'เกมทายวรรณยุกต์', actions: `<button class="btn red lg" id="again">${ic('refresh-cw')}เล่นอีกรอบ</button><button class="btn lg" id="closeg">ปิด</button>` });
          $('#again', host).onclick = run; $('#closeg', host).onclick = () => { host.innerHTML = ''; host.style.marginBottom = ''; };
        }
      });
      run();
      window.scrollTo({ top: host.getBoundingClientRect().top + scrollY - 80, behavior: 'smooth' });
    };
  }

  /* ---------- review ---------- */
  function viewReview() {
    const due = shuffle(dueIds());
    const learned = learnedIds();
    const head = `<div class="page-head"><div><h1>ทบทวน</h1><p class="lead">คำที่เรียนแล้วจะกลับมาให้ทบทวนตามจังหวะความจำ ยิ่งจำได้ ยิ่งเว้นห่างออกไป</p></div>
      ${learned.length >= 4 ? `<button class="btn" id="mix">${ic('shuffle')}แบบทดสอบสุ่มจากคำที่เรียนแล้ว</button>` : ''}</div>`;
    if (!due.length) {
      const nx = nextDueText();
      app.innerHTML = `<div class="enter">${head}<div class="card empty"><div class="stamp grey">${ic('circle-check')}</div>
        <h2>${Object.keys(S.srs).length ? 'ทบทวนครบแล้วสำหรับตอนนี้' : 'ยังไม่มีคำให้ทบทวน'}</h2>
        <p>${Object.keys(S.srs).length ? `รอบถัดไป${nx ? ' ' + nx : ''} ระหว่างนี้เรียนบทใหม่ต่อได้เลย` : 'ผ่านแบบทดสอบของบทไหนก็ได้ แล้วคำในบทนั้นจะมารอที่นี่'}</p>
        <div class="row" style="justify-content:center;margin-top:24px">${primaryCTA(current())}</div></div></div>`;
      bindMix(learned);
      return;
    }
    const queue = due.slice(0, 20);
    let done = 0; const total = queue.length;
    app.innerHTML = `<div class="enter">${head}<div class="rev" id="rv"></div></div>`;
    bindMix(learned);
    const host = $('#rv');
    let revealed = false;
    function show() {
      if (!queue.length) {
        host.innerHTML = `<div class="card result"><div class="stamp">習</div><div class="score">${total}</div><p class="sec" style="margin-top:8px">ทบทวนเสร็จ ${total} คำ</p>
          <div class="row" style="justify-content:center;margin-top:24px">${primaryCTA(current())}<a class="btn lg" href="#/">${ic('map')}แผนที่</a></div></div>`;
        renderChrome('/review');
        return;
      }
      revealed = false;
      const w = W[queue[0]]; const c = S.srs[w.id] || { b: 1 };
      host.innerHTML = `<div class="q-top"><span class="mono muted" style="font-size:13px">${done} / ${total}</span><div class="bar accent"><i style="width:${pct(done, total)}%"></i></div><span class="mono muted" style="font-size:13px">กล่อง ${c.b}</span></div>
        <div class="card q-card"><p class="q-ask">นึกความหมายและเสียงให้ออกก่อนเปิดดู</p>
          <div class="q-prompt"><span class="han">${esc(w.h)}</span><div id="back" style="display:none;text-align:center"><div class="py" style="font-size:20px;color:var(--text-2)">${esc(w.p)}</div><div class="mean" style="margin-top:8px">${esc(mean(w))}</div>${w.th ? `<div class="muted" style="font-size:13px;margin-top:4px">${esc(w.en)}</div>` : ''}</div></div>
          <div id="acts" style="margin-top:auto;padding-top:24px"><button class="btn primary lg" id="rev" style="width:100%">เปิดดู <kbd style="background:transparent;color:inherit;border-color:currentColor;opacity:.6">Space</kbd></button></div>
        </div>`;
      $('#rev', host).onclick = reveal;
    }
    function reveal() {
      if (revealed) return; revealed = true;
      const w = W[queue[0]]; const c = S.srs[w.id] || { b: 1 };
      $('#back', host).style.display = 'block';
      speak(w.h);
      const d1 = INT[Math.min(8, c.b + 1)], d2 = INT[Math.min(8, c.b + 2)];
      $('#acts', host).innerHTML = `<div class="rev-btns" style="padding-top:0">
        <button class="btn" data-g="0">ลืมแล้ว<small>10 นาที · 1</small></button>
        <button class="btn" data-g="1">จำได้<small>${d1} วัน · 2</small></button>
        <button class="btn" data-g="2">ง่ายมาก<small>${d2} วัน · 3</small></button></div>`;
      $$('[data-g]', host).forEach(b => b.onclick = () => rate(+b.dataset.g));
    }
    function rate(g) {
      const id = queue.shift();
      grade(id, g); addXP(2);
      if (g === 0) queue.push(id); else done++;
      show();
    }
    onView('keydown', e => {
      if (!host.isConnected) return;
      if (e.key === ' ' && !revealed) { e.preventDefault(); reveal(); }
      else if (revealed && /^[1-3]$/.test(e.key)) rate(+e.key - 1);
    }, document);
    show();
  }
  function bindMix(learned) {
    const b = $('#mix'); if (!b) return;
    b.onclick = () => {
      const words = pick(learned, Math.min(12, learned.length)).map(id => W[id]);
      const pool = learned.map(id => W[id]);
      const host = $('#rv') || $('.empty');
      const box = document.createElement('div');
      (host.parentNode).replaceChild(box, host);
      runQuiz(box, wordQuestions(words, words.length, pool.length >= 8 ? pool : undefined), {
        label: 'สุ่มทบทวน', xpEach: 2,
        onFinish: r => {
          box.innerHTML = resultHTML(r, { passed: r.score / r.total >= 0.8, glyph: '習', title: 'แบบทดสอบสุ่ม', actions: `<button class="btn red lg" id="again">${ic('refresh-cw')}อีกชุด</button><a class="btn lg" href="#/">${ic('map')}แผนที่</a>` });
          bindSay(box); r.wrong.forEach(w => { if (S.srs[w.id]) grade(w.id, 0); });
          $('#again', box).onclick = () => viewReview() || setTimeout(() => $('#mix') && $('#mix').click(), 30);
        }
      });
    };
  }

  /* ---------- dictionary ---------- */
  function wordModal(w) {
    const u = unitOf[w.id]; const c = S.srs[w.id];
    modal(`<div style="text-align:center">
      <div class="mono muted" style="font-size:12px">HSK ${w.l} · บทที่ ${u.n}</div>
      <div class="han" style="font-size:88px;line-height:1.15;margin-top:8px">${esc(w.h)}</div>
      <div style="font-size:20px;color:var(--text-2)">${esc(w.p)}</div>
      ${w.th ? `<div style="font-size:18px;margin-top:12px">${esc(w.th)}</div>` : ''}
      <div class="${w.th ? 'muted' : ''}" style="font-size:${w.th ? 13 : 16}px;margin-top:4px">${esc(w.en)}</div>
      <div class="stroke-box" id="msb"></div>
      <div class="row wrap" style="justify-content:center;margin-top:20px">
        <button class="btn" id="msay">${ic('volume-2')}ฟังเสียง</button>
        <button class="btn" id="mst">${ic('play')}ลำดับขีดอีกครั้ง</button>
        <a class="btn" href="#/unit/${u.key}">${ic('layers')}ไปที่บทนี้</a>
      </div>
      <p class="muted" style="font-size:13px;margin-top:16px">${c ? `อยู่ในการทบทวน กล่อง ${c.b}` : unitDone(u.key) ? 'เรียนแล้ว' : 'ยังไม่ได้เรียน'}</p></div>`,
    (m, close) => {
      $('#msay', m).onclick = () => speak(w.h);
      const run = () => animateWord($('#msb', m), w.h, 88);
      $('#mst', m).onclick = run; run(); speak(w.h);
      $('a', m).addEventListener('click', close);
    });
  }
  function viewDict() {
    let lv = 0, q = '', limit = 120;
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div><h1>คลังคำ</h1><p class="lead">${fmt(W.length)} คำของ HSK 1 ถึง 6 ค้นหาด้วยตัวจีน พินอินแบบไม่ใส่วรรณยุกต์ ภาษาไทย หรือภาษาอังกฤษ</p></div></div>
      <div class="row wrap" style="gap:16px"><label class="search">${ic('search')}<span class="sr">ค้นหา</span><input id="q" placeholder="ค้นหา เช่น 学 xuexi เรียน study" autocomplete="off"></label>
        <div class="chips" id="lvs">${[0, ...LEVELS].map(l => `<button class="chip ${l === 0 ? 'on' : ''}" data-l="${l}">${l ? `HSK ${l}` : 'ทั้งหมด'}</button>`).join('')}</div></div>
      <p class="muted mono" style="font-size:13px;margin-top:16px" id="cnt"></p>
      <div class="dict-list" id="dl"></div>
      <div class="row" style="justify-content:center;margin-top:24px"><button class="btn" id="more" hidden>แสดงเพิ่ม</button></div></div>`;
    const learned = new Set(learnedIds());
    function run() {
      const qq = q.trim().toLowerCase(); const qp = plain(qq);
      const res = W.filter(w => (!lv || w.l === lv) && (!qq || w.h.includes(qq) || (qp && plain(w.p).includes(qp)) || (w.th && w.th.includes(qq)) || w.en.toLowerCase().includes(qq)));
      if (qq) res.sort((a, b) => (b.h === qq || plain(b.p) === qp) - (a.h === qq || plain(a.p) === qp));
      $('#cnt').textContent = `${fmt(res.length)} คำ`;
      $('#dl').innerHTML = res.slice(0, limit).map(w => `<button class="dict-item" data-id="${w.id}"><span><span class="han">${esc(w.h)}</span> <span class="p">${esc(w.p)}</span>${learned.has(w.id) ? '<span class="seen-dot" title="เรียนแล้ว" style="width:6px;height:6px;border-radius:2px;background:var(--accent);display:inline-block;margin-left:8px;vertical-align:middle"></span>' : ''}</span><span class="lv">HSK ${w.l}</span><span class="m">${esc(mean(w))}</span></button>`).join('');
      $('#more').hidden = res.length <= limit;
    }
    let t;
    $('#q').addEventListener('input', e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; limit = 120; run(); }, 120); });
    $$('#lvs .chip').forEach(c => c.onclick = () => { lv = +c.dataset.l; limit = 120; $$('#lvs .chip').forEach(x => x.classList.toggle('on', x === c)); run(); });
    $('#more').onclick = () => { limit += 240; run(); };
    $('#dl').addEventListener('click', e => { const b = e.target.closest('[data-id]'); if (b) wordModal(W[+b.dataset.id]); });
    run();
    if (innerWidth > 760) $('#q').focus();
  }

  /* ---------- grammar ---------- */
  function viewGrammar(l) {
    const list = C.grammar[l] || [];
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div><h1>ไวยากรณ์</h1><p class="lead">โครงสร้างประโยคสำคัญที่ข้อสอบ HSK แต่ละระดับคาดหวัง พร้อมตัวอย่างที่กดฟังได้</p></div></div>
      <div class="chips" style="margin-bottom:24px">${LEVELS.map(x => `<a class="chip ${x === l ? 'on' : ''}" href="#/grammar/${x}" style="display:inline-flex;align-items:center">HSK ${x}</a>`).join('')}</div>
      <div class="grid-2"><div>${list.map((g, i) => `<article class="card gram"><div class="row" style="align-items:baseline;justify-content:space-between"><span class="pat">${esc(g.t)}</span><span class="mono muted" style="font-size:12px">${l}.${i + 1}</span></div>
          <p class="d">${esc(g.d)}</p>
          ${g.ex.map(e => `<div class="ex"><button class="btn sm icon-only ghost" data-say="${esc(e[0])}" aria-label="ฟังประโยค">${ic('volume-2', 's16')}</button><span class="zh">${esc(e[0])}</span><span class="py">${esc(e[1])}</span><span class="th">${esc(e[2])}</span></div>`).join('')}
        </article>`).join('')}</div>
        <aside class="stack"><div class="card pad"><h3>HSK ${l} · ${esc(C.levelInfo[l].name)}</h3><p class="sec" style="font-size:14px;margin-top:4px">${esc(C.levelInfo[l].blurb)}</p>
          <div style="margin-top:16px"><div class="kv"><span>หัวข้อ</span><span>${list.length}</span></div><div class="kv"><span>บทที่ผ่าน</span><span>${unitsDoneIn(l)}/${UNITS[l].length}</span></div></div>
          <a class="btn" style="width:100%;margin-top:16px" href="#/level/${l}">${ic('map')}เส้นทาง HSK ${l}</a></div></aside></div></div>`;
    bindSay(app);
  }

  /* ---------- stats & settings ---------- */
  function viewStats() {
    const learned = learnedIds().length;
    const due = dueIds().length;
    const cl = curLevel();
    const weeks = 20;
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end); start.setDate(end.getDate() - end.getDay() - (weeks - 1) * 7);
    const cells = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const x = S.days[dkey(d)] || 0;
      const lvl = !x ? 0 : x < 15 ? 1 : x < 40 ? 2 : x < 80 ? 3 : 4;
      cells.push(`<i class="${lvl ? 'l' + lvl : ''} ${dkey(d) === dkey() ? 'today' : ''}" title="${dkey(d)} · ${x} XP"></i>`);
    }
    const activeDays = Object.values(S.days).filter(Boolean).length;
    const sw = (k, on) => `<button class="switch ${on ? 'on' : ''}" data-sw="${k}" role="switch" aria-checked="${on}"></button>`;
    app.innerHTML = `<div class="enter">
      <div class="page-head"><div><h1>สถิติ</h1><p class="lead">ดูว่าเดินมาถึงไหนแล้ว และตั้งค่าการเรียนให้เข้ากับตัวเอง</p></div></div>
      <div class="stats-row">
        <div class="card stat"><div class="l">คำที่เรียนแล้ว</div><div class="v">${fmt(learned)}</div><div class="c">จาก ${fmt(W.length)} คำ</div></div>
        <div class="card stat"><div class="l">เรียนต่อเนื่อง</div><div class="v">${streak()} วัน</div><div class="c">เรียนมาแล้ว ${activeDays} วัน</div></div>
        <div class="card stat"><div class="l">XP สะสม</div><div class="v">${fmt(S.xp)}</div><div class="c">วันนี้ ${todayXP()} XP</div></div>
        <div class="card stat"><div class="l">รอทบทวน</div><div class="v">${due}</div><div class="c">อยู่ในระบบทบทวน ${fmt(Object.keys(S.srs).length)} คำ</div></div>
      </div>
      <section class="section grid-2">
        <div class="stack" style="gap:24px">
          <div class="card pad"><div class="section-head"><h2>ความคืบหน้าแต่ละระดับ</h2><span class="muted" style="font-size:13px">บทที่ผ่าน</span></div>
            <div class="lvbars">${[0, ...LEVELS].map(l => {
              const tot = l ? UNITS[l].length : BASE.length; const d = l ? unitsDoneIn(l) : BASE.filter(b => S.base[b.key]).length;
              return `<a class="lvbar" href="#/level/${l}"><span>${l ? `HSK ${l}` : 'ฐาน'}</span><span class="bar ${l === cl ? 'accent' : ''}"><i style="width:${pct(d, tot)}%"></i></span><span class="n">${d}/${tot} · ${pct(d, tot)}%</span></a>`;
            }).join('')}</div></div>
          <div class="card pad"><div class="section-head"><h2>กิจกรรม ${weeks} สัปดาห์</h2>
            <span class="legend">น้อย <i style="background:var(--line)"></i><i class="l1" style="background:color-mix(in srgb,var(--accent) 30%,var(--card))"></i><i style="background:color-mix(in srgb,var(--accent) 55%,var(--card))"></i><i style="background:color-mix(in srgb,var(--accent) 80%,var(--card))"></i><i style="background:var(--accent)"></i> มาก</span></div>
            <div class="heat-wrap"><div class="heat">${cells.join('')}</div></div></div>
        </div>
        <aside class="stack">
          <div class="card pad"><h3>ตั้งค่า</h3>
            <div class="set-row"><div><div>แสดงพินอินในแบบทดสอบ</div><div class="d">ปิดเพื่อฝึกอ่านตัวจีนล้วน</div></div>${sw('pinyin', S.settings.pinyin)}</div>
            <div class="set-row"><div><div>โหมดอิสระ</div><div class="d">เปิดทุกบทโดยไม่ต้องเรียนตามลำดับ</div></div>${sw('free', S.settings.free)}</div>
            <div class="set-row"><div><div>ความเร็วเสียงอ่าน</div><div class="d mono" id="rv">${S.settings.rate.toFixed(2)}×</div></div><input type="range" min="0.5" max="1.2" step="0.05" value="${S.settings.rate}" id="rate"></div>
            <div class="set-row"><div><div>เป้าหมายต่อวัน</div><div class="d">XP ที่อยากได้ในแต่ละวัน</div></div><select id="goal">${[20, 50, 100, 150].map(g => `<option value="${g}" ${g === S.settings.goal ? 'selected' : ''}>${g} XP</option>`).join('')}</select></div>
            <div class="set-row"><div><div>ธีม</div><div class="d">กระดาษกลางวัน หรือหมึกกลางคืน</div></div><select id="theme">${[['auto', 'ตามระบบ'], ['light', 'สว่าง'], ['dark', 'มืด']].map(([v, t]) => `<option value="${v}" ${v === S.settings.theme ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="set-row"><div><div>ทดสอบเสียง</div><div class="d">${voice ? esc(voice.name) : 'ยังไม่พบเสียงภาษาจีน'}</div></div><button class="btn sm" data-say="你好，欢迎学习汉语">${ic('volume-2', 's16')}ฟัง</button></div>
          </div>
          <div class="card pad"><h3>ข้อมูลความคืบหน้า</h3><p class="sec" style="font-size:14px;margin-top:4px">เก็บไว้ในเบราว์เซอร์นี้เท่านั้น สำรองไว้ก่อนเปลี่ยนเครื่องหรือล้างข้อมูลเบราว์เซอร์</p>
            <div class="stack" style="gap:8px;margin-top:16px">
              <button class="btn" id="exp">${ic('download')}ดาวน์โหลดไฟล์สำรอง</button>
              <label class="btn" style="cursor:pointer">${ic('upload')}นำเข้าไฟล์สำรอง<input type="file" accept="application/json" id="imp" hidden></label>
              <button class="btn ghost" id="reset" style="color:var(--bad)">${ic('trash-2')}เริ่มใหม่ทั้งหมด</button>
            </div></div>
        </aside></section></div>`;
    bindSay(app);
    $$('[data-sw]').forEach(b => b.onclick = () => { const k = b.dataset.sw; S.settings[k] = !S.settings[k]; save(); b.classList.toggle('on', S.settings[k]); b.setAttribute('aria-checked', S.settings[k]); });
    $('#rate').oninput = e => { S.settings.rate = +e.target.value; $('#rv').textContent = S.settings.rate.toFixed(2) + '×'; save(); };
    $('#goal').onchange = e => { S.settings.goal = +e.target.value; save(); renderMeta(); };
    $('#theme').onchange = e => { S.settings.theme = e.target.value; save(); applyTheme(); };
    $('#exp').onclick = () => {
      const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `epicchinese-${dkey()}.json`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => {
        const d = JSON.parse(t);
        if (!d || typeof d !== 'object' || !('units' in d)) throw new Error();
        S = Object.assign(clone(DEF), d, { settings: Object.assign(clone(DEF.settings), d.settings || {}) });
        save(); applyTheme(); toast('นำเข้าความคืบหน้าแล้ว'); route();
      }).catch(() => toast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของ Epic Chinese'));
    };
    $('#reset').onclick = () => modal(`<h2>เริ่มใหม่ทั้งหมด</h2><p class="sec" style="margin-top:8px">ตราประทับ คะแนน และคำที่รอทบทวนจะหายทั้งหมด ดาวน์โหลดไฟล์สำรองไว้ก่อนถ้าอยากเก็บ</p>
      <div class="row" style="justify-content:flex-end;margin-top:24px"><button class="btn" id="no">ยกเลิก</button><button class="btn red" id="yes">ลบและเริ่มใหม่</button></div>`, (m, close) => {
      $('#no', m).onclick = close;
      $('#yes', m).onclick = () => { S = clone(DEF); save(); close(); applyTheme(); location.hash = '#/'; route(); toast('เริ่มต้นใหม่แล้ว'); };
    });
  }

  /* ---------- theme & boot ---------- */
  function applyTheme() {
    const t = S.settings.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
    const meta = $('meta[name="theme-color"]'); if (meta) meta.content = cssVar('--bg') || '#f7f4ee';
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  route();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  window.EpicChinese = { W, UNITS, get state() { return S; } };
})();
