// POST /api/refresh — re-collect, summarize, cache, and push.
// Called by Vercel Cron (with Authorization: Bearer ${CRON_SECRET}) at 22:00 UTC daily
// (= 07:00 KST). Also invocable manually with the same secret.
import { kv, KEYS } from '../lib/kv.js';
import { fetchCategoryItems, CATEGORIES } from '../lib/rss.js';
import { summarizeCategory } from '../lib/summarize.js';
import { broadcast } from '../lib/push.js';

export const config = { runtime: 'nodejs', maxDuration: 60 };

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // dev convenience; set CRON_SECRET in prod
  const got = req.headers.authorization || '';
  return got === `Bearer ${secret}`;
}

function todayLocalKST() {
  // Render today's date in KST regardless of server tz
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const date = todayLocalKST();
    const categoriesOut = [];
    let totalItems = 0;

    for (const cat of CATEGORIES) {
      try {
        const raw = await fetchCategoryItems(cat.id, 12);
        if (!raw.length) {
          categoriesOut.push({ ...cat, items: [] });
          continue;
        }
        const items = await summarizeCategory(cat.title, raw);
        categoriesOut.push({ ...cat, items });
        totalItems += items.length;
      } catch (err) {
        console.error(`Category ${cat.id} failed:`, err);
        categoriesOut.push({ ...cat, items: [], error: err.message });
      }
    }

    const digest = {
      lastUpdated: date,
      generatedAt: new Date().toISOString(),
      categories: categoriesOut,
    };

    await kv().set(KEYS.digest, JSON.stringify(digest));

    // Send push notification (best-effort)
    let pushResult = null;
    try {
      pushResult = await broadcast({
        title: '📰 매일 기술 뉴스',
        body: `${date} 다이제스트 도착 — 총 ${totalItems}건`,
        url: '/',
        tag: 'daily-digest',
      });
    } catch (err) {
      console.error('Push broadcast failed:', err);
      pushResult = { error: err.message };
    }

    return res.status(200).json({
      ok: true,
      date,
      totalItems,
      push: pushResult,
      categories: categoriesOut.map(c => ({ id: c.id, count: c.items.length })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
