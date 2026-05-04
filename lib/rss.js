// Multi-source RSS aggregator — primary-source-first.
//
// Architecture:
//   dev: 100% direct sources (no Google News). Per-technology feeds:
//        GitHub releases + Reddit + dev.to tag.
//   ai:  Direct primary sources (MIT/VentureBeat/Hugging Face) + small
//        Korean Google News window for domestic coverage.
//   auto: Direct primary sources (InsideEVs/Electrek/Verge) + small Korean
//        Google News window for domestic coverage.
//
// Each fetched item is tagged with the originating technology / source bucket
// so the frontend can render a small badge.
import { XMLParser } from 'fast-xml-parser';

const UA =
  'Mozilla/5.0 (compatible; DailyTechNewsBot/1.0; +https://example.com/bot)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Source spec resolvers ------------------------------------------------------
function gh(repo)      { return `https://github.com/${repo}/releases.atom`; }
function reddit(sub)   { return `https://www.reddit.com/r/${sub}/.rss`; }
function devto(tag)    { return `https://dev.to/feed/tag/${tag}`; }
function gnews(query, lang = 'ko', country = 'KR') {
  const q = encodeURIComponent(query + ' when:7d');
  return `https://news.google.com/rss/search?q=${q}&hl=${lang}&gl=${country}&ceid=${country}:${lang.split('-')[0]}`;
}

// ---------------------------------------------------------------------------
// SOURCES — change this to add/remove feeds. Each entry produces one fetch.
// `tech` is shown as a badge on the frontend.
// ---------------------------------------------------------------------------
const SOURCES = {
  dev: [
    // React
    { tech: 'React',       url: gh('facebook/react') },
    { tech: 'React',       url: reddit('reactjs') },
    { tech: 'React',       url: devto('react') },
    // Next.js
    { tech: 'Next.js',     url: gh('vercel/next.js') },
    { tech: 'Next.js',     url: reddit('nextjs') },
    { tech: 'Next.js',     url: devto('nextjs') },
    // Vue.js
    { tech: 'Vue.js',      url: gh('vuejs/core') },
    { tech: 'Vue.js',      url: reddit('vuejs') },
    { tech: 'Vue.js',      url: devto('vue') },
    // Tailwind
    { tech: 'Tailwind',    url: gh('tailwindlabs/tailwindcss') },
    { tech: 'Tailwind',    url: devto('tailwindcss') },
    // Spring Boot
    { tech: 'Spring Boot', url: gh('spring-projects/spring-boot') },
    { tech: 'Spring Boot', url: 'https://spring.io/blog.atom' },
    { tech: 'Spring Boot', url: devto('springboot') },
  ],
  ai: [
    { tech: 'MIT TR',      url: 'https://www.technologyreview.com/topic/artificial-intelligence/feed' },
    { tech: 'VentureBeat', url: 'https://venturebeat.com/category/ai/feed/' },
    { tech: 'Hugging Face',url: 'https://huggingface.co/blog/feed.xml' },
    { tech: 'OpenAI',      url: devto('openai') },
    // Light Korean Google News for domestic AI coverage
    { tech: '국내',         url: gnews('OpenAI ChatGPT 한국') },
    { tech: '국내',         url: gnews('AI 인공지능 발표') },
  ],
  auto: [
    { tech: 'InsideEVs',   url: 'https://insideevs.com/rss/' },
    { tech: 'Electrek',    url: 'https://electrek.co/feed/' },
    { tech: 'The Verge',   url: 'https://www.theverge.com/rss/transportation/index.xml' },
    // Light Korean Google News for domestic auto coverage
    { tech: '국내',         url: gnews('현대차 기아 EV') },
    { tech: '국내',         url: gnews('테슬라 자율주행') },
  ],
};

