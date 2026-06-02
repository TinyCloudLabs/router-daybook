'use strict';

// ─────────────────────────────────────────────────────────────────────────
// Hard gates G1–G5 (deterministic). Any failure ⇒ the post is INVALID,
// regardless of the judge score. Pure functions over the post + its inputs;
// the only side-effect-free imports are the locked contract (postspec) and the
// shared scrubber (redact). See evals/rubric.md.
//
// checkGates(input) → { passed, results: [{ id, passed, detail }] }
//   input = { post, footnotes, feedEntries, dateLabel, myHandle, rules }
// ─────────────────────────────────────────────────────────────────────────

const { redact } = require('../src/redact');
const postspec = require('../src/postspec');

const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const SUP_CHARS = Object.keys(SUP).join('');
const SUP_RUN = new RegExp(`[${SUP_CHARS}]+`, 'g');

const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const cleanHandle = (h) => String(h || '').replace(/^@/, '').trim().toLowerCase();

// A run of superscript glyphs → the integer it denotes (¹→1, ¹²→12).
function supRunToNum(run) {
  let digits = '';
  for (const ch of run) if (ch in SUP) digits += SUP[ch];
  return digits ? parseInt(digits, 10) : null;
}

// Split a post into { l0, summary, blankOk, leadIns:[{label,idx}], sourcesLines:[] }.
function parse(post) {
  const lines = String(post || '').split('\n');
  const l0 = (lines[0] || '').trim();
  const summary = (lines[1] || '').trim();
  const blankOk = (lines[2] || '').trim() === '';

  // Locate the sources block: a line that is exactly "Sources" with a "—"
  // separator just above it. Everything before that separator is the body.
  let sourcesIdx = -1;
  for (let i = 3; i < lines.length; i++) {
    if (lines[i].trim() === 'Sources') { sourcesIdx = i; break; }
  }
  let bodyEnd = lines.length;
  let dashOk = false;
  if (sourcesIdx !== -1) {
    let j = sourcesIdx - 1;
    while (j > 0 && lines[j].trim() === '') j--;
    if (lines[j].trim() === '—') { bodyEnd = j; dashOk = true; }
    else bodyEnd = sourcesIdx; // malformed: no dash; still treat as body end
  }

  const bodyLines = lines.slice(2, bodyEnd);
  const body = bodyLines.join('\n');

  // Lead-ins, in the order they appear, matching "Label —" / "Label -".
  const leadIns = [];
  const labelRe = new RegExp(`^\\s*(${postspec.LEAD_INS.join('|')})\\b\\s*[—–-]`);
  for (const line of bodyLines) {
    const m = line.match(labelRe);
    if (m) leadIns.push(m[1]);
  }

  const sourcesLines = sourcesIdx !== -1 ? lines.slice(sourcesIdx + 1).filter((l) => l.trim()) : [];
  return { l0, summary, blankOk, dashOk, body, leadIns, sourcesLines, hasSources: sourcesIdx !== -1 };
}

