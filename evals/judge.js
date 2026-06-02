'use strict';

// ─────────────────────────────────────────────────────────────────────────
// The LLM judge for the scored dimensions D1–D6 (each 0–3). One `claude -p`
// call on the local subscription (no API key), returning strict JSON. The
// anchors below are the machine form of evals/rubric.md's scored-dimension
// section — keep the two in sync on any version bump.
//
// judge(input) → { dims: [{ key, label, score, max, notes }], total }
//   input = { post, workLog, feedEntries, name, model?, timeoutMs? }
// ─────────────────────────────────────────────────────────────────────────

const { spawn } = require('child_process');

function subscriptionEnv() { const e = { ...process.env }; delete e.ANTHROPIC_API_KEY; return e; }

const DIMS = [
  { key: 'd1', label: 'Offering quality' },
  { key: 'd2', label: 'Asking quality' },
  { key: 'd3', label: 'Match substance' },
  { key: 'd4', label: 'Plainness / anti-lameness' },
  { key: 'd5', label: 'Signal vs noise' },
  { key: 'd6', label: 'Faithfulness' },
];

function systemPrompt(name) {
  return `You are a strict, fair grader of ${name}'s daily update for a builder cohort's shared feed. You are given the POST, the WORK LOG it was written from, and the COHORT FEED it can cite. Score SIX dimensions, each an integer 0–3. Be skeptical: reserve 3 for genuinely excellent, give 0 when the dimension is absent or violated. Judge only what is in the inputs — do not reward plausibility.

OVERARCHING PRINCIPLE — RESTRAINT: a forced or merely-plausible connection is WORSE than no connection. The right default is to make NO @-mention. ${name} should name a peer ONLY when his actual work directly bears on that specific person's STATED problem and the offer/ask is genuinely useful to them. Topical overlap, same domain, same UI pattern, or same tooling are NOT enough and should be omitted, not mentioned. Reward honest omission as highly as a genuinely useful match; punish stretched matches.

DIMENSIONS (0–3 each):
D1 Offering quality & restraint — When the feed contains someone ${name} can GENUINELY help (his real work solves THEIR stated problem), does he offer specific, concrete, handed-over help to that named person? AND does he correctly OMIT an offer when no such genuine match exists, rather than forcing a weak one? 3 = a specific, actionable offer to a truly-matched peer, OR no Offering at all because none was genuinely useful (correct restraint); 2 = a good offer but the match is slightly soft; 1 = a forced/generic/plausible-but-not-useful offer (making a weak connection is a DEFECT, not partial credit); 0 = vague ("happy to help") or help offered to someone he cannot actually help.
D2 Asking quality — are the asks CONCRETE and ACTIONABLE (a specific need), not vague openness, and does the post end on one? 0 = none/only vague openness; 1 = fuzzy ask; 2 = concrete ask; 3 = concrete, specific, answerable-this-week ask that ends the post.
D3 Connection quality & restraint — judge EVERY @-mention (in Offering or Asking). Each must be a TRULY USEFUL, substantive match where ${name}'s work directly bears on that person's stated problem — not merely topical, plausible, same-pattern, or same-tooling. A forced or stretched @-mention is worse than none. 3 = every @-mention is genuinely useful and sharply on-substance, OR the post makes NO @-mention because none cleared that bar (correct restraint); 2 = a real, useful match that is slightly soft; 1 = a plausible-but-not-tight or merely-topical connection that should NOT have been made; 0 = spurious/tooling-only (both used Whisper, same library).
D4 Plainness / anti-lameness — ${name}'s own plain, factual voice; NO magazine/editorial turns, hype, hedge filler, or writerly flourishes. 0 = reads like marketing/a magazine; 3 = flat, direct, his own report.
D5 Signal vs noise — reports the real work and decisions, NOT session plumbing (voice transcription, the assistant reading files, "let me check…"). 0 = dominated by plumbing; 3 = only substance that still matters in a week.
D6 Faithfulness — every claim traces to the WORK LOG; every quote is verbatim from the FEED; nothing invented. 0 = fabrications; 3 = fully grounded.

OUTPUT: a single JSON object and NOTHING else (no fences, no prose):
{"d1":{"score":0,"notes":"..."},"d2":{"score":0,"notes":"..."},"d3":{"score":0,"notes":"..."},"d4":{"score":0,"notes":"..."},"d5":{"score":0,"notes":"..."},"d6":{"score":0,"notes":"..."}}
Each "notes" is one short clause justifying the score. Scores are integers 0–3.`;
}

function formatFeed(entries) {
  if (!entries || !entries.length) return '(no cohort entries)';
  return entries.slice(0, 40).map((e) => {
    const who = e.handle ? '@' + e.handle : (e.pseudonym || 'someone');
    return `- ${who} (${e.date || '?'}): ${String(e.content || '').replace(/\s+/g, ' ').slice(0, 360)}`;
  }).join('\n');
}

function parse(out) {
  let b = String(out || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  const i = b.indexOf('{'); const j = b.lastIndexOf('}');
  if (i !== -1 && j > i) b = b.slice(i, j + 1);
  const obj = JSON.parse(b);
  const dims = DIMS.map((d) => {
    const raw = obj[d.key] || {};
    let score = Number(raw.score);
    if (!Number.isFinite(score)) score = 0;
    score = Math.max(0, Math.min(3, Math.round(score)));
    return { key: d.key, label: d.label, score, max: 3, notes: String(raw.notes || '').trim() };
  });
  return { dims, total: dims.reduce((n, d) => n + d.score, 0) };
}

function judge(input = {}) {
  const { post = '', workLog = '', feedEntries = [], name = 'James', model, timeoutMs = 120000 } = input;
  const system = systemPrompt(name);
  const user = [
    '=== POST (grade this) ===', post, '',
    '=== WORK LOG (what the post was written from) ===', workLog || '(none provided)', '',
    '=== COHORT FEED (what the post may cite) ===', formatFeed(feedEntries), '',
    'Grade D1–D6 now. Output the JSON object only.',
  ].join('\n');

  return new Promise((resolve, reject) => {
    const args = ['-p', '--append-system-prompt', system];
    if (model) args.push('--model', model);
    let child;
    try { child = spawn('claude', args, { stdio: ['pipe', 'pipe', 'pipe'], env: subscriptionEnv() }); }
    catch (e) { return reject(new Error('Could not launch claude CLI: ' + e.message)); }

    let out = '', err = '';
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(new Error('judge timed out')); }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => { clearTimeout(timer); reject(new Error('judge claude error: ' + e.message)); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0 && !out.trim()) return reject(new Error('judge claude exited ' + code + ': ' + err.trim()));
      try { resolve(parse(out)); }
      catch (e) { reject(new Error('judge returned unparseable JSON: ' + e.message + '\n' + out.slice(0, 400))); }
    });
    child.stdin.write(user);
    child.stdin.end();
  });
}

module.exports = { judge, DIMS };
