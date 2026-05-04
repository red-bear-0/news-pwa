// LLM-free curator. Cleans + dedupes RSS items into the same shape the
// frontend expects: { headline, summary, source, url }.
//
// - Strips publisher suffix from titles
// - Drops summary if it's just a duplicate of the headline (Google News quirk)
// - Returns up to 10 items per category

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

// True if the description is essentially the same string as the headline
// (common in Korean Google News RSS where description == title + source).
function summaryIsRedundant(headline, description) {
  if (!description) return true;
  const h = normaliseKey(headline);
  const d = normaliseKey(description);
  if (!h || !d) return true;
  // exact-or-prefix match (description starts with the headline)
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
    const summary = summaryIsRedundant(headline, rawSum) ? '' : truncate(rawSum, 200);

    out.push({
      headline: truncate(headline, 110),
      summary,
      source: it.source || '',
      url: it.link,
    });
    if (out.length >= MAX_ITEMS) break;
  }
  return out;
}
