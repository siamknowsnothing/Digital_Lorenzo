/**
 * Dynamic sitemap.xml
 *
 * The static sitemap.xml you had before could only ever list the fixed
 * pages that existed when it was written — every /model/<slug> page added
 * afterward through the admin panel was invisible to search engines,
 * since nothing ever regenerated the file.
 *
 * This serverless function replaces it: vercel.json rewrites requests for
 * /sitemap.xml to this function, which fetches the current model list
 * straight from Firestore (via its public REST API — same technique as
 * middleware.js, so no credentials needed) and builds the sitemap fresh
 * on every request, always reflecting exactly what's live right now.
 */

const FIREBASE_PROJECT_ID = 'lorenzo-cdd62';
const SITE_ORIGIN = 'https://www.lorenzodigital.com';

// Static pages that always exist, regardless of what's in the database.
// #gallery is gone — the gallery is now its own real page at /gallery.
const STATIC_PATHS = ['/', '/gallery', '/#services', '/#about', '/#photographers', '/#models', '/#contact'];

export default async function handler(req, res) {
  let modelSlugs = [];
  let categorySlugs = [];
  try {
    modelSlugs = await fetchAllModelSlugs();
  } catch (err) {
    // If Firestore is briefly unreachable, still serve a valid sitemap
    // with just the static pages rather than failing the request entirely.
    console.error('sitemap: failed to fetch models', err);
  }
  try {
    categorySlugs = await fetchAllCategorySlugs();
  } catch (err) {
    console.error('sitemap: failed to fetch categories', err);
  }

  const today = new Date().toISOString().split('T')[0];

  const staticUrls = STATIC_PATHS.map(path => urlEntry(SITE_ORIGIN + path, today, path === '/' ? '1.0' : '0.7'));
  const modelUrls = modelSlugs.map(slug => urlEntry(`${SITE_ORIGIN}/model/${slug}`, today, '0.8'));
  const categoryUrls = categorySlugs.map(slug => urlEntry(`${SITE_ORIGIN}/gallery/${slug}`, today, '0.7'));

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...modelUrls, ...categoryUrls].join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Cache at the edge for an hour so normal traffic doesn't hit Firestore
  // on every single crawl request, while still staying reasonably fresh.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}

async function fetchAllModelSlugs() {
  const listUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/models?pageSize=300`;
  const resp = await fetch(listUrl);
  if (!resp.ok) throw new Error('Firestore fetch failed: ' + resp.status);
  const data = await resp.json();
  const docs = (data.documents || []).map(fromFirestoreDoc);
  return docs.map(getModelSlug).filter(Boolean);
}

// Categories aren't their own Firestore documents — they're derived from
// each photo's "category" field, same as the client-side getCats().
async function fetchAllCategorySlugs() {
  const listUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/photos?pageSize=1000`;
  const resp = await fetch(listUrl);
  if (!resp.ok) throw new Error('Firestore fetch failed: ' + resp.status);
  const data = await resp.json();
  const docs = (data.documents || []).map(fromFirestoreDoc);
  const cats = new Set(docs.map(p => p.category).filter(Boolean));
  return [...cats].map(slugify).filter(Boolean);
}

function fromFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const out = {};
  for (const [key, val] of Object.entries(fields)) {
    out[key] = val.stringValue ?? val.integerValue ?? val.doubleValue ?? val.booleanValue ?? '';
  }
  return out;
}

// Mirrors the same "custom slug wins, else derive from name" rule used in
// index.html and middleware.js, so sitemap URLs always match the URLs
// people actually land on.
function getModelSlug(model) {
  return model.slug && model.slug.trim() ? slugify(model.slug) : slugify(model.name);
}

function slugify(name) {
  return (
    (name || '')
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
  );
}

function urlEntry(loc, lastmod, priority) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <priority>${priority}</priority>
  </url>`;
}

function escapeXml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
}
