// functions/api/ratings/[id].js
// GET  /api/ratings/:videoId  — fetch { up, down, net } for a track
// POST /api/ratings/:videoId  — cast a vote { vote: 'up' | 'down' }
//
// KV key: rating:{videoId}  →  JSON { up: Number, down: Number }
// One vote per device is enforced client-side (localStorage). The backend
// trusts the client on this — no server-side dedup at this scale.

import { jsonResponse, errorResponse } from '../_lib/auth.js';

const key = id => `rating:${id}`;

export async function onRequestGet({ params, env }) {
  try {
    const raw = await env.WAVEFM_KV.get(key(params.id));
    const data = raw ? JSON.parse(raw) : { up: 0, down: 0 };
    return jsonResponse({ ...data, net: data.up - data.down });
  } catch (e) {
    return errorResponse('Failed to fetch rating', 500);
  }
}

export async function onRequestPost({ params, env, request }) {
  try {
    const { vote } = await request.json();
    if (vote !== 'up' && vote !== 'down') {
      return errorResponse('vote must be "up" or "down"', 400);
    }

    const raw = await env.WAVEFM_KV.get(key(params.id));
    const data = raw ? JSON.parse(raw) : { up: 0, down: 0 };
    data[vote] = (data[vote] || 0) + 1;

    await env.WAVEFM_KV.put(key(params.id), JSON.stringify(data));
    return jsonResponse({ ...data, net: data.up - data.down });
  } catch (e) {
    return errorResponse('Failed to save rating', 500);
  }
}
