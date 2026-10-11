import crypto from 'node:crypto';

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function sign(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

export default async function handler(request) {
  if (request.method !== 'POST') return reply({ code: 'METHOD_NOT_ALLOWED', error: 'Use POST to sign in.' }, 405);
  const adminPassword = process.env.ADMIN_PASSWORD;
  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!adminPassword || adminPassword.length < 12 || !sessionSecret || sessionSecret.length < 32) {
    return reply({ code: 'ADMIN_SETUP_REQUIRED', error: 'Admin is not configured yet. Add ADMIN_PASSWORD (12+ characters) and ADMIN_SESSION_SECRET (32+ random characters) in Netlify environment variables.' }, 503);
  }
  let body;
  try { body = await request.json(); } catch { return reply({ code: 'INVALID_JSON', error: 'Request body must be valid JSON.' }, 400); }
  const pass = String(body?.password || '');
  if (!pass || !safeEqual(pass, adminPassword)) {
    await new Promise(resolve => setTimeout(resolve, 450));
    return reply({ code: 'INVALID_CREDENTIALS', error: 'Admin password is incorrect.' }, 401);
  }
  const payload = Buffer.from(JSON.stringify({ sub: 'rankwise-admin', exp: Date.now() + 4 * 60 * 60 * 1000 }), 'utf8').toString('base64url');
  const token = `${payload}.${sign(payload, sessionSecret)}`;
  return reply({ token, expiresInSeconds: 14400 });
}
