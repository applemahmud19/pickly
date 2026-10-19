const { SITE, fetchAll, productSlugs, catSlug, buildIndex, loadProducts } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const [products, categories, posts] = await Promise.all([
      loadProducts(),
      fetchAll('categories', 'select=*').catch(() => []),
      fetchAll('blog_posts', 'select=slug,short_code,published_at,updated_at&status=eq.published').catch(() => [])
    ]);

    const urls = [];
    const add = (path, lastmod, priority) => urls.push({ loc: SITE + encodeURI(path), lastmod, priority });

    add('/', null, '1.0');
    add('/all-products', null, '0.8');
    add('/blog', null, '0.5');
    ['about', 'contact', 'faq', 'return', 'privacy'].forEach(k => add('/info/' + k, null, '0.3'));

    categories.forEach(c => { const s = catSlug(c); if (s) add('/category/' + s, null, '0.8'); });
    ['author', 'publisher', 'subcategory'].forEach(kind =>
      buildIndex(products, kind).forEach(e => add(`/${kind}/${e.slug}`, null, kind === 'subcategory' ? '0.6' : '0.5')));

    const slugs = productSlugs(products);
    products.forEach((p, i) => add('/product/' + slugs[i], (p.updated_at || p.created_at || '').slice(0, 10) || null, '0.9'));
    posts.forEach(b => add('/blog/' + (b.slug || b.short_code), (b.updated_at || b.published_at || '').slice(0, 10) || null, '0.5'));

    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      urls.map(u => `<url><loc>${u.loc.replace(/&/g, '&amp;')}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n') +
      '\n</urlset>';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send('sitemap error: ' + e.message);
  }
};
