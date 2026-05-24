/**
 * Pages Function: /house-prep/api/state
 *
 *   GET  → returns the JSON blob (or "{}" if empty)
 *   PUT  → overwrites the blob (body must be valid JSON, <100 KB)
 *
 * Bind a KV namespace named HOUSE_PREP_KV to this Pages project:
 *   Pages → Settings → Functions → KV namespace bindings → add HOUSE_PREP_KV
 */

const KEY = 'state';
const MAX_BYTES = 100_000;
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };

export async function onRequestGet({ env }) {
  const raw = await env.HOUSE_PREP_KV.get(KEY);
  return new Response(raw || '{}', { headers: JSON_HEADERS });
}

export async function onRequestPut({ request, env }) {
  const body = await request.text();
  if (body.length > MAX_BYTES) {
    return new Response('Payload too large', { status: 413 });
  }
  try { JSON.parse(body); }
  catch { return new Response('Invalid JSON', { status: 400 }); }

  await env.HOUSE_PREP_KV.put(KEY, body);
  return new Response('{"ok":true}', { headers: JSON_HEADERS });
}
