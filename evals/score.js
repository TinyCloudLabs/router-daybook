'use strict';

// ─────────────────────────────────────────────────────────────────────────
// The scorer: hard gates (deterministic) + judge (claude -p) → one verdict.
// This is the locked objective function. A post PASSES iff every gate passes
// AND the judge score ≥ THRESHOLD. See evals/rubric.md.
//
// score(input, { skipJudge? }) → {
//   gatesPassed, gates:[{id,passed,detail}],
//   dims:[{key,label,score,max,notes}], score, max, threshold, pass
// }
// `skipJudge` runs gates only (cheap, no model) — useful as a fast pre-filter.
// ─────────────────────────────────────────────────────────────────────────

const { checkGates } = require('./gates');
const { judge } = require('./judge');
const postspec = require('../src/postspec');

async function score(input = {}, opts = {}) {
  const gates = checkGates(input);

  let dims = [];
  let total = 0;
  let judged = false;
  if (!opts.skipJudge) {
    const j = await judge(input);
    dims = j.dims;
    total = j.total;
    judged = true;
  }

  const pass = gates.passed && judged && total >= postspec.THRESHOLD;
  return {
    gatesPassed: gates.passed,
    gates: gates.results,
    dims,
    judged,
    score: total,
    max: postspec.SCORE_MAX,
    threshold: postspec.THRESHOLD,
    pass,
  };
}

module.exports = { score };
