/* sw.js — 오프라인 캐싱 (파일을 고치면 CACHE_NAME 숫자를 올려 주세요) */
const CACHE_NAME = 'gunghap-core-v10';
const ASSETS = ['./','./index.html','./styles.css','./config.js','./lunar.js','./saju-core.js','./gunghap-core.js','./gunghap-report.js','./app.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))); self.clients.claim(); });
// 네트워크 우선: 설정(config.js)을 고치면 바로 반영되도록
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (r.status === 200) { const c = r.clone(); caches.open(CACHE_NAME).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
