// api/notify-order.js
// নতুন অর্ডারের Telegram নোটিফিকেশন (Vercel Serverless Function)
//
// Environment Variables (Vercel):
//   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID   (আপনি সেট করেছেন)
//   SUPABASE_URL, SUPABASE_ANON_KEY        (ঐচ্ছিক — না দিলে নিচের পাবলিক ডিফল্ট ব্যবহার হবে)

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://srasvcuycvfspbwhnbpl.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXN2Y3V5Y3Zmc3Bid2huYnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzc4MjIsImV4cCI6MjA5MzcxMzgyMn0.FMU8DM-a0wg3Yxke1q-L79_kqYU3UkS4dibeH04AGJU';

const MAX_ORDER_AGE_MS = 10 * 60 * 1000; // ১০ মিনিটের পুরনো অর্ডারের নোটিফিকেশন যাবে না

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const money = (n) => '৳' + Number(n || 0).toLocaleString('en-US');

function buildMessage(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const MAX_ITEMS = 25;

  const lines = items.slice(0, MAX_ITEMS).map((it, i) => {
    const qty = Number(it.qty) || 1;
    const price = Number(it.price) || 0;
    return `${i + 1}. ${esc(it.name)}\n    ${qty} × ${money(price)} = <b>${money(qty * price)}</b>`;
  });
  if (items.length > MAX_ITEMS) {
    lines.push(`… এবং আরও ${items.length - MAX_ITEMS}টি পণ্য`);
  }

  const totalQty = items.reduce((s, it) => s + (Number(it.qty) || 1), 0);
  const when = o.created_at
    ? new Date(o.created_at).toLocaleString('en-GB', {
        timeZone: 'Asia/Dhaka',
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '';

  const parts = [
    '🛒 <b>নতুন অর্ডার এসেছে!</b>',
    '',
    `🧾 <b>অর্ডার নং:</b> <code>${esc(o.order_number)}</code>`,
    when ? `🕒 ${esc(when)}` : '',
    '',
    '👤 <b>কাস্টমার</b>',
    `নাম: ${esc(o.customer_name)}`,
    `ফোন: ${esc(o.customer_phone)}`,
    o.customer_email ? `ইমেইল: ${esc(o.customer_email)}` : '',
    '',
    '📍 <b>ডেলিভারি ঠিকানা</b>',
    esc(o.customer_address),
    o.customer_district ? esc(o.customer_district) : '',
    '',
    `📦 <b>পণ্যের তালিকা</b> (${totalQty}টি)`,
    lines.join('\n'),
    '',
    '💰 <b>বিল</b>',
    `সাবটোটাল: ${money(o.subtotal)}`,
    `ডেলিভারি চার্জ: ${money(o.delivery_fee)}`,
    Number(o.discount) > 0 ? `ডিসকাউন্ট: -${money(o.discount)}` : '',
    `<b>মোট প্রদেয়: ${money(o.total)}</b>`,
    '',
    '💵 পেমেন্ট: ক্যাশ অন ডেলিভারি',
  ];

  // শর্তে বাদ পড়া লাইনের কারণে পরপর ফাঁকা লাইন হলে একটাই রাখা হয়
  return parts.filter((l, i) => l !== '' || (parts[i - 1] !== '' && i > 0)).join('\n');
}

async function fetchOrder(orderNumber) {
  const u =
    `${SUPABASE_URL}/rest/v1/orders` +
    `?order_number=eq.${encodeURIComponent(orderNumber)}&select=*&limit=1`;
  const r = await fetch(u, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.error('[notify-order] Telegram env vars missing');
    return res.status(500).json({ ok: false, error: 'Telegram not configured' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const orderNumber = String(body.order_number || '').trim();
    if (!/^GM-\d{4}-\d{5}$/.test(orderNumber)) {
      return res.status(400).json({ ok: false, error: 'Invalid order_number' });
    }

    // নিরাপত্তা: মেসেজের ডেটা ক্লায়েন্ট থেকে নয়, সরাসরি ডাটাবেস থেকে নেওয়া হয় —
    // যাতে কেউ ফেক ডেটা পাঠিয়ে আপনার টেলিগ্রামে স্প্যাম করতে না পারে।
    const order = await fetchOrder(orderNumber);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    const age = Date.now() - new Date(order.created_at).getTime();
    if (!(age >= 0 && age <= MAX_ORDER_AGE_MS)) {
      return res.status(400).json({ ok: false, error: 'Order too old' });
    }

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: buildMessage(order),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!tg.ok) {
      console.error('[notify-order] Telegram error:', tg.status, await tg.text());
      return res.status(502).json({ ok: false, error: 'Telegram send failed' });
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('[notify-order] error:', e);
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
};
