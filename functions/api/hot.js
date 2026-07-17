// functions/api/hot.js
// GET /api/hot
//
// Returns up to 20 tracks sorted by net rating (up - down) descending.
// Reads all `rating:*` keys from KV, then cross-references the channel
// catalogue (also in KV, falling back to nothing) to get track metadata.
//
// Response shape:
// {
//   tracks: [
//     { videoId, title, channelId, channelName, up, down, net },
//     ...
//   ]
// }
//
// The client merges this into the Hot Right Now channel on boot.

import { jsonResponse, errorResponse } from './_lib/auth.js';

const HOT_LIMIT = 20;
const CHANNELS_KEY = 'channels:v1';

export async function onRequestGet({ env }) {
  try {
    // 1. Load all rating keys from KV
    const listed = await env.WAVEFM_KV.list({ prefix: 'rating:' });
    if (!listed.keys.length) {
      return jsonResponse({ tracks: [] });
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
      .filter(r => r.net > 0 || r.up > 0) // only tracks with at least one up vote
      .sort((a, b) => b.net - a.net || b.up - a.up)
      .slice(0, HOT_LIMIT);

    if (!top.length) {
      return jsonResponse({ tracks: [] });
    }

    // 4. Load channel catalogue to enrich with title + channel info
    const chRaw = await env.WAVEFM_KV.get(CHANNELS_KEY);
    const channels = chRaw ? JSON.parse(chRaw).channels ?? [] : [];

    // Build a fast lookup: videoId → { title, dur, channelId, channelName }
    const lookup = {};
    for (const ch of channels) {
      for (const v of ch.videos ?? []) {
        lookup[v.id] = {
          title: v.title,
          dur: v.dur ?? 240,
          channelId: ch.id,
          channelName: ch.name,
        };
      }
    }

    // 5. Enrich and return
    const tracks = top.map(r => ({
      videoId: r.videoId,
      title: lookup[r.videoId]?.title ?? r.videoId,
      dur: lookup[r.videoId]?.dur ?? 240,
      channelId: lookup[r.videoId]?.channelId ?? null,
      channelName: lookup[r.videoId]?.channelName ?? 'Unknown',
      up: r.up,
      down: r.down,
      net: r.net,
    }));

    return jsonResponse({ tracks });
  } catch (e) {
    return errorResponse('Failed to load hot tracks', 500);
  }
}
