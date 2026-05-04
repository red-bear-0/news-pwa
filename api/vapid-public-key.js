// GET /api/vapid-public-key — exposes the public VAPID key to the frontend
// so the browser can subscribe with the right applicationServerKey.
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const key = process.env.VAPID_PUBLIC_KEY || '';
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json({ key });
}
