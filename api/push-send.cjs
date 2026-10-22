/* POST /api/push-send  — শুধু অ্যাডমিন (Supabase সেশন টোকেন দিয়ে যাচাই)
   Body: { action:'count' }
         { action:'send', title, body, url, tag,
           audience: { type:'all' } | { type:'order', order_id } | { type:'preorder', book_id } }
   Env:  VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:you@example.com),
         SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY                                      */
const webpush = require('web-push');

const SUPA = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
// নতুন sb_secret_... কী JWT নয় — Authorization হেডারে পাঠাতে হয় না; পুরনো service_role (eyJ...) হলে পাঠানো হয়
const H = (extra) => Object.assign({ apikey: KEY }, KEY.startsWith('eyJ') ? { Authorization: 'Bearer ' + KEY } : {}, extra || {});

async function rest(path, opts) {
  const r = await fetch(SUPA + '/rest/v1/' + path, Object.assign({ headers: H() }, opts || {}));
  if (!r.ok) throw new Error('DB ' + r.status + ' ' + (await r.text()).slice(0, 120));
  return r;
}

async function requireAdmin(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  if (!m) return false;
  const u = await fetch(SUPA + '/auth/v1/user', { headers: { apikey: KEY, Authorization: 'Bearer ' + m[1] } });
  if (!u.ok) return false;
  const id = (await u.json()).id;
  if (!id) return false;
  const rows = await (await rest('admin_users?id=eq.' + encodeURIComponent(id) + '&select=id')).json();
  return rows.length > 0;
}

async function userIdsFor(aud) {
  if (aud.type === 'order') {
    const rows = await (await rest('orders?id=eq.' + encodeURIComponent(aud.order_id) + '&select=user_id')).json();
    return rows.map(r => r.user_id).filter(Boolean);
  }
  if (aud.type === 'preorder') {
    const rows = await (await rest('orders?preorder_book_id=eq.' + encodeURIComponent(String(aud.book_id)) + '&user_id=not.is.null&select=user_id')).json();
    return [...new Set(rows.map(r => r.user_id))];
  }
  return null;   // all
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SUPA || !KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY)
    return res.status(500).json({ error: 'সার্ভারে Environment Variables সেট করা নেই (VAPID / SUPABASE)' });
  try {
    if (!(await requireAdmin(req))) return res.status(401).json({ error: 'শুধু অ্যাডমিন পাঠাতে পারবেন' });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@example.com', process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (b.action === 'count') {
      const r = await rest('push_subscriptions?select=id', { headers: H({ Prefer: 'count=exact', Range: '0-0' }) });
      const total = Number((r.headers.get('content-range') || '').split('/')[1]) || 0;
      return res.status(200).json({ total });
    }

    const title = String(b.title || '').trim().slice(0, 80);
    const body = String(b.body || '').trim().slice(0, 240);
    if (!title || !body) return res.status(400).json({ error: 'টাইটেল ও মেসেজ দিন' });
    const url = String(b.url || '/');
    if (!/^\//.test(url) || /^\/\//.test(url)) return res.status(400).json({ error: 'লিংক "/" দিয়ে শুরু হতে হবে (যেমন /order/GM-2026-00001)' });

    const aud = b.audience || { type: 'all' };
    const ids = await userIdsFor(aud);
    let q = 'push_subscriptions?select=endpoint,p256dh,auth&limit=5000';
    if (ids) {
      if (!ids.length) return res.status(200).json({ total: 0, sent: 0, failed: 0, removed: 0 });
      q += '&user_id=in.(' + ids.map(encodeURIComponent).join(',') + ')';
    }
    const subs = await (await rest(q)).json();
    const payload = JSON.stringify({ title, body, url, tag: b.tag || undefined });
    let sent = 0, failed = 0; const dead = [];
    for (let i = 0; i < subs.length; i += 50) {
      const res2 = await Promise.allSettled(subs.slice(i, i + 50).map(s =>
        webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 86400 })));
      res2.forEach((r, k) => {
        if (r.status === 'fulfilled') sent++;
        else { failed++; const sc = r.reason && r.reason.statusCode; if (sc === 404 || sc === 410) dead.push(subs[i + k].endpoint); }
      });
    }
    for (const ep of dead) { try { await rest('push_subscriptions?endpoint=eq.' + encodeURIComponent(ep), { method: 'DELETE' }); } catch (e) {} }
    return res.status(200).json({ total: subs.length, sent, failed, removed: dead.length });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
};
