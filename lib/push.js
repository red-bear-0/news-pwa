// Web Push helper — sends to all stored subscriptions, prunes dead ones.
import webpush from 'web-push';
import { kv, KEYS } from './kv.js';

let _configured = false;
function configure() {
  if (_configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  _configured = true;
}

export async function getAllSubs() {
  const r = kv();
  const raw = (await r.lrange(KEYS.subs, 0, -1)) || [];
  // upstash returns parsed objects when values look like JSON
  return raw.map(s => (typeof s === 'string' ? JSON.parse(s) : s));
}

export async function addSub(sub) {
  const r = kv();
  // Avoid duplicates by endpoint
  const all = await getAllSubs();
  if (all.some(s => s.endpoint === sub.endpoint)) return false;
  await r.rpush(KEYS.subs, JSON.stringify(sub));
  return true;
}

export async function replaceSubs(subs) {
  const r = kv();
  await r.del(KEYS.subs);
  if (subs.length) {
    await r.rpush(KEYS.subs, ...subs.map(s => JSON.stringify(s)));
  }
}

export async function broadcast(payload) {
  configure();
  const subs = await getAllSubs();
  const data = JSON.stringify(payload);
  const survivors = [];
  let sent = 0, failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, data);
      survivors.push(sub);
      sent++;
    } catch (err) {
      failed++;
      // 410/404 = subscription gone — drop it
      if (err.statusCode === 410 || err.statusCode === 404) {
        continue;
      }
      // Keep on transient errors
      survivors.push(sub);
    }
  }
  await replaceSubs(survivors);
  return { sent, failed, total: subs.length };
}
