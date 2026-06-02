'use strict';

// ─────────────────────────────────────────────────────────────────────────
// CLI for the locked post eval.
//
//   node evals/run.js <post.json>        score one post, print the scorecard
//   node evals/run.js --fixtures         run the meta-eval over evals/fixtures
//   node evals/run.js --gates <post.json>  gates only (no model call)
//
// A <post.json> is { post, footnotes, feedEntries, workLog, name, dateLabel,
// myHandle, rules? }. `rules` defaults to the user's redaction rules.
// ─────────────────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');
const { score } = require('./score');

let loadRules;
try { ({ loadRules } = require('../src/scope')); } catch { loadRules = () => ({ hide: [], abstractions: [] }); }

// Fixtures may give `post`/`workLog` as an array of lines (far easier to author
// than a JSON string full of \n); join them here. A real post.json uses strings.
const joinLines = (v) => (Array.isArray(v) ? v.join('\n') : v);

function withDefaults(input) {
  const out = { name: 'James', dateLabel: '', myHandle: null, footnotes: [], feedEntries: [], workLog: '', ...input };
  out.post = joinLines(out.post);
  out.workLog = joinLines(out.workLog) || '';
  if (!out.rules) { try { out.rules = loadRules(); } catch { out.rules = { hide: [], abstractions: [] }; } }
  return out;
}

const P = (b) => (b ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m');

function printCard(label, r) {
  console.log(`\n── ${label} ─────────────────────────────`);
  console.log(`gates: ${P(r.gatesPassed)}`);
  for (const g of r.gates) console.log(`  ${g.passed ? '✓' : '✗'} ${g.id}  ${g.detail}`);
  if (r.judged) {
    console.log(`score: ${r.score}/${r.max}  (threshold ${r.threshold})`);
    for (const d of r.dims) console.log(`  ${d.score}/3  ${d.label} — ${d.notes}`);
  } else {
    console.log('score: (judge skipped)');
  }
  console.log(`VERDICT: ${P(r.pass)}${r.judged ? '' : ' (gates only)'}`);
}

async function scoreOne(file, opts = {}) {
  const input = withDefaults(JSON.parse(fs.readFileSync(file, 'utf8')));
  const r = await score(input, { skipJudge: !!opts.gatesOnly });
  printCard(path.basename(file), r);
  return r;
}

async function runFixtures() {
  const dir = path.join(__dirname, 'fixtures');
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  let allOk = true;
  for (const f of files) {
    const spec = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const r = await score(withDefaults(spec.input), {});
    const exp = spec.expect || {};
    const checks = [];
    if (typeof exp.gatesPassed === 'boolean') checks.push([`gatesPassed=${exp.gatesPassed}`, r.gatesPassed === exp.gatesPassed]);
    if (Array.isArray(exp.gateFails)) {
      for (const id of exp.gateFails) {
        const g = r.gates.find((x) => x.id === id);
        checks.push([`gate ${id} fails`, !!g && !g.passed]);
      }
    }
    if (typeof exp.minScore === 'number') checks.push([`score≥${exp.minScore}`, r.score >= exp.minScore]);
    if (typeof exp.maxScore === 'number') checks.push([`score≤${exp.maxScore}`, r.score <= exp.maxScore]);
    if (Array.isArray(exp.dimMax)) {
      for (const [key, lim] of exp.dimMax) {
        const d = r.dims.find((x) => x.key === key);
        checks.push([`${key}≤${lim}`, !!d && d.score <= lim]);
      }
    }
    if (Array.isArray(exp.dimMin)) {
      for (const [key, lim] of exp.dimMin) {
        const d = r.dims.find((x) => x.key === key);
        checks.push([`${key}≥${lim}`, !!d && d.score >= lim]);
      }
    }
    const ok = checks.every(([, c]) => c);
    allOk = allOk && ok;
    console.log(`\n${P(ok)}  ${spec.name || f}  — gates ${r.gatesPassed ? 'pass' : 'FAIL'}, score ${r.score}/${r.max}`);
    for (const [desc, c] of checks) console.log(`    ${c ? '✓' : '✗'} expect ${desc}`);
    if (!ok) for (const g of r.gates.filter((x) => !x.passed)) console.log(`      · ${g.id}: ${g.detail}`);
  }
  console.log(`\n${allOk ? '\x1b[32mALL FIXTURES OK\x1b[0m' : '\x1b[31mFIXTURE MISMATCH\x1b[0m'}`);
  process.exit(allOk ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--fixtures')) return runFixtures();
  const gatesOnly = args.includes('--gates');
  const asJson = args.includes('--json');
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) {
    console.error('usage: node evals/run.js <post.json> | --fixtures | --gates <post.json> | --json <post.json>');
    process.exit(2);
  }
  if (asJson) {
    // Machine-readable verdict — for the drafting workflow's scoring step.
    const input = withDefaults(JSON.parse(fs.readFileSync(file, 'utf8')));
    const r = await score(input, { skipJudge: gatesOnly });
    process.stdout.write(JSON.stringify(r));
    process.exit(0);
  }
  const r = await scoreOne(file, { gatesOnly });
  process.exit(r.pass ? 0 : 1);
}

main().catch((e) => { console.error(e.message || e); process.exit(2); });
