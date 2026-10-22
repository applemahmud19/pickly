/* বুক গ্যালাক্সি — Service Worker
   ১) অফলাইনে ভদ্র একটা পেজ  ২) পুশ নোটিফিকেশন
   সাইটের বাকি রিকোয়েস্ট (Supabase, API, ছবি) সরাসরি নেটওয়ার্কেই যায় — কিছু ক্যাশ করা হয় না। */
const CACHE = 'gm-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [OFFLINE_URL, '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {            // পেজ খোলা: নেটওয়ার্ক না থাকলে অফলাইন পেজ
    e.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  const u = new URL(req.url);
  if (u.origin === location.origin && PRECACHE.includes(u.pathname)) {   // শুধু আইকন: ক্যাশ-ফার্স্ট
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
  }
});

/* ── পুশ ── */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'বুক গ্যালাক্সি';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '',
    icon: d.icon || '/icon-192.png',
    badge: '/icon-192.png',
    tag: d.tag || undefined,
    data: { url: d.url || '/' },
    lang: 'bn',
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (new URL(c.url).origin === self.location.origin && 'focus' in c) {
        return c.focus().then(w => { try { return w.navigate ? w.navigate(url) : w; } catch (err) { return w; } });
      }
    }
    return self.clients.openWindow(url);
  }));
});
