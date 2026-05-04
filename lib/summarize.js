// LLM-free curator. Cleans + dedupes RSS items into the same shape the
// frontend expects: { headline, summary, source, url }.
//
// Why no LLM here:
//   - Keeps the project 100% free (no API key, no monthly cost).
//   - RSS descriptions are usually 1–3 sentences already, which is the
//     same length budget the original spec asked for.
//
// To re-introduce a Claude/Gemini summary later, replace `curateCategory`
// with an LLM-backed version that returns the same array shape.

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

export async function summarizeCategory(catTitle, items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const headline = cleanTitle(it.headline_raw);
    if (!headline) continue;
    const k = normaliseKey(headline);
    if (seen.has(k)) continue;
    seen.add(k);

    const summary = truncate(it.description || '', 180) || '(요약 없음)';
    out.push({
      headline: truncate(headline, 100),
      summary,
      source: it.source || '',
      url: it.link,
    });
    if (out.length >= 7) break;
  }
  return out;
}
