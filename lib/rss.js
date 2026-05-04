// Fetch & parse Google News RSS for each category.
// Default to Korean Google News (hl=ko, gl=KR) so headlines come back in Korean.
import { XMLParser } from 'fast-xml-parser';

const UA =
  'Mozilla/5.0 (compatible; DailyTechNewsBot/1.0; +https://example.com/bot)';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

// Korean queries → Korean-language Google News results.
const QUERIES = {
  dev: [
    '소프트웨어 개발 트렌드',
    '개발자 도구 DevOps',
    '프로그래밍 뉴스',
  ],
  ai: [
    'AI 인공지능 뉴스',
    'LLM 거대언어모델',
    '생성형 AI',
  ],
  auto: [
    '전기차 자율주행',
    '로보택시',
    '전기차 배터리',
  ],
};

export const CATEGORIES = [
  { id: 'dev',  title: '개발 기술 트렌드', desc: '프로그래밍·DevOps·아키텍처' },
  { id: 'ai',   title: 'AI 뉴스',          desc: '거대모델·연구·산업 적용' },
  { id: 'auto', title: '전기차 · 자율주행', desc: 'EV·로보택시·자율주행' },
];

function feedUrl(query, lang = 'ko', country = 'KR') {
  const q = encodeURIComponent(query + ' when:7d');
  return `https://news.google.com/rss/search?q=${q}&hl=${lang}&gl=${country}&ceid=${country}:${lang}`;
}

async function fetchOne(url) {
  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml' },
  });
  if (!resp.ok) throw new Error(`RSS ${resp.status} for ${url}`);
  const xml = await resp.text();
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  return Array.isArray(items) ? items : [items];
}

function cleanDescription(html) {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSource(item) {
  const s = item?.source;
  if (!s) return '';
  if (typeof s === 'string') return s;
  if (typeof s === 'object') return s['#text'] || s['@_url'] || '';
  return '';
}

export async function fetchCategoryItems(catId, limit = 20) {
  const queries = QUERIES[catId];
  if (!queries) throw new Error(`Unknown category ${catId}`);
  const urls = queries.map(q => feedUrl(q, 'ko', 'KR'));
  const all = [];
  for (const u of urls) {
    try {
      const items = await fetchOne(u);
      for (const it of items) {
        all.push({
          headline_raw: it.title || '',
          description: cleanDescription(it.description || ''),
          link: it.link || '',
          source: extractSource(it),
          pubDate: it.pubDate || '',
        });
      }
    } catch (err) {
      console.error('RSS fetch failed:', u, err.message);
    }
  }
  // Dedupe by link
  const seen = new Set();
  const out = [];
  for (const it of all) {
    if (!it.link || seen.has(it.link)) continue;
    seen.add(it.link);
    out.push(it);
  }
  out.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return out.slice(0, limit);
}
