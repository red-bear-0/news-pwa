// GET /api/news — returns the latest cached digest from KV.
// Frontend reads this on every load.
import { kv, KEYS } from '../lib/kv.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    const r = kv();
    const data = await r.get(KEYS.digest);
    if (!data) {
      return res.status(200).json({
        lastUpdated: null,
        categories: [],
        message: '아직 첫 갱신이 실행되지 않았습니다. /api/refresh 를 한 번 호출해주세요.',
      });
    }
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=600');
    return res.status(200).json(typeof data === 'string' ? JSON.parse(data) : data);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
