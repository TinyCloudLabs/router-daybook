'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Router client.
//
// Two jobs, both against the shape-rotator cohort instance (from ~/.routerrc):
//   • fetchFeed() — READ recent cohort entries, so the reflection can find
//     real collaboration overlaps. Read-only.
//   • post()      — the ONLY write, and only when the user approves. Entries
//     land in staging first (deletable window before they go public).
// ─────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const os = require('os');
const path = require('path');

// The cohort venue. ~/.routerrc already points here; this is the fallback.
const DEFAULT_SERVER = 'https://shaperotator.teleport.computer';
const RC_PATH = path.join(os.homedir(), '.routerrc');

// Read the identity key (and server) from ~/.routerrc. The cohort feed is the
// venue, so we honor the rc's `server` rather than overriding it.
function loadConfig() {
  let raw;
  try {
    raw = fs.readFileSync(RC_PATH, 'utf8');
  } catch {
    throw new Error('No ~/.routerrc found. Add {"key":"<your router key>"}.');
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('~/.routerrc is not valid JSON.');
  }
  const key = parsed.key || parsed.secret_key;
  if (!key) throw new Error('~/.routerrc has no "key".');
  const server = (process.env.ROUTER_SERVER || parsed.server || DEFAULT_SERVER).replace(/\/$/, '');
  return { key, server };
}

// Resolve who the key belongs to on this server (like `router whoami`).
// Returns { handle, pseudonym } or null if the endpoint isn't available.
async function whoami() {
  const { key, server } = loadConfig();
  try {
    const res = await fetch(`${server}/api/me?key=${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const d = await res.json();
    return { handle: d.handle || null, pseudonym: d.pseudonym || null, teamId: d.teamId || null };
  } catch {
    return null;
  }
}

function shortDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

// Read recent cohort entries for collaboration matching. Returns a compact
// list scoped to the last `days` days, excluding the user's own posts.
async function fetchFeed({ days = 14, limit = 60 } = {}) {
  const { key, server } = loadConfig();
  let res;
  try {
    res = await fetch(`${server}/api/entries?key=${encodeURIComponent(key)}&limit=${limit}`);
  } catch (e) {
    return { ok: false, error: 'Could not reach the cohort feed: ' + e.message, entries: [] };
  }
  const text = await res.text();
  if (!res.ok) {
    return { ok: false, error: `Feed returned ${res.status}`, entries: [] };
  }
  let body = {};
  try { body = JSON.parse(text); } catch { return { ok: false, error: 'Bad feed JSON', entries: [] }; }

  // Resolve identity so we can exclude the user's own posts (you don't
  // collaborate with yourself — @specularist is James here).
  const me = await whoami();
  const myHandle = me?.handle || null;
  const myPseudonym = me?.pseudonym || null;

  const raw = Array.isArray(body) ? body : (body.entries || []);
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  const entries = raw
    .filter((e) => e && e.content && (e.timestamp ?? 0) >= cutoff)
    .map((e) => ({
      handle: e.handle || null,
      pseudonym: e.pseudonym || null,
      content: String(e.content),
      date: shortDate(e.timestamp),
      timestamp: e.timestamp,
      id: e.id,
    }))
    .filter((e) => !(myHandle && e.handle === myHandle))
    .filter((e) => !(myPseudonym && e.pseudonym === myPseudonym));

  return { ok: true, entries, server, myHandle, myPseudonym };
}

// Is there a usable identity yet?
function hasConfig() {
  try { return !!JSON.parse(fs.readFileSync(RC_PATH, 'utf8')).key; } catch { return false; }
}

// Write key/server/handle to ~/.routerrc, preserving any other fields.
function saveConfig({ key, server, handle }) {
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(RC_PATH, 'utf8')); } catch { /* fresh */ }
  const next = { ...existing, key, server, ...(handle ? { handle } : {}) };
  fs.writeFileSync(RC_PATH, JSON.stringify(next, null, 2));
  return next;
}

// In-app "router init": generate an identity, register a handle (which joins
// the deployment's team), and save ~/.routerrc. No CLI needed.
async function joinWithInvite({ server, inviteCode, handle }) {
  server = (server || DEFAULT_SERVER).replace(/\/$/, '');
  const h = String(handle || '').trim().replace(/^@/, '');
  if (!h) throw new Error('Choose a handle.');

  const gen = await fetch(`${server}/api/identity/generate`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  const genBody = await gen.json().catch(() => ({}));
  if (!gen.ok || !genBody.secret_key) throw new Error(genBody.error || 'Could not generate an identity.');
  const key = genBody.secret_key;

  const reg = await fetch(`${server}/api/identity/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret_key: key, handle: h, invite_code: inviteCode || undefined }),
  });
  const regBody = await reg.json().catch(() => ({}));
  if (!reg.ok) throw new Error(regBody.error || `Registration failed (${reg.status})`);

  const registeredHandle = regBody.user?.handle || regBody.handle || h;
  saveConfig({ key, server, handle: registeredHandle });
  return { key, server, handle: registeredHandle, teamId: regBody.user?.teamId || null };
}

async function post(content) {
  const { key, server } = loadConfig();
  const text = content.trim();
  // The live server authenticates via ?key= (same as reads) and expects a
  // { summary, content } body — matching the `router` CLI's write contract.
  // (Key in the body as secret_key is the OLD shape and gets rejected.)
  const firstLine = (text.split('\n').find((l) => l.trim()) || text).trim();
  const summary = firstLine.length > 160 ? firstLine.slice(0, 157) + '…' : firstLine;
  const url = `${server}/api/entries?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    // the server requires at least one tag (the CLI defaults to one too)
    body: JSON.stringify({ summary, content: text, tags: ['router'], client: 'router' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Router returned ${res.status}`);
  }
  return {
    server,
    pseudonym: body.pseudonym || body.entry?.pseudonym || null,
    handle: body.entry?.handle || null,
    entryId: body.entry?.id || body.id || null,
  };
}

module.exports = { post, fetchFeed, whoami, loadConfig, hasConfig, saveConfig, joinWithInvite, DEFAULT_SERVER };
