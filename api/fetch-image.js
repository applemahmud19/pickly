// Vercel Serverless Function: /api/fetch-image?url=<ছবির লিংক>
// Admin panel বাইরের ছবি ডাউনলোড করার সময় CORS বাধা এড়াতে এটা ব্যবহার করে।
// দরকারি Environment Variables (Vercel → Settings → Environment Variables):
//   SUPABASE_URL       = https://xxxx.supabase.co
//   SUPABASE_ANON_KEY  = আপনার anon public key
const dns = require('dns').promises;
const net = require('net');

const MAX_BYTES = 4 * 1024 * 1024; // Vercel response limit ~4.5MB

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80');
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) { if (isPrivateIp(hostname)) throw new Error('blocked host'); return; }
  const addrs = await dns.lookup(hostname, { all: true });
  if (!addrs.length || addrs.some(a => isPrivateIp(a.address))) throw new Error('blocked host');
}

async function isLoggedIn(authHeader) {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !authHeader) return false;
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/auth/v1/user', { headers: { Authorization: authHeader, apikey: key } });
    return r.ok;
  } catch { return false; }
}

module.exports = async (req, res) => {
  try {
    if (!(await isLoggedIn(req.headers.authorization))) return res.status(401).json({ error: 'unauthorized' });
    let target;
    try { target = new URL(String(req.query.url || '')); } catch { return res.status(400).json({ error: 'bad url' }); }

    let resp;
    for (let hop = 0; hop < 4; hop++) {
      if (!/^https?:$/.test(target.protocol)) return res.status(400).json({ error: 'bad protocol' });
      await assertPublicHost(target.hostname);
      const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10000);
      resp = await fetch(target, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 BookGalaxyImageFetcher', Accept: 'image/*' } });
      clearTimeout(t);
      if (resp.status >= 300 && resp.status < 400 && resp.headers.get('location')) { target = new URL(resp.headers.get('location'), target); continue; }
      break;
    }
    if (!resp || !resp.ok) return res.status(502).json({ error: 'upstream ' + (resp && resp.status) });
    const type = (resp.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(type)) return res.status(415).json({ error: 'not an image' });
    if (Number(resp.headers.get('content-length') || 0) > MAX_BYTES) return res.status(413).json({ error: 'too large' });
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > MAX_BYTES) return res.status(413).json({ error: 'too large' });
    res.setHeader('Content-Type', type);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(502).json({ error: String(e.message || e) });
  }
};
