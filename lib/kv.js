// Thin wrapper around Upstash Redis.
//
// We accept two env var conventions because Vercel re-organised its Storage UI:
//   - Old "Vercel KV"        → KV_REST_API_URL / KV_REST_API_TOKEN
//   - New "Upstash" marketplace → UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// Either set (or even mixing one of each) works.
import { Redis } from '@upstash/redis';

let _client = null;
export function kv() {
  if (_client) return _client;
  const url   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Missing KV credentials. Set KV_REST_API_URL/KV_REST_API_TOKEN ' +
      'or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN in env.'
    );
  }
  _client = new Redis({ url, token });
  return _client;
}

export const KEYS = {
  digest: 'digest:latest',
  subs: 'push:subs',
};
