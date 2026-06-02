export const meta = {
  name: 'draft-daily-post',
  description: 'Draft the Router daily post best-of-N, selected by the LOCKED eval (evals/run.js)',
  phases: [
    { title: 'Draft', detail: 'fan out diverse candidate drafts' },
    { title: 'Score', detail: 'score each with the committed scorer' },
    { title: 'Refine', detail: 'one refine pass on the winner if it falls short' },
  ],
};

// ── Inputs (passed as args) ────────────────────────────────────────────────
// { name, dateLabel, myHandle, repoPath, inputsPath }
// inputsPath points at a JSON file holding { dateLabel, myHandle, workLog,
// feedEntries }. Agents READ that file (the workflow script has no fs access),
// and the scoring agents merge a candidate into the SAME file before running
// the committed scorer — the locked objective, never a re-implementation.
const A = args;

// The locked FORMAT the candidates must hit (the eval enforces it; this just
// helps drafts land gate-valid). Mirrors src/postspec.js + reflect.js.
const FORMAT = `FORMAT (the post must obey this exactly — the eval enforces it):
- Line 1: "Router digest · ${A.dateLabel}"
- Line 2: a plain one-line summary.
- Blank line.
- BODY, ~220-360 words, THIRD PERSON (${A.name} is the subject), in the canonical order below. ONLY "Wins" and "Insight" are required; the rest appear ONLY when genuine — omit rather than manufacture:
  "Wins — " (required) what shipped/moved.
  "Struggles — " (only if REAL friction) a genuine blocker — something that actually fought back, broke, took many failed attempts, or is unresolved. A normal product-design decision he simply made and resolved is NOT a struggle; if the day was steady building, OMIT this. Name real projects (router-daybook, teleport-router); NEVER a client.
  "Insight — " (required) the one thing ${A.name} concluded.
  "Offering — " (OMIT BY DEFAULT) include ONLY when today's work DIRECTLY solves a SPECIFIC person's STATED problem in the feed — a genuinely useful handoff. Topical / same-domain / same-pattern / same-tooling overlap is NOT enough. When included: quote their EXACT phrase (3-10 words) in "quotes" + a superscript marker (¹²³) and state the concrete thing handed over.
  "Asking — " (OPTIONAL, only when genuine) a real invitation for input: an open problem he has NOT solved, a request to try/give feedback on what he shipped, an honest opinion-on-patterns question (he made a working choice, wants to hear how others approach it), or whether anyone has explored a similar idea. NEVER re-ask something he ALREADY solved as if it were open, never invent a struggle to justify a question, never end on a question just to end on one. Name a feed member only on a tight genuine match (verbatim quote + marker); else ask plainly with NO name.
- Blank line, then: a line "—", a line "Sources", then one "ⁿ @handle · date" per footnote in order.
RESTRAINT (the rubric scores this): a forced @mention, a manufactured struggle, and a dressed-up ask are all WORSE than honest omission. The default is NO @mention; Struggles/Offering/Asking appear only when genuine. Some honest days have no Struggles, no Offering, and no Asking — that is fine.
BANNED (auto-fail): "compare notes", "pick your brain", "swap ideas", "happy to chat", "open to collaboration", "would be glad to", "reach out", "if anyone has…", "let me know if…", and any hedge/vague-verb/blanket-openness phrasing. Every offer/ask must be specific and concrete or omitted.
Plain, factual, ${A.name}'s own voice — no magazine turns, no hype, no emoji. Report only real work, not session plumbing (transcription, the assistant reading files).`;

const STRATEGIES = [
  { key: 'report-only', hint: 'Assume the honest day: Wins + Insight, no Struggles, no Offering, no Asking unless one is unmistakably genuine. Report what shipped and what was learned, plainly, and stop. Do not manufacture a struggle, a connection, or a question.' },
  { key: 'genuine-ask', hint: 'Wins + Insight, plus ONE honest Asking if a real one exists — an open problem he has not solved, a request to try/give feedback on what he shipped, or an honest opinion-on-patterns question (he made a working choice, wants to hear how others approach it). Never re-ask something already solved. Struggle/Offering only if genuinely real.' },
  { key: 'genuine-or-omit', hint: 'Include each optional section ONLY when genuine: a Struggle only on real friction, an Offering only on a tight feed match where his work solves their stated problem, an Asking only as a real open/usage/pattern question. Omit anything you would have to stretch or invent.' },
];

const DRAFT_SCHEMA = {
  type: 'object',
  properties: {
    post: { type: 'string', description: 'the full post text, exactly in the locked format' },
    footnotes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer' },
          handle: { type: 'string' },
          quote: { type: 'string' },
          date: { type: 'string' },
          excerpt: { type: 'string' },
        },
        required: ['n', 'handle', 'quote', 'date'],
      },
    },
  },
  required: ['post', 'footnotes'],
};

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    ok: { type: 'boolean', description: 'true if the scorer ran and returned JSON' },
    raw: { type: 'string', description: 'the exact JSON string printed by node evals/run.js --json' },
    error: { type: 'string' },
  },
  required: ['ok', 'raw'],
};

