// Generates a fresh VAPID keypair for Web Push.
// Usage: npm run vapid
// Then copy the printed values into your .env / Vercel env vars.
import webpush from 'web-push';

const keys = webpush.generateVAPIDKeys();
console.log('');
console.log('VAPID_PUBLIC_KEY=' + keys.publicKey);
console.log('VAPID_PRIVATE_KEY=' + keys.privateKey);
console.log('VAPID_SUBJECT=mailto:you@example.com');
console.log('');
console.log('Add these to .env (local) and Vercel env vars (Production + Preview).');
