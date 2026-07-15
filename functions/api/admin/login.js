import { jsonResponse, errorResponse } from '../_lib/auth.js';

// POST /api/admin/login  { passphrase }
// Just validates the passphrase against the ADMIN_PASSPHRASE env var/secret.
// The admin UI then re-sends the same passphrase as the X-Admin-Key header
// on every write request — nothing is stored server-side, so there's no
// session table to manage.
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return errorResponse('Invalid JSON body.'); }

  if (!env.ADMIN_PASSPHRASE) {
    return errorResponse('Server not configured: set the ADMIN_PASSPHRASE environment variable.', 500);
  }

  const passphrase = (body && body.passphrase) || '';
  if (passphrase !== env.ADMIN_PASSPHRASE) {
    return errorResponse('Incorrect passphrase.', 401);
  }

  return jsonResponse({ ok: true });
}
