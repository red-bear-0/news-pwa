// LLM-free curator. Cleans + dedupes RSS items into the shape the
// frontend expects: { tech, headline, summary, source, url, pubDate }.

const STOP_SUFFIXES = [
  / - [^-]+$/,        // " - SomePublisher" Google News suffix
  / \| [^|]+$/,       // " | Somewhere"
];

function cleanTitle(t) {
  if (!t) return '';
  let s = String(t).trim();
  for (const re of STOP_SUFFIXES) {
    if (re.test(s)) s = s.replace(re, '').trim();
  }
  return s;
}

function truncate(s, max) {
  if (!s) return '';
  s = s.trim();
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trim() + '…';
}

function normaliseKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\p{P}]+/gu, '')
    .slice(0, 80);
}

function summaryIsRedundant(headline, description) {
  if (!description) return true;
  const h = normaliseKey(headline);
  const d = normaliseKey(description);
  if (!h || !d) return true;
  if (d === h) return true;
  if (d.startsWith(h)) return true;
  if (h.startsWith(d)) return true;
  return false;
}

const MAX_ITEMS = 10;

export async function summarizeCategory(catTitle, items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const headline = cleanTitle(it.headline_raw);
    if (!headline) continue;
    const k = normaliseKey(headline);
    if (seen.has(k)) continue;
    seen.add(k);

    const rawSum = it.description || '';
    const summary = summaryIsRedundant(headline, rawSum) ? '' : truncate(rawSum, 220);

    out.push({
      tech: it.tech || '',
      headline: truncate(headline, 110),
      summary,
      source: it.source || it.tech || '',
      url: it.link,
      pubDate: it.pubDate || '',
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