function checkGates(input = {}) {
  const { post = '', footnotes = [], feedEntries = [], dateLabel = '', myHandle = null, rules = { hide: [], abstractions: [] } } = input;
  const P = parse(post);
  const results = [];
  const add = (id, passed, detail) => results.push({ id, passed, detail });

  // ── G1 Structure & order ────────────────────────────────────────────────
  {
    const fails = [];
    if (P.l0 !== `Router digest · ${dateLabel}`) fails.push(`line 1 is "${P.l0}", expected "Router digest · ${dateLabel}"`);
    if (!P.summary) fails.push('line 2 (summary) is empty');
    if (!P.blankOk) fails.push('no blank line after the summary');
    for (const req of postspec.REQUIRED_LEAD_INS) {
      if (!P.leadIns.includes(req)) fails.push(`missing required lead-in "${req}"`);
    }
    const canonical = postspec.LEAD_INS.filter((x) => P.leadIns.includes(x));
    if (P.leadIns.join('>') !== canonical.join('>')) fails.push(`lead-ins out of order: ${P.leadIns.join(' → ')}`);
    if (P.leadIns.length && P.leadIns[P.leadIns.length - 1] !== postspec.FINAL_LEAD_IN) {
      fails.push(`body must end on "${postspec.FINAL_LEAD_IN}", ends on "${P.leadIns[P.leadIns.length - 1]}"`);
    }
    add('G1', fails.length === 0, fails.join('; ') || 'structure & order ok');
  }

  // ── G2 Citation integrity ───────────────────────────────────────────────
  {
    const fails = [];
    // Markers used in the body (exclude the sources block, which parse() dropped).
    const bodyMarkers = new Set();
    for (const run of P.body.match(SUP_RUN) || []) {
      const n = supRunToNum(run);
      if (n) bodyMarkers.add(n);
    }
    const fnNums = footnotes.map((f) => Number(f.n)).filter((n) => n > 0).sort((a, b) => a - b);
    const fnByNum = new Map(footnotes.map((f) => [Number(f.n), f]));

    // Feed lookup: handle → normalized content (only entries that have a handle).
    const feedByHandle = new Map();
    for (const e of feedEntries) {
      if (e && e.handle) feedByHandle.set(cleanHandle(e.handle), norm(e.content));
    }

    if (bodyMarkers.size === 0 && fnNums.length === 0 && !P.hasSources) {
      // No citations at all — allowed.
    } else {
      // Footnote numbers sequential from 1.
      const expected = fnNums.map((_, i) => i + 1);
      if (fnNums.join(',') !== expected.join(',')) fails.push(`footnote numbers not sequential from 1: [${fnNums.join(', ')}]`);
      // Every body marker has a footnote.
      for (const m of bodyMarkers) if (!fnByNum.has(m)) fails.push(`body marker ${m} has no footnote`);
      // Sources block present + one well-formed line per footnote, in order.
      if (!P.dashOk) fails.push('missing "—" separator above Sources');
      if (P.sourcesLines.length !== footnotes.length) fails.push(`Sources has ${P.sourcesLines.length} lines, ${footnotes.length} footnotes`);
      P.sourcesLines.forEach((line, i) => {
        const m = line.match(new RegExp(`^([${SUP_CHARS}]+)\\s*@?([^\\s·]+)\\s*·\\s*(.+)$`));
        if (!m) { fails.push(`Sources line ${i + 1} malformed: "${line}"`); return; }
        if (supRunToNum(m[1]) !== i + 1) fails.push(`Sources line ${i + 1} numbered ${supRunToNum(m[1])}`);
      });
      // Each footnote: handle in feed, quote verbatim from that handle's entry.
      for (const f of footnotes) {
        const h = cleanHandle(f.handle);
        if (!feedByHandle.has(h)) { fails.push(`footnote @${h} not in feed`); continue; }
        const q = norm(f.quote);
        if (q && !feedByHandle.get(h).includes(q)) fails.push(`footnote @${h} quote not verbatim: "${f.quote}"`);
      }
    }
    // Never @-mention self.
    if (myHandle) {
      const selfRe = new RegExp(`@${cleanHandle(myHandle).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (selfRe.test(post)) fails.push(`@-mentions self (@${cleanHandle(myHandle)})`);
    }
    add('G2', fails.length === 0, fails.join('; ') || 'citations intact');
  }

  // ── G3 No banned phrasings ──────────────────────────────────────────────
  {
    const hits = postspec.findBanned(post);
    add('G3', hits.length === 0, hits.length ? `banned phrasing(s): ${hits.join(', ')}` : 'no banned phrasings');
  }

  // ── G4 Safety ───────────────────────────────────────────────────────────
  {
    let findings = [];
    try { findings = redact(post, rules).findings || []; } catch { findings = []; }
    const secrets = findings.filter((f) => f.confidence === 'high' && f.type !== 'client');
    const clients = findings.filter((f) => f.type === 'client');
    const fails = [];
    if (secrets.length) fails.push(`${secrets.length} confident secret finding(s): ${secrets.map((f) => f.type).join(', ')}`);
    if (clients.length) fails.push(`${clients.length} client name(s) present`);
    add('G4', fails.length === 0, fails.join('; ') || 'no secrets or client names');
  }

  // ── G5 Length ───────────────────────────────────────────────────────────
  {
    const words = P.body.trim().split(/\s+/).filter(Boolean).length;
    const ok = words >= postspec.LENGTH.min && words <= postspec.LENGTH.max;
    add('G5', ok, `${words} body words (allowed ${postspec.LENGTH.min}-${postspec.LENGTH.max})`);
  }

  return { passed: results.every((r) => r.passed), results };
}

module.exports = { checkGates, parse };