export const CATEGORIES = [
  { id: 'dev',  title: '개발 기술 트렌드', desc: 'React · Next.js · Vue · Tailwind · Spring Boot' },
  { id: 'ai',   title: 'AI 뉴스',          desc: '글로벌 1차 출처 + 국내 보도' },
  { id: 'auto', title: '전기차 · 자율주행', desc: 'EV·로보택시·자율주행 (글로벌+국내)' },
];

const PER_CATEGORY_LIMIT = 30;
const PER_FEED_LIMIT = 8;       // pull up to 8 newest items per feed

// XML helpers ----------------------------------------------------------------
async function fetchOne(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    redirect: 'follow',
  });
  if (!resp.ok) throw new Error(`RSS ${resp.status} for ${url}`);
  const xml = await resp.text();
  const parsed = parser.parse(xml);
  const items =
    parsed?.rss?.channel?.item
    ?? parsed?.feed?.entry
    ?? [];
  return Array.isArray(items) ? items : [items];
}

function cleanDescription(html) {
  if (!html) return '';
  let s = String(html).replace(/<[^>]+>/g, ' ');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/View Full Coverage on Google News.*$/i, '').trim();
  s = s.replace(/Continue reading on .*$/i, '').trim();
  return s;
}

function extractSource(item) {
  const s = item?.source;
  if (s) {
    if (typeof s === 'string') return s;
    if (typeof s === 'object') return s['#text'] || s['@_url'] || '';
  }
  if (item?.author?.name) return item.author.name;
  if (item?.['dc:creator']) return String(item['dc:creator']);
  return '';
}

function extractLink(item) {
  if (typeof item?.link === 'string') return item.link;
  if (Array.isArray(item?.link)) {
    const html = item.link.find(l => l['@_rel'] === 'alternate' || !l['@_rel']);
    return html?.['@_href'] || html?.['#text'] || '';
  }
  if (item?.link?.['@_href']) return item.link['@_href'];
  if (item?.link?.['#text']) return item.link['#text'];
  return item?.guid || '';
}

function extractTitle(item) {
  if (typeof item?.title === 'string') return item.title;
  if (item?.title?.['#text']) return item.title['#text'];
  return '';
}

function extractDescription(item) {
  return item?.description
    || item?.summary?.['#text']
    || item?.summary
    || item?.['content:encoded']
    || item?.content?.['#text']
    || item?.content
    || '';
}

function extractDate(item) {
  return item?.pubDate || item?.published || item?.updated || '';
}

// ---------------------------------------------------------------------------
async function pullSource(spec) {
  try {
    const items = await fetchOne(spec.url);
    return items.slice(0, PER_FEED_LIMIT).map(it => ({
      tech: spec.tech,
      headline_raw: extractTitle(it),
      description: cleanDescription(extractDescription(it)),
      link: extractLink(it),
      source: extractSource(it) || spec.tech,
      pubDate: extractDate(it),
    }));
  } catch (err) {
    console.error('feed failed:', spec.url, err.message);
    return [];
  }
}

export async function fetchCategoryItems(catId, limit = PER_CATEGORY_LIMIT) {
  const specs = SOURCES[catId];
  if (!specs) throw new Error(`Unknown category ${catId}`);

  const lists = await Promise.all(specs.map(pullSource));
  const all = lists.flat();

  const canon = (u) => {
    try {
      const x = new URL(u);
      x.search = '';
      x.hash = '';
      return x.origin + x.pathname;
    } catch (_) { return u; }
  };
  const seenLink = new Set();
  const seenTitle = new Set();
  const out = [];
  for (const it of all) {
    if (!it.link || !it.headline_raw) continue;
    const ck = canon(it.link);
    if (seenLink.has(ck)) continue;
    seenLink.add(ck);

    const tk = it.headline_raw.toLowerCase().replace(/\s+/g, ' ').slice(0, 60);
    if (seenTitle.has(tk)) continue;
    seenTitle.add(tk);

    out.push(it);
  }

  // Sort newest first
  out.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return out.slice(0, limit);
}
