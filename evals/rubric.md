# Router daily-post rubric — v1 (LOCKED)

The contract for what a good Router daily post is. This prose spec and its
machine-readable twin `src/postspec.js` move together; the scorer in `evals/`
enforces them. Changing the criteria is a deliberate version bump
(`RUBRIC_VERSION`), not a casual edit.

A scoring run takes:
`{ post, headline, footnotes, workLog, feedEntries, name, dateLabel, myHandle }`
where `workLog` is the scrubbed digest the post was written from and `feedEntries`
is the cohort feed (`{ handle, content, date, ... }`).

A post **passes** iff **all hard gates pass** AND the **judge score ≥ THRESHOLD (14/18)**.

---

## Hard gates (deterministic — any failure ⇒ INVALID, score irrelevant)

**G1 — Structure & order.**
- Line 1 is exactly `Router digest · <dateLabel>`.
- Line 2 is a non-empty plain summary.
- A blank line separates the summary from the body.
- The body contains the lead-ins in the canonical order
  `Wins → [Struggles?] → Insight → [Offering?] → [Asking?]`. **Only `Wins` and
  `Insight` are required**; `Struggles`, `Offering`, and `Asking` are optional —
  included only when genuine (real friction / a real match / a real ask), never
  manufactured. No lead-in is forced to be last.

**G2 — Citation integrity.**
- Every superscript marker (¹ ² ³ …) in the body has a matching `footnotes[]`
  item; footnote numbers are sequential from 1.
- A sources block exists: a `—` line, then `Sources`, then one
  `ⁿ @handle · date` line per footnote, in order.
- Every `footnote.handle` appears among `feedEntries` handles.
- Every `footnote.quote` is a verbatim substring (whitespace-normalized,
  case-insensitive) of that handle's feed `content`.
- The post never cites or @-mentions `myHandle` (James himself).

**G3 — No banned phrasings.** The post contains none of the locked banned
register (`postspec.BANNED`): the hedge / vague-verb / blanket-openness phrases
such as *compare notes, pick your brain, swap ideas, sync up, happy to chat,
open to collaboration, would be glad to, if anyone has…, reach out, let me
know if…*. These are what make a collaboration line lame; they are disqualifying.

**G4 — Safety.** `redact(post, rules)` produces zero confident secret findings,
and no locked client/abstraction term appears. (Reuses `src/redact.js`.)

**G5 — Length.** Body word count is within `[LENGTH.min, LENGTH.max]` = `[180, 400]`.

---

## Scored dimensions (LLM judge — each 0–3, total /18)

> **Restraint & honesty principle (D1 + D2 + D3).** A forced connection, a
> manufactured struggle, and a dressed-up ask are all *worse* than honest
> omission. The default is **no @-mention**, and Struggles/Offering/Asking appear
> only when genuine. James names a peer only when his work directly bears on that
> person's *stated* problem; reports a struggle only on real friction; and asks
> only a genuine question (an open problem, a usage/feedback request, an honest
> opinion-on-patterns question, or "has anyone tried this idea"). Topical /
> same-domain / same-pattern / same-tooling overlap is not a match. Honest
> omission scores as high as genuine content.

**D1 — Offering quality & restraint.** When the feed has someone James can
*genuinely* help (his work solves their stated problem), does he offer specific,
concrete, handed-over help to that named person — and does he *omit* an offer
when no genuine match exists rather than forcing a weak one?
- 0 = vague ("happy to help"), or help offered to someone he can't actually help.
- 1 = a forced / generic / plausible-but-not-useful offer (a defect, not credit).
- 2 = a good offer, match slightly soft.
- 3 = specific, actionable help to a truly-matched peer, **or** no Offering at
  all because none was genuinely useful (correct restraint).

**D2 — Asking quality & honesty.** An ask is *optional*. When one is present,
is it *genuine and honestly framed*? Genuine asks: an open problem James hasn't
solved; a request to try / use / give feedback on what he shipped; an honest
opinion-on-patterns question (he made a working choice, wants to hear how others
approach it); or whether anyone has explored a similar idea. The disqualifier is
dishonest framing — re-asking something he *already solved* as if it were open,
or inventing a struggle to justify a question.
- 0 = vague openness ("open to collaboration", "let me know").
- 1 = a solved problem dressed up as an open blocker, or an ask manufactured
  from a routine decision.
- 2 = a real ask, slightly soft or padded.
- 3 = a genuine, honestly-framed ask (including a usage/pattern/idea
  invitation), **or** no ask at all because nothing genuine fit (restraint — the
  absence of an ask is never penalized).

**D3 — Connection quality & restraint.** Judge *every* @-mention (Offering or
Asking). Each must be a *truly useful*, substantive match where James's work
directly bears on that person's stated problem — not merely topical, plausible,
same-pattern, or same-tooling. A forced @-mention is worse than none.
- 0 = spurious / tooling-only (both used Whisper, same library).
- 1 = plausible-but-not-tight or merely-topical — should not have been made.
- 2 = a real, useful match, slightly soft.
- 3 = every @-mention genuinely useful and sharply on-substance, **or** no
  @-mention because none cleared the bar (correct restraint).

**D4 — Plainness / anti-lameness.** James's own plain, factual voice — no
magazine/editorial turns, no hype, no hedge filler, no writerly flourishes.
- 0 = reads like a magazine or marketing. 3 = flat, direct, his own report.

**D5 — Signal vs noise.** Reports the real work and decisions, not session
plumbing (voice transcription, the assistant reading files, "let me check…").
- 0 = dominated by plumbing. 3 = only substance a peer would still care about
  in a week.

**D6 — Faithfulness.** Every claim traces to the `workLog`; every quote is
verbatim from the feed; nothing invented.
- 0 = fabrications. 3 = fully grounded.

---

## Verdict

```
gatesPassed = G1 ∧ G2 ∧ G3 ∧ G4 ∧ G5
score       = D1 + D2 + D3 + D4 + D5 + D6        (0..18)
pass        = gatesPassed ∧ (score ≥ 14)
```

The threshold, the gates, the banned list, the length window, and the lead-in
order are all part of the lock.
