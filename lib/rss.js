// Multi-source RSS aggregator.
// For each category we pull from:
//   1. Korean Google News (hl=ko, gl=KR) with SPECIFIC tech keywords (proper nouns)
//   2. English Google News (hl=en-US, gl=US)
//   3. Direct international RSS feeds (TechCrunch / MIT Tech Review / InsideEVs etc.)
// Then we dedupe and merge.
import { XMLParser } from 'fast-xml-parser';

const UA =
  'Mozilla/5.0 (compatible; DailyTechNewsBot/1.0; +https://example.com/bot)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// IMPORTANT for Korean queries: use specific proper nouns / English terms.
// Generic Korean words like "개발" or "프로그램" match unrelated local news
// (e.g., "결혼이민자 취업지원 프로그램"). Tech proper nouns are far cleaner.
const SOURCES = {
  dev: {
    queriesKo: [
      '깃허브 GitHub',
      '쿠버네티스 도커',
      '오픈소스 프로그래밍 언어',
    ],
    queriesEn: [
      'software engineering trends',
      'AI coding agents developer',
      'developer productivity tooling',
      'open source release',
    ],
    feeds: [
      'https://techcrunch.com/category/startups/feed/',
      'https://hnrss.org/frontpage?points=300',
    ],
  },
  ai: {
    queriesKo: [
      'OpenAI ChatGPT',
      'Anthropic Claude',
      '생성형 AI 거대언어모델',
    ],
    queriesEn: [
      'AI artificial intelligence news',
      'OpenAI Anthropic Google DeepMind',
      'LLM model release',
    ],
    feeds: [
      'https://www.technologyreview.com/feed/',
      'https://venturebeat.com/category/ai/feed/',
    ],
  },
  auto: {
    queriesKo: [
      '테슬라 전기차',
      '현대차 기아 EV',
      '자율주행 로보택시',
    ],
    queriesEn: [
      'electric vehicle news',
      'robotaxi self driving',
      'EV battery technology',
    ],
    feeds: [
      'https://insideevs.com/rss/',
      'https://electrek.co/feed/',
    ],
  },
};

export const CATEGORIES = [
  { id: 'dev',  title: '개발 기술 트렌드', desc: '글로벌 + 국내 소프트웨어/DevOps 흐름' },
  { id: 'ai',   title: 'AI 뉴스',          desc: '거대모델·연구·산업 적용 (국내+해외)' },
  { id: 'auto', title: '전기차 · 자율주행', desc: 'EV·로보택시·자율주행 (글로벌 우선)' },
];

const PER_CATEGORY_LIMIT = 30;

function gnewsUrl(query, lang, country) {
  const q = encodeURIComponent(query + ' when:7d');
  return `https://news.google.com/rss/search?q=${q}&hl=${lang}&gl=${country}&ceid=${country}:${lang.split('-')[0]}`;
}

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

async function pullAll(urls) {
  const out = [];
  await Promise.all(urls.map(async (u) => {
    try {
      const items = await fetchOne(u);
      for (const it of items) {
        out.push({
          headline_raw: extractTitle(it),
          description: cleanDescription(extractDescription(it)),
          link: extractLink(it),
          source: extractSource(it),
          pubDate: extractDate(it),
        });
      }
    } catch (err) {
      console.error('RSS fetch failed:', u, err.message);
    }
  }));
  return out;
}

export async function fetchCategoryItems(catId, limit = PER_CATEGORY_LIMIT) {
  const cfg = SOURCES[catId];
  if (!cfg) throw new Error(`Unknown category ${catId}`);

  const koUrls = (cfg.queriesKo || []).map(q => gnewsUrl(q, 'ko', 'KR'));
  const enUrls = (cfg.queriesEn || []).map(q => gnewsUrl(q, 'en-US', 'US'));
  const feedUrls = cfg.feeds || [];

  const [feeds, en, ko] = await Promise.all([
    pullAll(feedUrls),
    pullAll(enUrls),
    pullAll(koUrls),
  ]);

  // Direct feeds first (richer descriptions), then English Google News, then Korean.
  const all = [...feeds, ...en, ...ko];

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

  out.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
  return out.slice(0, limit);
}
