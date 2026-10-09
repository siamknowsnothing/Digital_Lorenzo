# Studio Lorenzo photography portfolio (lorenzodigital.com)
NOT Lorenzo Net / Lorenzo Broadband (the ISP site). Ignore anything about other projects.

Single-file site: index.html (inline CSS+JS, ~4,200 lines). Hosted on Vercel (repo siamknowsnothing/Digital_Lorenzo), backend Firebase compat SDK v10.14.1 (Firestore, Storage, Auth).
Other files: middleware.js (Edge, crawler OG tags for /model/*), api/sitemap.js (dynamic sitemap; must stay in api/), vercel.json (sitemap rewrite BEFORE catch-all), privacy.html (static), manifest.json, robots.txt.

RULES
- Keep the dark luxury look: --bg #080808, --gold #c8a96e; fonts Playfair Display / Cormorant Garamond / Lato. Improve structure and polish, not the brand.
- Never push to git. I push myself.
- Do not log in as admin or upload/delete anything while testing: the local site talks to the LIVE Firebase database.
- Always respect prefers-reduced-motion.
- Work in small sections (index.html is large). Re-read before each edit.
- Test locally at http://localhost:3000 (npx serve -s .).

GOTCHAS
- Grid images start opacity:0 and need onload to add .loaded/.img-ready, in EVERY grid template (gallery, featured, model gallery).
- Storage URL cache-buster must be &t=, never ?t=.
- Firestore orderBy silently drops docs missing the field.
- Routes: /gallery, /gallery/<category-slug>, /models, /model/<slug>. History API; replaceState for category tabs.
- Footer is a grid 1fr auto 1fr so the credit stays truly centered.
- Admin drag-reorder is desktop mouse only.
