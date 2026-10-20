// Serves index.html with page-specific <title>, description, canonical, Open Graph and JSON-LD
// for /product/*, /category/*, /author/*, /publisher/*, /subcategory/* so Google sees them without running JS.
const { SITE, fetchAll, productSlugs, catSlug, buildIndex, esc, norm, loadProducts } = require('./_lib');

const clip = (s, n) => { s = norm(String(s || '').replace(/<[^>]*>/g, ' ')); return s.length > n ? s.slice(0, n - 1).trim() + '…' : s; };
const dec = s => { try { return decodeURIComponent(s); } catch (e) { return s; } };
// ছবির লিংক সবসময় absolute https হতে হবে; images[0] অবজেক্ট ({url:..}) হলেও কাজ করবে
const absImg = v => {
  if (v && typeof v === 'object') v = v.url || v.src || v.publicUrl || '';
  v = String(v || '').trim();
  if (!v) return '';
  if (v.startsWith('//')) v = 'https:' + v;
  else if (v.startsWith('/')) v = SITE + v;
  else if (v.startsWith('http://')) v = 'https://' + v.slice(7);
  return v.replace(/ /g, '%20');
};

async function meta(kind, slug) {
  const products = await loadProducts();
  const s = dec(slug).toLowerCase();
  if (kind === 'product') {
    const slugs = productSlugs(products);
    const i = slugs.findIndex(x => x.toLowerCase() === s);
    const p = i >= 0 ? products[i] : products.find(x => String(x.id).toLowerCase() === s);
    if (!p) return null;
    const url = `${SITE}/product/${slugs[products.indexOf(p)]}`;
    const by = norm(p.author || p.brand || '');
    const title = `${p.name}${by ? ' - ' + by : ''} | বুক গ্যালাক্সি`;
    const desc = clip(p.description, 155) || `${p.name}${by ? ' (' + by + ')' : ''} — বুক গ্যালাক্সি থেকে অনলাইনে অর্ডার করুন। মূল্য ৳${p.price}। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।`;
    const img = absImg(p.image_url || (Array.isArray(p.images) && p.images[0]) || '');
    const ld = {
      '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc,
      ...(img && { image: [img] }), sku: String(p.id),
      ...(by && { brand: { '@type': 'Brand', name: by } }),
      offers: { '@type': 'Offer', url, priceCurrency: 'BDT', price: String(p.price),
        availability: Number(p.stock) > 0 || p.stock == null ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' }
    };
    return { title, desc, url, img, ld, type: 'product' };
  }
  if (kind === 'category') {
    const cats = await fetchAll('categories', 'select=*');
    const c = cats.find(x => catSlug(x).toLowerCase() === s);
    if (!c) return null;
    return { title: `${c.name} বই কিনুন অনলাইনে | বুক গ্যালাক্সি`, desc: `${c.name} ক্যাটাগরির সেরা বই — কম দামে, সারা বাংলাদেশে হোম ডেলিভারি। বুক গ্যালাক্সি।`, url: `${SITE}/category/${catSlug(c)}`, type: 'website' };
  }
  const e = buildIndex(products, kind).find(x => x.slug.toLowerCase() === s);
  if (!e) return null;
  const label = { author: 'লেখকের বই', publisher: 'প্রকাশনীর বই', subcategory: 'বই' }[kind];
  return { title: `${e.name} ${label} | বুক গ্যালাক্সি`, desc: `${e.name} — ${label}র সম্পূর্ণ তালিকা। বুক গ্যালাক্সি থেকে অনলাইনে অর্ডার করুন।`, url: `${SITE}/${kind}/${e.slug}`, type: 'website' };
}

module.exports = async (req, res) => {
  const base = await (await fetch(`${SITE}/index.html`)).text();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const stripped = base.replace(/<!--HOME-SEO-->[\s\S]*?<!--\/HOME-SEO-->/, '');
  try {
    const m = await meta(req.query.kind, req.query.slug);
    if (!m) { res.setHeader('Cache-Control', 'public, s-maxage=300'); return res.status(200).send(base); }
    const tags = [
      `<meta name="description" content="${esc(m.desc)}">`,
      `<link rel="canonical" href="${esc(m.url)}">`,
      `<meta property="og:site_name" content="বুক গ্যালাক্সি">`,
      `<meta property="og:type" content="${m.type}">`,
      `<meta property="og:title" content="${esc(m.title)}">`,
      `<meta property="og:description" content="${esc(m.desc)}">`,
      `<meta property="og:url" content="${esc(m.url)}">`,
      m.img ? `<meta property="og:image" content="${esc(m.img)}">` : '',
      m.img ? `<meta property="og:image:secure_url" content="${esc(m.img)}">` : '',
      m.img ? `<meta property="og:image:alt" content="${esc(m.title)}">` : '',
      m.img ? `<meta name="twitter:image" content="${esc(m.img)}">` : '',
      `<meta name="twitter:card" content="${m.img ? 'summary_large_image' : 'summary'}">`,
      m.ld ? `<script type="application/ld+json">${JSON.stringify(m.ld).replace(/</g, '\\u003c')}</script>` : ''
    ].join('\n');
    const html = stripped.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>\n${tags}`);
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (e) {
    res.status(200).send(base);   // never break the site if Supabase is slow
  }
};
