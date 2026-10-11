import crypto from 'node:crypto';

const DEFAULT_OWNER = 'shahrozahmed789';
const DEFAULT_REPO = 'rankwise';
const DEFAULT_BRANCH = 'main';
const CONTENT_PATH = 'content/pages.json';

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function verifyToken(request) {
  const sessionSecret = process.env.ADMIN_SESSION_SECRET || '';
  if (sessionSecret.length < 32) return false;
  const header = request.headers.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', sessionSecret).update(payload).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return decoded.sub === 'rankwise-admin' && Number(decoded.exp) > Date.now();
  } catch { return false; }
}
function ghHeaders(token) {
  return { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
}
function config() {
  return { owner: process.env.GITHUB_OWNER || DEFAULT_OWNER, repo: process.env.GITHUB_REPO || DEFAULT_REPO, branch: process.env.GITHUB_BRANCH || DEFAULT_BRANCH, token: process.env.GITHUB_TOKEN || '' };
}
async function githubGet(owner, repo, token, branch) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${CONTENT_PATH}?ref=${encodeURIComponent(branch)}`;
  const r = await fetch(endpoint, { headers: ghHeaders(token), signal: AbortSignal.timeout(12000) });
  if (r.status === 404) return { file: null, sha: null };
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.message || `GitHub read failed (${r.status}).`);
  const decoded = Buffer.from(String(json.content || '').replace(/\n/g, ''), 'base64').toString('utf8');
  return { file: JSON.parse(decoded), sha: json.sha };
}
function cleanString(value, max, fallback = '') {
  return String(value ?? fallback).replace(/\u0000/g, '').trim().slice(0, max);
}
function normalizePage(p, i) {
  const allowedTypes = new Set(['home', 'serp', 'keyword', 'content']);
  const id = cleanString(p.id, 80) || `page-${i + 1}`;
  const type = allowedTypes.has(p.type) ? p.type : 'content';
  const requiredTypes = { home: 'home', 'serp-checker': 'serp', 'keyword-explorer': 'keyword' };
  if (requiredTypes[id] && type !== requiredTypes[id]) throw new Error(`The built-in page ${id} must keep type ${requiredTypes[id]}.`);
  const slug = type === 'home' ? '' : cleanString(p.slug, 60).toLowerCase();
  if (type !== 'home' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error(`Invalid URL slug for ${cleanString(p.title, 100, id)}.`);
  if (type !== 'home' && ['admin', 'api', 'content', 'netlify', 'assets', 'sitemap', 'robots', '404'].includes(slug)) throw new Error(`The URL slug “${slug}” is reserved.`);
  const features = Array.isArray(p.features) ? p.features.slice(0, 6).map(f => ({ title: cleanString(f.title, 100), text: cleanString(f.text, 500) })) : [];
  const status = p.status === 'draft' ? 'draft' : 'published';
  if (type === 'home' && status !== 'published') throw new Error('The home page must stay published.');
  return {
    id, type, title: cleanString(p.title, 100, 'Untitled page'), slug, status, noindex: Boolean(p.noindex),
    metaTitle: cleanString(p.metaTitle, 70), metaDescription: cleanString(p.metaDescription, 180), focusKeyword: cleanString(p.focusKeyword, 120),
    ogImage: cleanString(p.ogImage, 1000), canonicalUrl: cleanString(p.canonicalUrl, 1000), heading: cleanString(p.heading, 180), intro: cleanString(p.intro, 1200), body: cleanString(p.body, 18000),
    ctaText: cleanString(p.ctaText, 70), ctaUrl: cleanString(p.ctaUrl, 300),
    featuresHeading: cleanString(p.featuresHeading, 120), featuresIntro: cleanString(p.featuresIntro, 500), features,
    toolsHeading: cleanString(p.toolsHeading, 120), toolsIntro: cleanString(p.toolsIntro, 500), testimonialQuote: cleanString(p.testimonialQuote, 500), testimonialBy: cleanString(p.testimonialBy, 100), ctaHeading: cleanString(p.ctaHeading, 140), ctaIntro: cleanString(p.ctaIntro, 500),
    redirectFrom: Array.isArray(p.redirectFrom) ? p.redirectFrom.slice(0, 10).map(s => cleanString(s, 60).toLowerCase()).filter(s => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) : []
  };
}
function validateData(data, current) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.pages)) throw new Error('The submitted page data is invalid.');
  if (data.pages.length < 1 || data.pages.length > 40) throw new Error('Keep between 1 and 40 pages.');
  const pages = data.pages.map(normalizePage);
  if (pages.filter(p => p.type === 'home').length !== 1 || !pages.some(p => p.type === 'home' && p.id === 'home')) throw new Error('The required Home page must remain in the page list.');
  for (const coreId of ['serp-checker', 'keyword-explorer']) {
    if (!pages.some(p => p.id === coreId)) throw new Error(`Required tool page ${coreId} cannot be removed.`);
  }
  const ids = pages.map(p => p.id); if (new Set(ids).size !== ids.length) throw new Error('Each page must have a unique internal ID.');
  const published = pages.filter(p => p.status === 'published' && p.type !== 'home');
  const slugs = published.map(p => p.slug); if (new Set(slugs).size !== slugs.length) throw new Error('Every published page must have a unique URL slug.');
  for (const p of pages) { if (!p.title || !p.heading || !p.metaTitle || !p.metaDescription) throw new Error(`Page “${p.title || p.id}” needs a page name, H1, SEO title and meta description.`); }
  const siteUrl = cleanString(data.siteUrl, 250, current?.siteUrl || 'https://rankwisepure.netlify.app').replace(/\/+$/, '');
  if (!/^https:\/\//i.test(siteUrl)) throw new Error('Website URL must start with https://.');
  const brand = cleanString(data.brand, 60, 'Rankwise') || 'Rankwise';
  // Carry old slugs into permanent redirects when an editor changes a URL.
  const oldPages = new Map((current?.pages || []).map(p => [p.id, p]));
  for (const p of pages) {
    const old = oldPages.get(p.id);
    if (old && old.type !== 'home' && old.slug && old.slug !== p.slug) p.redirectFrom = [...new Set([...(p.redirectFrom || []), old.slug])].slice(-10);
  }
  return { siteUrl, brand, pages };
}

export default async function handler(request) {
  if (!['GET', 'PUT'].includes(request.method)) return reply({ code: 'METHOD_NOT_ALLOWED', error: 'Use GET or PUT.' }, 405);
  if (!verifyToken(request)) return reply({ code: 'UNAUTHORIZED', error: 'Please sign in to the admin panel again.' }, 401);
  const { owner, repo, token, branch } = config();
  if (!token) return reply({ code: 'GITHUB_TOKEN_MISSING', error: 'Admin storage is not configured yet. Add the GITHUB_TOKEN secret in Netlify. It must have Contents: Read and write access to the rankwise repository.' }, 503);
  try {
    if (request.method === 'GET') {
      const current = await githubGet(owner, repo, token, branch);
      if (!current.file) return reply({ code: 'CONTENT_FILE_MISSING', error: 'The content/pages.json file is missing from the repository. Deploy the Rankwise CMS starter files first.' }, 404);
      return reply(current.file);
    }
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 250000) return reply({ code: 'PAYLOAD_TOO_LARGE', error: 'Content submission is too large.' }, 413);
    let body;
    try { body = await request.json(); } catch { return reply({ code: 'INVALID_JSON', error: 'Request body must be valid JSON.' }, 400); }
    const current = await githubGet(owner, repo, token, branch);
    if (!current.file) return reply({ code: 'CONTENT_FILE_MISSING', error: 'The content/pages.json file is missing from the repository.' }, 404);
    let clean;
    try { clean = validateData(body, current.file); } catch (err) { return reply({ code: 'INVALID_CONTENT', error: err.message }, 400); }
    const next = { siteUrl: clean.siteUrl, brand: clean.brand, pages: clean.pages };
    const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${CONTENT_PATH}`;
    const payload = { message: 'Update Rankwise CMS content from admin panel', content: Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8').toString('base64'), branch };
    if (current.sha) payload.sha = current.sha;
    const r = await fetch(endpoint, { method: 'PUT', headers: ghHeaders(token), body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = r.status === 401 || r.status === 403 ? 'GitHub rejected the repository token. Check that GITHUB_TOKEN has Contents: Read and write permission for shahrozahmed789/rankwise.' : r.status === 409 ? 'A repository update conflict occurred. Click Reload from GitHub and try saving again.' : (result.message || `GitHub save failed (${r.status}).`);
      return reply({ code: 'GITHUB_SAVE_FAILED', error: msg }, r.status === 409 ? 409 : 502);
    }
    return reply({ ...next, saved: true, commit: result.commit?.sha || null, message: 'Saved to GitHub. Netlify will rebuild from the new commit.' }, 200);
  } catch (err) {
    return reply({ code: 'ADMIN_BACKEND_ERROR', error: `Could not reach GitHub content storage: ${String(err.message || 'unknown error').slice(0, 220)}` }, 502);
  }
}