function draftPrompt(s) {
  return `Write ${A.name}'s Router daily update for ${A.dateLabel}. You are drafting ONE candidate; another process will score it against a locked rubric and may pick yours.

STRATEGY for this candidate: ${s.hint}

${FORMAT}

FIRST read the JSON file at ${A.inputsPath} (use the Read tool). It contains:
  • workLog — today's Claude Code + Codex sessions: the substance to report (ignore session plumbing).
  • feedEntries — other cohort members' recent posts: the ONLY valid source for @mentions and quotes.
Base the post strictly on workLog; draw every @mention and every verbatim quote from feedEntries. Every superscript marker in the body must have a footnote whose quote is a VERBATIM phrase from that @handle's feed entry. Never @-mention @${A.myHandle} (that is ${A.name} himself).

Return the post and its footnotes.`;
}

function scorePrompt(cand, i) {
  return `Score one candidate post with the project's committed, locked scorer. Do EXACTLY this:
1. Write this candidate's post text verbatim to /tmp/cand-${i}-post.txt (use the Write tool).
2. Write this JSON to /tmp/cand-${i}-fn.json (use the Write tool): ${JSON.stringify(cand.footnotes || [])}
3. Run this to assemble the scorer input and score it:
   cd ${A.repoPath} && node -e 'const fs=require("fs");const b=JSON.parse(fs.readFileSync("${A.inputsPath}","utf8"));b.post=fs.readFileSync("/tmp/cand-${i}-post.txt","utf8");b.footnotes=JSON.parse(fs.readFileSync("/tmp/cand-${i}-fn.json","utf8"));fs.writeFileSync("/tmp/cand-${i}.json",JSON.stringify(b));' && node evals/run.js --json /tmp/cand-${i}.json
4. Return { ok:true, raw: <the exact JSON the last command printed to stdout> }. If anything failed, return { ok:false, raw:"", error:<message> }.

CANDIDATE POST:
"""
${cand.post}
"""`;
}

// ── Draft → Score (pipeline: each candidate scores as soon as it's drafted) ──
const results = await pipeline(
  STRATEGIES,
  (s) => agent(draftPrompt(s), { schema: DRAFT_SCHEMA, phase: 'Draft', label: `draft:${s.key}` }),
  (cand, s, i) => cand
    ? agent(scorePrompt(cand, i), { schema: SCORE_SCHEMA, phase: 'Score', label: `score:${s.key}` })
        .then((sc) => ({ strategy: s.key, cand, verdict: safe(sc && sc.raw) }))
    : null,
);

function safe(raw) { try { return JSON.parse(raw); } catch { return null; } }
const scored = results.filter((r) => r && r.verdict);
scored.sort((a, b) => (b.verdict.score || 0) - (a.verdict.score || 0));
log(`scored ${scored.length}/${STRATEGIES.length} candidates: ${scored.map((s) => `${s.strategy}=${s.verdict.score}/${s.verdict.max}${s.verdict.gatesPassed ? '' : '(gate fail)'}`).join(', ')}`);

let winner = scored[0] || null;

// ── Refine: one pass if the best candidate falls short of the locked bar ─────
if (winner && !winner.verdict.pass) {
  phase('Refine');
  const gateFails = (winner.verdict.gates || []).filter((g) => !g.passed).map((g) => `${g.id}: ${g.detail}`);
  const dimNotes = (winner.verdict.dims || []).filter((d) => d.score < 3).map((d) => `${d.label} (${d.score}/3): ${d.notes}`);
  const refined = await agent(
    `Revise this Router daily post to score higher on the locked rubric, fixing the issues below while keeping everything that already works and obeying the FORMAT and BANNED rules.

ISSUES TO FIX:
${[...gateFails, ...dimNotes].map((x) => `- ${x}`).join('\n') || '- raise the weakest dimensions'}

${FORMAT}

Read ${A.inputsPath} for workLog (the substance) and feedEntries (the only valid @mention/quote source).

CURRENT POST:
"""
${winner.cand.post}
"""

Never @-mention @${A.myHandle}. Return the revised post and footnotes.`,
    { schema: DRAFT_SCHEMA, phase: 'Refine', label: 'refine:winner' },
  );
  if (refined) {
    const sc = await agent(scorePrompt(refined, 99), { schema: SCORE_SCHEMA, phase: 'Refine', label: 'score:refined' });
    const v = safe(sc && sc.raw);
    if (v && (v.score || 0) >= (winner.verdict.score || 0)) {
      winner = { strategy: 'refined', cand: refined, verdict: v };
      log(`refine improved the winner to ${v.score}/${v.max}${v.pass ? ' (PASS)' : ''}`);
    } else {
      log('refine did not improve the winner; keeping the best original');
    }
  }
}

return {
  winner: winner ? { strategy: winner.strategy, verdict: winner.verdict, post: winner.cand.post, footnotes: winner.cand.footnotes } : null,
  allScores: scored.map((s) => ({ strategy: s.strategy, score: s.verdict.score, max: s.verdict.max, gatesPassed: s.verdict.gatesPassed, pass: s.verdict.pass })),
};
