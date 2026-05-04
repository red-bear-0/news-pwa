// POST /api/subscribe — saves a Web Push subscription so /api/refresh can push to it.
// Body: PushSubscription JSON (from sw register/subscribe in the browser).
import { addSub } from '../lib/push.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const body = req.body && typeof req.body === 'object'
      ? req.body
      : JSON.parse(req.body || '{}');
    if (!body || !body.endpoint || !body.keys) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    const added = await addSub(body);
    return res.status(200).json({ ok: true, added });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
