import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(ROOT, 'public');
const SRC = path.join(ROOT, 'src');
const CONTENT_FILE = path.join(ROOT, 'content', 'pages.json');
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const escText = (v) => esc(v).replace(/\r?\n/g, '<br>');
const trimSlash = (s) => String(s || '').replace(/\/+$/, '');
const validSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s || '');

function setElement(html, id, content) {
  const idEsc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(<([a-zA-Z][a-zA-Z0-9]*)\\b(?=[^>]*\\bid=["']${idEsc}["'])[^>]*>)[\\s\\S]*?(<\\/\\2>)`, 'i');
  if (!re.test(html)) return html;
  return html.replace(re, (_m, open, _tag, close) => `${open}${content}${close}`);
}
function setMeta(html, page, siteUrl, brand) {
  const route = page.type === 'home' ? '/' : `/${page.slug}/`;
  const canonical = page.canonicalUrl || `${trimSlash(siteUrl)}${route}`;
  const title = page.metaTitle || `${page.title} | ${brand}`;
  const desc = page.metaDescription || '';
  const robots = page.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';
  const keywords = page.focusKeyword || '';
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${esc(desc)}">`);
  html = html.replace(/<meta\s+name=["']robots["'][^>]*>/i, `<meta name="robots" content="${robots}">`);
  html = html.replace(/<meta\s+name=["']keywords["'][^>]*>/i, `<meta name="keywords" content="${esc(keywords)}">`);
  html = html.replace(/<link\s+rel=["']canonical["'][^>]*>/i, `<link rel="canonical" href="${esc(canonical)}">`);
  html = html.replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${esc(title)}">`);
  html = html.replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${esc(desc)}">`);
  html = html.replace(/<meta\s+property=["']og:url["'][^>]*>/i, `<meta property="og:url" content="${esc(canonical)}">`);
  if (/<meta\s+property=["']og:image["'][^>]*>/i.test(html)) {
    html = html.replace(/<meta\s+property=["']og:image["'][^>]*>/i, page.ogImage ? `<meta property="og:image" content="${esc(page.ogImage)}">` : '');
  } else if (page.ogImage) {
    html = html.replace('</head>', `<meta property="og:image" content="${esc(page.ogImage)}">\n</head>`);
  }
  const schema = { '@context': 'https://schema.org', '@type': page.type === 'home' ? 'WebSite' : 'WebPage', name: title, description: desc, url: canonical, publisher: { '@type': 'Organization', name: brand } };
  html = html.replace(/<script id="cms-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="cms-jsonld" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`);
  return html;
}
function bodyParagraphs(text) {
  return String(text || '').split(/\n\s*\n|\r?\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p)}</p>`).join('\n');
}
function injectBodySection(html, id, title, text) {
  const section = String(text || '').trim() ? `<section id="${id}" class="section"><div class="section-head"><div class="eyebrow">More information</div><h2>${esc(title || 'More from Rankwise')}</h2></div><div class="cms-prose" style="max-width:820px;margin:auto;color:var(--muted);font-size:15px;line-height:1.85">${bodyParagraphs(text)}</div></section>` : '';
  const re = new RegExp(`<section id="${id}"[^>]*>[\\s\\S]*?<\\/section>`, 'i');
  return html.replace(re, section);
}
function renderHomeContent(html, home, allPages = []) {
  html = setElement(html, 'cms-home-heading', escText(home.heading));
  html = setElement(html, 'cms-home-intro', escText(home.intro));
  html = setElement(html, 'cms-features-heading', esc(home.featuresHeading));
  html = setElement(html, 'cms-features-intro', esc(home.featuresIntro));
  (home.features || []).slice(0, 6).forEach((f, i) => {
    html = setElement(html, `cms-feature-${i + 1}-title`, esc(f.title));
    html = setElement(html, `cms-feature-${i + 1}-text`, esc(f.text));
  });
  const serpPage = allPages.find(p => p.type === 'serp' && p.status === 'published');
  const keywordPage = allPages.find(p => p.type === 'keyword' && p.status === 'published');
  if (serpPage) { html = setElement(html, 'cms-serp-card-title', esc(serpPage.title)); html = setElement(html, 'cms-serp-card-text', esc(serpPage.intro)); }
  if (keywordPage) { html = setElement(html, 'cms-keyword-card-title', esc(keywordPage.title)); html = setElement(html, 'cms-keyword-card-text', esc(keywordPage.intro)); }
  html = setElement(html, 'cms-tools-heading', esc(home.toolsHeading));
  html = setElement(html, 'cms-tools-intro', esc(home.toolsIntro));
  html = setElement(html, 'cms-quote', `“${esc(home.testimonialQuote)}”`);
  html = setElement(html, 'cms-quote-by', esc(home.testimonialBy));
  html = setElement(html, 'cms-cta-heading', esc(home.ctaHeading));
  html = setElement(html, 'cms-cta-intro', esc(home.ctaIntro));
  if (home.ctaText) {
    const safeUrl = /^(https:\/\/|\/|#)/i.test(home.ctaUrl || '') ? home.ctaUrl : '#serp-checker';
    html = html.replace(/(<section class="cta">[\s\S]*?<a class="btn btn-white" href=")[^"]*("[^>]*>)[\s\S]*?(<\/a>)/i, `$1${esc(safeUrl)}$2${esc(home.ctaText)} →$3`);
  }
  html = injectBodySection(html, 'cms-home-extra', 'More from Rankwise', home.body);
  return html;
}
function insertBeforeSectionClose(html, markerStart, sectionId, title, text) {
  const marker = html.indexOf(markerStart);
  if (marker < 0 || !String(text || '').trim()) return html;
  const nextMainEnd = html.indexOf('</main>', marker);
  if (nextMainEnd < 0) return html;
  const section = `<section id="${sectionId}" class="section" style="max-width:900px;margin:40px auto;padding:0 22px"><h2>${esc(title || 'More information')}</h2><div style="color:var(--muted);font-size:15px;line-height:1.85">${bodyParagraphs(text)}</div></section>`;
  return html.slice(0, nextMainEnd) + section + html.slice(nextMainEnd);
}
function applySiteNav(html, pages) {
  const visible = pages.filter(p => p.status === 'published').slice(0, 7);
  const links = visible.map(p => `<a href="${p.type === 'home' ? '/' : `/${esc(p.slug)}/`}">${esc(p.title)}</a>`).join('');
  let count = 0;
  return html.replace(/<nav class="navlinks">[\s\S]*?<\/nav>/gi, () => { count++; return `<nav class="navlinks">${links}</nav>`; });
}
function applyToolCta(html, page, areaId) {
  if (!page.ctaText || !/^(https:\/\/|\/|#)/i.test(page.ctaUrl || '')) return html;
  const block = `<section class="section" style="max-width:900px;margin:38px auto;padding:0 22px;text-align:center"><a class="btn btn-primary" href="${esc(page.ctaUrl)}">${esc(page.ctaText)} →</a></section>`;
  const start = html.indexOf(`id="${areaId}"`);
  const end = html.indexOf('</main>', start);
  if (start < 0 || end < 0) return html;
  return html.slice(0, end) + block + html.slice(end);
}
function toolHtml(source, page, siteUrl, brand, allPages = []) {
  let html = source;
  if (page.type === 'serp') {
    html = setElement(html, 'cms-serp-heading', escText(page.heading));
    html = setElement(html, 'cms-serp-intro', escText(page.intro));
    html = injectBodySection(html, 'cms-serp-extra', 'About this tool', page.body);
    html = html.replace('window.RANKWISE_PAGE_TYPE = "home";', 'window.RANKWISE_PAGE_TYPE = "serp";');
    html = applyToolCta(html, page, 'serpView');
  } else if (page.type === 'keyword') {
    html = setElement(html, 'cms-home-heading', escText(page.heading));
    html = setElement(html, 'cms-home-intro', escText(page.intro));
    html = setElement(html, 'cms-keyword-card-title', esc(page.title));
    html = setElement(html, 'cms-keyword-card-text', esc(page.intro));
    html = injectBodySection(html, 'cms-keyword-extra', 'Keyword research notes', page.body);
    html = html.replace('window.RANKWISE_PAGE_TYPE = "home";', 'window.RANKWISE_PAGE_TYPE = "keyword";');
    html = applyToolCta(html, page, 'appHome');
  }
  html = applySiteNav(html, allPages);
  return setMeta(html, page, siteUrl, brand);
}
function contentPageHtml(template, page, siteUrl, brand, navLinks) {
  const canonical = page.canonicalUrl || `${trimSlash(siteUrl)}/${page.slug}/`;
  const jsonld = { '@context': 'https://schema.org', '@type': 'WebPage', name: page.metaTitle, description: page.metaDescription, url: canonical, publisher: { '@type': 'Organization', name: brand } };
  const ctaAllowed = page.ctaText && /^(https:\/\/|\/|#)/i.test(page.ctaUrl || '');
  const cta = ctaAllowed ? `<section class="cta"><strong>${esc(page.ctaText)}</strong><a class="btn" href="${esc(page.ctaUrl)}">${esc(page.ctaText)} →</a></section>` : '';
  const replacements = {
    '{{META_TITLE}}': esc(page.metaTitle), '{{META_DESCRIPTION}}': esc(page.metaDescription), '{{ROBOTS}}': page.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large',
    '{{FOCUS_KEYWORD}}': esc(page.focusKeyword), '{{CANONICAL_URL}}': esc(canonical), '{{OG_IMAGE_TAG}}': page.ogImage ? `<meta property="og:image" content="${esc(page.ogImage)}">` : '',
    '{{JSON_LD}}': `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`, '{{BRAND}}': esc(brand), '{{NAV_LINKS}}': navLinks,
    '{{PAGE_LABEL}}': esc(page.title), '{{HEADING}}': escText(page.heading), '{{INTRO}}': esc(page.intro), '{{BODY_PARAGRAPHS}}': bodyParagraphs(page.body), '{{CTA_HTML}}': cta
  };
  let html = template;
  for (const [key, value] of Object.entries(replacements)) html = html.split(key).join(value);
  return html;
}

async function main() {
  const data = JSON.parse(await fs.readFile(CONTENT_FILE, 'utf8'));
  const siteUrl = trimSlash(data.siteUrl || 'https://rankwisepure.netlify.app');
  const brand = data.brand || 'Rankwise';
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const published = pages.filter(p => p.status === 'published');
  const home = published.find(p => p.type === 'home' && p.id === 'home');
  if (!home) throw new Error('Required published home record not found in content/pages.json');
  for (const p of published) {
    if (p.type !== 'home' && !validSlug(p.slug)) throw new Error(`Invalid URL slug on page ${p.title}: ${p.slug}`);
    if (p.type !== 'home' && ['admin','api','content','netlify','assets','sitemap','robots','404'].includes(p.slug)) throw new Error(`Reserved route slug: ${p.slug}`);
  }
  await fs.mkdir(PUBLIC, { recursive: true });
  // Remove CMS page folders generated by the previous local build, without touching the admin or content folders.
  const markerPath = path.join(ROOT, '.cms-generated-routes.json');
  try {
    const oldRoutes = JSON.parse(await fs.readFile(markerPath, 'utf8'));
    for (const slug of oldRoutes) if (validSlug(slug)) await fs.rm(path.join(PUBLIC, slug), { recursive: true, force: true });
  } catch {}
  const source = await fs.readFile(path.join(SRC, 'index.html'), 'utf8');
  const template = await fs.readFile(path.join(SRC, 'content-page-template.html'), 'utf8');
  const baseHome = setMeta(applySiteNav(renderHomeContent(source, home, published), published), home, siteUrl, brand);
  await fs.writeFile(path.join(PUBLIC, 'index.html'), baseHome);
  await fs.mkdir(path.join(PUBLIC, 'admin'), { recursive: true });
  const admin = await fs.readFile(path.join(SRC, 'admin.html'), 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'admin', 'index.html'), admin);
  await fs.mkdir(path.join(PUBLIC, 'content'), { recursive: true });
  await fs.writeFile(path.join(PUBLIC, 'content', 'pages.json'), JSON.stringify({ siteUrl, brand, pages: published.map(p => ({ id:p.id,type:p.type,title:p.title,slug:p.slug,status:p.status,noindex:p.noindex,metaTitle:p.metaTitle,metaDescription:p.metaDescription,focusKeyword:p.focusKeyword,heading:p.heading,intro:p.intro })) }, null, 2));

  const generatedSlugs = [];
  const visibleNav = published.filter(p => p.type !== 'home').slice(0, 6);
  const navLinks = [`<a href="/">Home</a>`, ...visibleNav.map(p => `<a href="/${esc(p.slug)}/">${esc(p.title)}</a>`)].join('');
  for (const page of published.filter(p => p.type !== 'home')) {
    const targetDir = path.join(PUBLIC, page.slug);
    await fs.mkdir(targetDir, { recursive: true });
    let html;
    if (page.type === 'serp' || page.type === 'keyword') html = toolHtml(source, page, siteUrl, brand, published);
    else html = contentPageHtml(template, page, siteUrl, brand, navLinks);
    await fs.writeFile(path.join(targetDir, 'index.html'), html);
    generatedSlugs.push(page.slug);
  }
  await fs.writeFile(markerPath, JSON.stringify(generatedSlugs));

  const redirectLines = [];
  for (const page of published.filter(p => p.type !== 'home')) {
    for (const oldSlug of (page.redirectFrom || [])) {
      if (validSlug(oldSlug) && oldSlug !== page.slug) redirectLines.push(`/${oldSlug}  /${page.slug}/  301!`, `/${oldSlug}/  /${page.slug}/  301!`);
    }
  }
  redirectLines.push('/admin  /admin/  301');
  await fs.writeFile(path.join(PUBLIC, '_redirects'), redirectLines.join('\n') + '\n');
  const sitemapPages = published.filter(p => !p.noindex).map(p => ({ loc: p.canonicalUrl || (p.type === 'home' ? `${siteUrl}/` : `${siteUrl}/${p.slug}/`), lastmod: new Date().toISOString().slice(0, 10) }));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages.map(p => `  <url><loc>${esc(p.loc)}</loc><lastmod>${p.lastmod}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  await fs.writeFile(path.join(PUBLIC, 'sitemap.xml'), sitemap);
  await fs.writeFile(path.join(PUBLIC, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${siteUrl}/sitemap.xml\n`);
  const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Page not found | ${esc(brand)}</title><style>body{font-family:system-ui;max-width:720px;margin:12vh auto;padding:24px;color:#0b1f33}a{color:#059669;font-weight:700}</style></head><body><h1>Page not found</h1><p>This page may have moved or is not published.</p><a href="/">Return to Rankwise</a></body></html>`;
  await fs.writeFile(path.join(PUBLIC, '404.html'), notFound);
  console.log(`Rankwise CMS build complete: ${published.length} published pages, ${generatedSlugs.length} generated URLs.`);
}
main().catch(err => { console.error(err); process.exit(1); });
