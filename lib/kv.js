// Thin wrapper around Upstash Redis (which Vercel KV uses under the hood).
// Reads KV_REST_API_URL / KV_REST_API_TOKEN injected by `vercel env pull` or
// auto-set when you connect the Vercel KV add-on.
import { Redis } from '@upstash/redis';

let _client = null;
export function kv() {
  if (_client) return _client;
  _client = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
  return _client;
}

export const KEYS = {
  digest: 'digest:latest',
  subs: 'push:subs',
};
