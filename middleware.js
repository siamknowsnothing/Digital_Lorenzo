/**
 * Vercel Edge Middleware — social-preview support for /model/:slug pages.
 *
 * Studio Lorenzo is a client-rendered single-page app, so a crawler that
 * doesn't run JavaScript (Facebook, WhatsApp, Twitter/X, LinkedIn, Slack,
 * Telegram, Discord, etc.) sees an empty shell and no per-model title,
 * description, or image when a model's link is shared.
 *
 * This middleware runs BEFORE the normal vercel.json rewrite to index.html.
 * It only acts on requests to /model/<slug> AND only when the request's
 * User-Agent matches a known crawler/bot. For every normal human visitor
 * it does nothing and the request falls through to the SPA exactly as
 * before — this file changes nothing about how real visitors experience
 * the site.
 *
 * When a crawler is detected, it fetches the matching model from Firestore
 * (via the public REST API — this relies on your existing
 * "allow read: if true" Firestore rule, so no credentials are needed here)
 * and returns a tiny static HTML document with proper Open Graph / Twitter
 * Card meta tags pointing at that model's name, bio, and photo.
 */

export const config = {
  matcher: '/model/:path*',
};

// Your Firebase project ID (from firebaseConfig in index.html)
const FIREBASE_PROJECT_ID = 'lorenzo-cdd62';
const SITE_NAME = 'Studio Lorenzo';

// Known social/link-preview crawlers. Regular browsers (Chrome, Safari,
// Firefox, mobile Safari, etc.) never match this, so they're unaffected.
const BOT_UA_REGEX =
  /facebookexternalhit|Facebot|Twitterbot|WhatsApp|Slackbot|LinkedInBot|TelegramBot|Discordbot|SkypeUriPreview|Pinterest|redditbot|Applebot|vkShare|W3C_Validator|Googlebot|bingbot|DuckDuckBot/i;

export default async function middleware(request) {
  const userAgent = request.headers.get('user-agent') || '';
  if (!BOT_UA_REGEX.test(userAgent)) return; // real browser — let the SPA handle it

  const url = new URL(request.url);
  const match = url.pathname.match(/^\/model\/([^/]+)\/?$/i);
  if (!match) return; // not a model page

  const slug = decodeURIComponent(match[1]);

  try {
    const model = await fetchModelBySlug(slug);
    const html = model
      ? renderModelOgHtml(model, url.origin, slug)
      : renderNotFoundOgHtml(url.origin);
    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch (err) {
    // Any failure (network hiccup, bad data, etc.) — don't break the
    // request, just let it fall through to the normal SPA.
    return;
  }
}

async function fetchModelBySlug(slug) {
  const listUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/models?pageSize=300`;
  const resp = await fetch(listUrl);
  if (!resp.ok) throw new Error('Firestore fetch failed: ' + resp.status);
  const data = await resp.json();
  const docs = (data.documents || []).map(fromFirestoreDoc);
  return docs.find((m) => slugify(m.name) === slug) || null;
}

// Converts a Firestore REST API document into a plain {field: value} object.
function fromFirestoreDoc(doc) {
  const fields = doc.fields || {};
  const out = { id: doc.name.split('/').pop() };
  for (const [key, val] of Object.entries(fields)) {
    out[key] =
      val.stringValue ??
      val.integerValue ??
      val.doubleValue ??
      val.booleanValue ??
      '';
  }
  return out;
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
      .replace(/^-|-$/g, '') || 'model'
  );
}

function escapeHtml(s) {
  return String(s || '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function renderModelOgHtml(model, origin, slug) {
  const title = `${model.name} | ${SITE_NAME} Models`;
  const desc = (
    model.bio ||
    `${model.name} — ${model.role || 'Model'} represented by ${SITE_NAME}.`
  ).slice(0, 160);
  const image = model.photo_url || `${origin}/og-cover.jpg`;
  const pageUrl = `${origin}/model/${slug}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${pageUrl}">

<meta property="og:type" content="profile">
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${escapeHtml(image)}">

<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
</head>
<body>
<p><a href="${pageUrl}">${escapeHtml(model.name)} — view full profile</a></p>
</body>
</html>`;
}

function renderNotFoundOgHtml(origin) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(SITE_NAME)}</title>
<meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
<meta property="og:title" content="${escapeHtml(SITE_NAME)}">
<meta property="og:url" content="${origin}/">
</head>
<body>
<p><a href="${origin}/">${escapeHtml(SITE_NAME)}</a></p>
</body>
</html>`;
}
