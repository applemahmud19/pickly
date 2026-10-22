// Shared helpers for sitemap + SEO functions (public read-only data via Supabase REST).
const { makeSlug } = require('./_slug');

const SUPABASE_URL  = 'https://srasvcuycvfspbwhnbpl.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNyYXN2Y3V5Y3Zmc3Bid2huYnBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzc4MjIsImV4cCI6MjA5MzcxMzgyMn0.FMU8DM-a0wg3Yxke1q-L79_kqYU3UkS4dibeH04AGJU';
const SITE = 'https://www.bookgalaxybd.shop';

// Fetch every row of a table/view (paged, 1000 per request).
async function fetchAll(table, query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}`, Range: `${from}-${from + 999}` }
    });
    if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`);
    const page = await r.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const asciiSlug = v => (v ? makeSlug(String(v)) : '');
const baseProductSlug = p => asciiSlug(p.slug) || makeSlug(p.name) || String(p.id);

// Same rule as productSlug() in index.html (duplicates get an id suffix).
function productSlugs(products) {
  const count = new Map();
  products.forEach(p => { const b = baseProductSlug(p); count.set(b, (count.get(b) || 0) + 1); });
  return products.map(p => {
    const b = baseProductSlug(p);
    return count.get(b) > 1 ? b + '-' + String(p.id).slice(0, 8).toLowerCase() : b;
  });
}

const catSlug = c => (c && (asciiSlug(c.slug) || makeSlug(c.name))) || '';
const norm = s => String(s || '').trim().replace(/\s+/g, ' ');
const isBook = p => (p.product_type ? p.product_type === 'book' : p.category === 'বই');

// Author / publisher / sub-category index, same as buildIndex() in index.html.
function buildIndex(products, kind) {
  const map = new Map();
  products.forEach(p => {
    let names = [];
    if (kind === 'subcategory') names = p.sub_category ? [norm(p.sub_category)] : [];
    else if (isBook(p)) names = kind === 'publisher'
      ? (p.publisher ? [norm(p.publisher)] : [])
      : String(p.author || p.brand || '').split(/[,،]/).map(norm);
    names.filter(Boolean).forEach(n => {
      const k = n.toLowerCase();
      if (!map.has(k)) map.set(k, { key: k, name: n, slug: '' });
    });
  });
  const used = new Set();
  [...map.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).forEach((e, i) => {
    const base = makeSlug(e.name) || (kind + '-' + (i + 1));
    let s = base, n = 2;
    while (used.has(s)) s = base + '-' + (n++);
    used.add(s); e.slug = s;
  });
  return [...map.values()];
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const loadProducts = () => fetchAll('products', 'select=*&is_active=eq.true&order=created_at.desc');

module.exports = { SITE, fetchAll, makeSlug, productSlugs, catSlug, buildIndex, esc, norm, loadProducts };
