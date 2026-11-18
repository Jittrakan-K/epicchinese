/* แคชไฟล์ของเว็บไว้ใช้ตอนออฟไลน์ เปลี่ยน VERSION ทุกครั้งที่อัปเดตไฟล์หลัก */
const VERSION = 'epic-v9';
const SHELL = ['./', 'index.html', 'css/style.css', 'css/tokens.css', 'css/base.css', 'js/app.js', 'js/cloud.js', 'js/firebase-config.js', 'js/icons.js', 'js/data-words.js', 'js/data-content.js', 'vendor/hanzi-writer.min.js', 'assets/logo.svg', 'assets/logo-192.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  const font = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!same && !font) return;
  const stable = font || url.pathname.includes('/data/strokes/') || url.pathname.includes('/vendor/');
  e.respondWith(caches.open(VERSION).then(async cache => {
    const hit = await cache.match(req);
    if (stable && hit) return hit;
    try {
      // ไฟล์ของเว็บเองให้ถามเซิร์ฟเวอร์ทุกครั้ง ไม่ใช้แคช HTTP เก่า เพื่อให้อัปเดตถึงผู้ใช้ทันที
      const res = await fetch(same && !stable ? new Request(req, { cache: 'no-cache' }) : req);
      if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return hit || Response.error();
    }
  }));
});
