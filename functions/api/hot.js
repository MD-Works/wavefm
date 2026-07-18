// functions/api/hot.js
// GET /api/hot
//
// Returns up to 20 tracks sorted by net rating (up - down) descending.
// Edge-cached for 10 minutes — matches the client-side localStorage TTL.
// No cache purge needed on new votes (eventual freshness is fine for rankings).

import { jsonResponse, errorResponse } from './_lib/auth.js';

const HOT_LIMIT   = 20;
const CHANNELS_KEY = 'channels';
const HOT_CACHE    = 'public, s-maxage=600, stale-while-revalidate=60';

export async function onRequestGet({ env }) {
  try {
    // 1. Load all rating keys from KV
    const listed = await env.WAVEFM_KV.list({ prefix: 'rating:' });
    if (!listed.keys.length) {
      return jsonResponse({ tracks: [] }, 200, { 'Cache-Control': HOT_CACHE });
    }

    // 2. Fetch all rating values in parallel
    const ratings = await Promise.all(
      listed.keys.map(async ({ name }) => {
        const videoId = name.replace('rating:', '');
        const raw = await env.WAVEFM_KV.get(name);
        const data = raw ? JSON.parse(raw) : { up: 0, down: 0 };
        return { videoId, up: data.up || 0, down: data.down || 0, net: (data.up || 0) - (data.down || 0) };
      })
    );

    // 3. Sort by net score descending, take top HOT_LIMIT
    const top = ratings
      .filter(r => r.net > 0 || r.up > 0)
      .sort((a, b) => b.net - a.net || b.up - a.up)
      .slice(0, HOT_LIMIT);

    if (!top.length) {
      return jsonResponse({ tracks: [] }, 200, { 'Cache-Control': HOT_CACHE });
    }

    // 4. Enrich with track metadata from channel catalogue
    const chRaw    = await env.WAVEFM_KV.get(CHANNELS_KEY);
    const channels = chRaw ? JSON.parse(chRaw).channels ?? [] : [];

    const lookup = {};
    for (const ch of channels) {
      for (const v of ch.videos ?? []) {
        lookup[v.id] = { title: v.title, dur: v.dur ?? 240, channelId: ch.id, channelName: ch.name };
      }
    }

    const tracks = top.map(r => ({
      videoId:     r.videoId,
      title:       lookup[r.videoId]?.title       ?? r.videoId,
      dur:         lookup[r.videoId]?.dur         ?? 240,
      channelId:   lookup[r.videoId]?.channelId   ?? null,
      channelName: lookup[r.videoId]?.channelName ?? 'Unknown',
      up:  r.up,
      down: r.down,
      net: r.net,
    }));

    return jsonResponse({ tracks }, 200, { 'Cache-Control': HOT_CACHE });
  } catch (e) {
    return errorResponse('Failed to load hot tracks', 500);
  }
}
