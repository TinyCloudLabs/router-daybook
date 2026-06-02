# Daybook — Access & Redaction UX (Design Spec)

*Design lead synthesis of three directions (the Ledger, Scope-grant, Rules-and-calm-defaults) and their adversarial critiques. All three scored privacy 6/8 for the **same** reason: they redacted the wrong artifact, trusted detection to be complete, keyed scope on a colliding `basename`, and left the device-link raw path as a backdoor. This spec keeps the best of each surface and closes every must-fix.*

---

## 1. Principles & design language

Six named principles, then the trust grammar.

**P1 — You are the gate, at both ends.** The boundary is felt twice: *upstream* (deny-by-default scope decides what Daybook is even allowed to read) and *downstream* (a literal preview of what is about to leave before you press Post). Neither alone is enough; together they are the whole promise.

**P2 — Redaction is a deterministic act, not an instruction.** The current `reflect.js` "HARD SAFETY RULES" are a request to a model that can ignore them. We add a real local scrubber that runs on bytes, before any text leaves the machine, and we keep the prompt rules only as defense-in-depth. *The prompt is never the guarantee.*

**P3 — Scrub what actually leaves — twice.** There are two outbound hops, and each gets the same scrubber: (a) the **digest** before `spawn('claude')` (this string reaches Anthropic), and (b) the **generated post** after the model returns, before staging/Router (the model can reproduce or restate a secret the digest scrub missed). Chips and counts attach to the *final outgoing post*, never to the digest alone.

**P4 — Best-effort, said plainly.** Detection has a false-negative rate. We never render "2 secrets hidden" as a completeness claim. We say "hid the 2 it recognized — detection is best-effort, read the draft." The user's own always-hide terms are the backstop for what generic detectors miss. This is the README's "honestly" applied to a mechanism, not a promise.

**P5 — Rules over toggles; the safe default costs nothing.** Forty repos is not forty switches. A short list of plain-English rules ("exclude anything under `~/clients`", "include repos active in 30 days") plus a handful of manual pins. New and unrecognized repos are **out by default** and surfaced, never silently swept in. The privacy-safe state is the resting state.

**P6 — Calm, legible, reversible.** Mostly green and quiet. Amber is spent only at the one genuine public-egress moment so it keeps its meaning. Every scope change is one click, annotated with *why*, and undoable — but inclusion only takes effect on the **next** collect (you can never "un-send").

### Trust grammar

**The three-tier data-flow vocabulary**, learned once and repeated on every surface, mapped to existing tokens (no new hues):

| Meaning | Token | Where it appears |
|---|---|---|
| **stays on this machine** | `--ok` `#5ad6a0` (green) | local-read manifest, session files, Whisper audio, success check |
| **leaves to write the digest** (Anthropic, your subscription — *always happens*) | `--accent` `#b79bff` (violet) | the cloud-generation line, shown in the **resting** state, not buried |
| **about to post to the cohort** | `--warn` `#ffcf6b` (amber) | the "about to leave" manifest only — nowhere else |

**Masking** uses one new neutral token `--mask: rgba(255,255,255,0.14)` — grey `▮▮▮` blocks, *not* red. Hiding a secret is routine and calm, not an error. Auto-detected redactions are neutral grey; **rule-redactions you authored** tint to `--accent` so you can tell your own hides from the machine's.

**Honesty rules (hard):** never imply "nothing leaves your machine" (generation is cloud inference); never imply detection is exhaustive; never show a manifest that disagrees with the visible draft; the always-true cloud egress (P3a) is at least as visible as the green local-read reassurance.

**Icons (functional glyphs only, matching `⛓ ✦ ✓ 🌙`):** `◈` scope/gate · `●/○` included/excluded · `▮▮▮` masked secret · `✦` standing rule (the existing learned-chip glyph) · `⚠` rule-excluded caution (in-row only). No emoji in prose. Serif (`--serif`) for every reassuring human sentence; sans for all controls, labels, counts.

---

## 2. The core mental model

**"It does the right thing by default; I read what's about to leave, and I write a rule when it's wrong."** Scope is a *possession* you hold (a countable noun — "reads 3 repos"), set mostly by rules, glanced at daily as one honest sentence, and tuned rarely from one durable home. Critically, the surface is honest that **two** things leave the machine, not one: the *digest* always goes to Anthropic to be written (cloud inference on your subscription), and the *post* goes to the cohort only when you approve. We scrub both; we gate the second; we never pretend the first didn't happen.

```
   ON YOUR MACHINE                    │  LEAVES (hop 1)        │  LEAVES (hop 2, gated)
                                      │                       │
  sessions + repos                    │                       │
  (deny-by-default scope)             │                       │
        │                             │                       │
        ▼                             │                       │
   buildDigest ──► [SCRUB #1] ───────────► claude -p ─────────┐│
   (--ok green)     deterministic     │   (--accent violet,   ││
                    local strip       │    Anthropic, your    ││
                                      │    subscription)      ▼│
                                      │                  generated post
                                      │                       │
                                      │              [SCRUB #2] same scrubber
                                      │                       │  + your always-hide terms
                                      │                       ▼
                                      │              "about to leave" preview
                                      │               (--warn amber) ──► YOU PRESS POST
                                      │                       │           │
                                      │                       ▼           ▼
                                      │                  staging (deletable) ──► Router
   the SAME scope + SCRUB also gate ──┴──► link.readRawLogs (device-link)
```

---

## 3. Information architecture

Daybook stays one window, one card via `setView()` + `.fade`. This design adds **one new full-card view, one inline strip, and one inline confirm** — no settings wall, no daily detour for the common case.

- **Inline Scope strip** — top of the existing post-`generate()` review card, where `#projlist` pills sit today (`index.html:143`). A calm one-line scope sentence (serif) + the redaction-aware draft. This is the daily gate, in the place the user already looks. 95% of days end here: *read one sentence, glance at the draft, press Post.*
- **`◈ Scope` view** — a `.head-link` beside `⛓ Link` (`index.html:22`). The durable home: rules first, source list second, redaction terms, and the device-link unification line. Reached `setView('scope')`, left with `← back`. Visited a handful of times ever.
- **"About to leave" confirm** — the Post button's deliberate apply-step, an inline confirm on the footer (not a new view), the *only* place amber appears.
- **First run** — no blocking form. Scope is *derived* on first digest and *revealed* as one reassurance band above the first draft.

Relationship to the daily flow:

```
loading → review card  ──[Post →]──► "about to leave" confirm ──► success
            │  ▲                          (--warn, literal text)
   ◈ Scope ─┘  └─ what's read → (inline expander, no nav)
```

---

## 4. Screens (text wireframes)

### 4a. First-run (derived, never a form)

Scope is derived from defaults (active-in-30-days **in**, sensitive-name/path patterns **out**, unknown repos **out and surfaced**). One reassurance band above the first draft:

```
┌──────────────────────────────────────────────────────────────┐
│  ◈  First time here — so you know how this works.              │  ← serif, calm
│     I read your sessions on this machine, write the draft on   │
│     your Claude subscription (that text reaches Anthropic),    │  ← cloud caveat, up front
│     and post to the cohort only when you press Post.           │
│                                                                │
│     I scoped myself: 2 repos active this week are in,          │
│     everything older and anything under ~/clients stayed out,  │
│     secrets I recognize are hidden. Look right?                │
│                                  review scope →     looks good │
└──────────────────────────────────────────────────────────────┘
```
`looks good` dismisses forever; `review scope →` opens 4b. The safe scope required zero decisions.

### 4b. Access & scope manager (`#scope`) — the durable home

Rules first. Source list keyed on **full path** (collisions disambiguated). Conversation sub-level shown where the data model supports it (see §8 — built via new session identity in `record()`).

```
┌──────────────────────────────────────────────────────────────┐
│  ◈ SCOPE                                              ← back   │
│                                                                │
│  what the Router can see                                       │  ← serif headline
│  I read the repos you're actively working in, hide the secrets │  ← serif sub, honest
│  I recognize, and keep everything else out. You set the rules; │
│  I do the rest — and detection is best-effort, so read the draft.│
│                                                                │
│  ── RULES ─────────────────────────────────────────────────   │
│  ✦ include repos active in the last 30 days                    │
│  ✦ exclude anything under  ~/clients                   ✎  ⌫    │
│  ✦ exclude private repos                                       │
│  ✦ always hide  ACME, prod-db-url, STRIPE_LIVE         ✎  ⌫    │
│                                                  + add a rule   │
│                                                                │
│  [ search repos…                                          ]    │
│                                                                │
│  ── IN SCOPE NOW · 3 ──────────────────────────────────────   │
│  ● teleport-router   ~/work/teleport-router   11 conv   today  │  ← --ok dot
│       └ 3 conversations · all in       choose conversations →  │  ← per-conv sublevel
│  ● daybook           ~/work/daybook            4 conv   today  │
│  ● api               ~/work/api                6 conv   today  │
│       ⚠ also found ~/clients/api — that one is excluded by rule│  ← collision disambiguated
│                                                                │
│  ── OUT · 15 ──────────────────────────────────  show all ▾   │  ← collapsed long tail
│  ○ acme-billing      excluded by  ~/clients rule               │  ← --ink-faint, struck
│  ○ side-experiment   NEW — worked on today        include?     │  ← --warn: new, surfaced
│  ○ scratch-2024      no activity in 19 days                    │
│                                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ◈ This also governs device-link. Raw logs you share    │    │
│  │   with another computer obey these same rules and are  │    │
│  │   scrubbed the same way.  raw sharing is OFF.   manage →│    │  ← backdoor closed
│  └──────────────────────────────────────────────────────┘    │
│                                          [ Save scope → ]      │
└──────────────────────────────────────────────────────────────┘
```

**Choose conversations →** (per-source sublevel, repo expanded inline):

```
│  teleport-router · conversations today                         │
│   ◉ "device pairing handshake"   9 msg · claude+codex          │  ← included
│   ◉ "auth token rotation"        4 msg · claude                │
│   ○ "scratch / pasted prod dump" 2 msg · claude   ⚠ excluded   │  ← excluded by you
│        └ kept out by you — undo                                 │
```

### 4c. Daily "what's leaving" — inline strip + redaction-aware draft

```
┌──────────────────────────────────────────────────────────────┐
│  COHORT DIGEST                                       ◈ Scope   │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ ◈  Today's digest read 3 repos and 11 conversations   │    │  ← scope sentence (serif)
│  │    on your machine. 15 repos and your client work      │    │
│  │    stayed out. I hid 2 secrets I recognized.           │    │  ← best-effort wording
│  │                                          what's read → │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                                │
│  Tuesday — getting the handshake stable                        │  ← .headline (serif)
│                                                                │
│  Spent most of today on teleport-router, finally got the peer  │  ← .prose (serif)
│  handshake stable. Threaded a fix through the auth layer for    │
│  [ a client integration ]¹ — token rotation was the part that   │  ← client-abstracted (accent)
│  fought back. Left STRIPE_LIVE ▮▮▮▮² aside for tomorrow,         │  ← rule-redacted (accent)
│  and the old key sk-▮▮▮▮▮▮³ is gone for good.                   │  ← auto-redacted (grey)
│                                                                │
│  ──────────────────────────────────────────────────────────  │
│  Nothing here has left your machine yet — except the draft text │  ← honest, both hops named
│  that went to your Claude subscription to write this. Post sends │
│  the text above to the shape-rotator feed, staged first.        │
│                                                                │
│        ✎ edit      ↻ rewrite              [ Post → ]           │  ← one primary
└──────────────────────────────────────────────────────────────┘
```

`what's read →` expands inline (no nav), with purpose strings and proof-of-exclusion:

```
│  READ ON YOUR MACHINE — today                                  │
│   • teleport-router  ~/work/teleport-router  11 conv           │
│       README, package.json — to name what you built            │
│       ̶.̶e̶n̶v̶  never read — proof of exclusion                    │  ← struck .env
│   • daybook          ~/work/daybook           4 conv           │
│       CLAUDE.md — to understand the work                       │
│  STAYED OUT — 15 repos · your client work (rule) · 1 new repo  │
│  the writing runs on your Claude subscription — that draft     │  ← cloud caveat, not hidden
│  text reaches Anthropic. the post reaches the cohort only on   │     in a footer expander
│  Post.                                            manage → ◈   │
```

**About to leave** (Post pressed — the one amber moment, scrub #2 already applied):

```
┌──────────────────────────────────────────────────────────────┐
│  ABOUT TO LEAVE YOUR MACHINE                                   │  ← amber eyebrow
│  This exact text goes to the shape-rotator cohort feed:        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ Tuesday — getting the handshake stable                  │    │  ← the literal post
│  │ Spent most of today on teleport-router… a client        │    │     (scrubbed twice)
│  │ integration — token rotation was the part… STRIPE_LIVE  │    │
│  │ ▮▮▮▮ aside for tomorrow.                                │    │
│  └──────────────────────────────────────────────────────┘    │
│  Drawn from 3 granted repos. I hid 1 client name and 2 secrets │
│  I recognized — read it once more. Lands in staging first,     │
│  deletable for a while.                                        │
│                            [ not yet ]   [ Post to cohort → ]  │
└──────────────────────────────────────────────────────────────┘
```

### 4d. Redaction-rules editor (inline composer, not a modal)

```
│  + add a rule                                                  │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ( ) never read repos under   [ ~/work/clients     ]   │    │
│  │  (•) always hide the term     [ STRIPE_LIVE        ]   │    │
│  │  ( ) abstract a client name   [ Northwind  →  "a client" ] │
│  │  ( ) include repos active in  [ 30 ] days              │    │
│  │                                  cancel    add rule →  │    │
│  └──────────────────────────────────────────────────────┘    │
```

Redaction chip tooltip (reuses `.fntip`, conceal-by-default, 1Password-style explicit reveal):

```
                  ┌─────────────────────────────────────┐
                  │ hidden — looks like an API key       │  ← --accent head
                  │ from teleport-router · auth.test.js  │
                  │ ─────────────────────────────────── │
                  │ "sk-••••••••••••••••3f0a"           │  ← masked
                  │ reveal to check ▸   always hide ▸    │  ← local-only reveal
                  └─────────────────────────────────────┘
```

---

## 5. Component & state inventory

| Component | Built on | States |
|---|---|---|
| **Scope sentence** `.scope-line` | new, serif, `.card` tint | resting · expanded (manifest) |
| **Source row** `.scope-row` | `.pill` + `.meta-row` + `.link-perm` | **included** (`--ok ●`, full path, purpose) · **excluded-by-you** (`○`, `--ink-faint`, undo) · **excluded-by-rule** (`○`, struck, "excluded by `~/clients` rule") · **new** (`--warn ●`, "NEW — include?") · **pinned** (accent ring) · **collision** (shows sibling path + which is excluded) |
| **Conversation row** `.conv-row` | `.meta-row` | included (`◉`) · excluded-by-you (`○`, undo) |
| **Rule chip** | `.fb-prefs` (`✦ learned N`) | active · editing (`✎`) · removable (`⌫`) |
| **Redaction chip** (inline in prose) | `.fn` / `.fntip` | **auto-redacted** (grey `▮▮▮`, neutral) · **rule-redacted** (`--accent`, your hide) · **client-abstracted** (`[ a client integration ]`, `--accent`) · **suggested** (dashed underline, "hide? · not a secret") · **revealed** (local-only, transient) |
| **Manifest line** | `.link-sub` | name · full path · conv count · files read · purpose clause · struck `.env` |
| **New-repo notice** | `.quiet-banner` (`--warn`) | "NEW — out by default. Include?" |
| **"About to leave" confirm** | footer inline | idle (Post) · open (literal post, `--warn`) · posting (`Posting…`) · staged (`--ok` ✓) |
| **Undo toast** | inline, ~6s | exclusions & rule-adds only (never inclusion) |

**New tokens (three, all derived from existing values):** `--mask: rgba(255,255,255,0.14)` (neutral redaction block); plus the semantic *aliases* `--stays-local: var(--ok)`, `--leaves-write: var(--accent)`, `--leaves-post: var(--warn)` so the data-flow code reads itself. No new hues, no new alarm red.

---

## 6. Microcopy library

| Context | Verbatim string |
|---|---|
| Scope sentence (daily) | `Today's digest read 3 repos and 11 conversations on your machine. 15 repos and your client work stayed out. I hid 2 secrets I recognized.` |
| Scope view headline / sub | `what the Router can see` / `I read the repos you're actively working in, hide the secrets I recognize, and keep everything else out. You set the rules; I do the rest — and detection is best-effort, so read the draft.` |
| Count as a noun (grant) | `I'll read 3 repos. README, package.json and CLAUDE.md only — never .env or source.` |
| Standing roll-up (serif) | `The Router sees 3 repos and today's conversations in them. 15 repos and your client work stay out.` |
| Repo purpose tooltip | `README, package.json, CLAUDE.md to name the project; today's conversations for the reflection. Never .env, source, or git history.` |
| Auto-exclude caption | `excluded by rule ~/clients — review rule` |
| Collision caption | `also found ~/clients/api — that one is excluded by rule` |
| New-repo notice | `NEW — worked on today, out by default. Include it?` |
| Redaction tooltip (auto) | `hidden — looks like a secret. Hidden before any text left your machine. reveal to check ▸  always hide ▸` |
| Redaction tooltip (rule) | `hidden by your rule. Shown to the cohort as "a client". reveal to check ▸` |
| Suggested chip | `I think this is a secret — hide it?   ·   not a secret` |
| Trust line (daily, both hops) | `Nothing here has left your machine yet — except the draft text that went to your Claude subscription to write this. Post sends the text above to the shape-rotator feed, staged first.` |
| Trust line (manifest, serif) | `This exact text goes to the cohort feed — and it lands in staging first, deletable for a while.` |
| Manifest counts | `Drawn from 3 granted repos. I hid 1 client name and 2 secrets I recognized — read it once more.` |
| Honesty caveat (cloud) | `Not "nothing leaves your machine" — the writing runs on your Claude subscription, so that draft text reaches Anthropic. Only the granted repos are ever read, only the scrubbed text is sent, and nothing posts to the cohort until you press Post.` |
| Device-link unify line | `This also governs device-link. Raw logs you share with another computer obey these same rules and are scrubbed the same way. Raw sharing is OFF.` |
| Empty / zero-scope | `Quiet scope — no repos granted yet. Nothing to post means nothing leaves. Open Scope to let the Router see a repo when you're ready.` |
| Thin day | `Quiet day — what's in scope didn't have much worth a cohort post. Nothing posts.` |
| Detection-held (fail-closed) | `One conversation has something I can't classify but that smells like a secret. I held it out and didn't send it. Look it over.` |
| Undo toasts | `acme-billing excluded — undo` / `rule added — undo` |
| First-run band | `First time here — so you know how this works. I read your sessions on this machine, write the draft on your Claude subscription (that text reaches Anthropic), and post to the cohort only when you press Post. I scoped myself: 2 repos active this week are in, everything older and anything under ~/clients stayed out, secrets I recognize are hidden. Look right?` |
| Buttons | `Save scope →` · `Grant access →` · `Post to cohort →` (in-flight `Posting…`) · `Skip today` · `not yet` · `looks good` |

---

## 7. Key flows

**First-run.** Join Router → first `collect()` derives scope (active-30d in, name/path rules out, unknown out-and-surfaced) → reassurance band (4a) above the first draft, cloud caveat stated → `looks good` and post, or `review scope →`. Zero setup friction; safe scope is free.

**Daily review.** Open → `collect()` honors scope, runs **scrub #1** before `spawn('claude')` → model returns → **scrub #2** over the post + always-hide terms → strip + draft render (4c). Read the sentence, optionally hover a chip, `Post →` → "about to leave" confirm shows the literal twice-scrubbed text → `Post to cohort →` → `Posting…` → `--ok` staged.

**Exclude a repo.** Two calm paths. *Manual:* in the manifest/scope list, click the row → moves to OUT, pinned-by-you → toast `acme-billing excluded — undo`. Effective on the **next** collect. *By rule (better):* `+ add a rule` → `never read repos under ~/clients` → every present and future sibling out forever, each annotated "excluded by `~/clients` rule".

**Exclude a conversation.** `IN SCOPE NOW` → `choose conversations →` on a repo → toggle `◉/○` a session by title → excluded conversations are dropped at `collectToday` before `buildDigest`. (Requires session identity in `record()` — see §8.)

**Add a redaction rule.** From a chip tooltip (`always hide ▸`) or the composer (4d) → writes to `redactions.json` → applied deterministically to digest and post and device-link, every future run → today's chip updates live to `rule-redacted` (accent).

**Undo / recover.** Every exclusion and rule-add emits an undo toast. Reveal is local-only and never re-enters the outgoing string. **Inclusion is never retroactive** — a newly-included repo's content first appears in the next pre-send preview; you can never "un-send" something already given to `claude -p`.

**Thin day / zero scope.** A small scope is first-class, never punished. If scope is empty or quiet, the graceful state renders (microcopy above), nothing posts, and `Open Scope →` is one click away. If the scrubber **can't classify** something secret-shaped, it fails *closed*: holds that conversation, sends nothing, and surfaces it for the user to inspect or strip.

---

## 8. Implementation map

**`src/transcripts.js` — allowlist, full-path keying, conversation identity, the scrubber.**
- Re-key projects on **full repo path**, not `path.basename(cwd)` (today `:127`, `:199`). `record()` (`:80`) gains a stable `key = fullCwdPath`; the UI label stays the basename but disambiguates on collision. Fixes the silent name-collision leak (`~/work/api` vs `~/clients/api`).
- `collectToday(date, scope)` accepts an allow/deny set; `collectClaude`/`collectCodex` filter by granted full paths **before** reading, and skip excluded conversations by session id.
- Retain **session identity**: `record()` keeps a per-session map (sessionId → {title-from-firstUser, msgCount, source}) so per-conversation toggles are real, not implied.
- New `redact(text, rules)` deterministic pass returning `{ masked, findings:[{type, source, original, maskedAs, confidence}] }`. It scrubs **all leak vectors**: `firstUser` (`:96`), the `Files touched` filenames (`:228` — `path.basename` of a file can itself be a client/secret name), per-message text, and the project label. Detectors: known key shapes (`sk-…`, `ghp_…`, AWS, JWT, `.env`-style `KEY=value` lines, high-entropy tokens) + user `redactions.json` terms. `confidence: low` findings render as *suggested* (dashed) chips.
- **Fail-closed:** if a granted session contains secret-shaped content the pass can't confidently classify, `collectToday` flags it `held:true` and excludes it from the digest until the user clears it.

**`src/reflect.js` — scrub before AND after the model.**
- **Scrub #1:** run `redact()` on the digest **before** `spawn('claude')` (`:157`) so secrets never enter the prompt that reaches Anthropic. (Today the digest is sent verbatim.)
- **Scrub #2:** run the *same* `redact()` + always-hide terms on `obj.post` / headline (`:93`) **after** the model returns, **before** it reaches the renderer/staging/Router. The chips and counts in the UI bind to this final string. Keep the prompt's HARD SAFETY RULES (`:57`) as defense-in-depth only.

**`src/link.js` — close the backdoor.**
- Route `readRawLogs` (`:43-71`) through the **same** `scope` allowlist and the **same** `redact()` over each file's content (`:52` `fs.readFileSync`), so device-link can never ship an unredacted `.jsonl` or a repo the user excluded.
- Flip `perm-raw` to **default OFF** (`renderer/index.html:166`); surface its state in the Scope view's device-link card.

**`src/preferences.js` / new `src/scope.js` — persisted state.**
- New `~/.router-daybook/scope.json` (full-path allow/deny + rules + per-conversation excludes) and `redactions.json` (always-hide terms / client abstractions), alongside the existing `notes.jsonl`/`patterns.json`. Reuse the preferences read/write pattern.

**`src/main.js` + `src/preload.js` — new IPC.**
- `scope:get → { summary, rules[], included[], excluded[], newRepos[], collisions[] }`
- `scope:setRule`, `scope:override(fullPath, include|exclude)`, `scope:setConversation(sessionId, include|exclude)`
- `scope:preview → { post, digestFindings[], postFindings[], readFiles[], excludedCount, held[] }` (the twice-scrubbed result for today)
- `redaction:rule(add/edit/remove)`, `redaction:reveal(findingId)` (local-only, returns original, never re-sent)
- `collect()` extended to honor scope and return `{ excludedCount, redactions, held }` so the scope sentence and manifest are real numbers, not placeholders.

**`renderer/` — surfaces.**
- `index.html:143` (`#projlist`) → the inline `.scope-line` + `what's read` expander; `:22` add `◈ Scope` `.head-link`; add `#scope` `<section class="card">`.
- `app.js:88` (`setView`) gains `scope`; render rows from `scope:get`; chips via existing `showTip`/`.fntip`; undo toasts; "about to leave" confirm on the footer.
- `styles.css:1-16` add `--mask` + the three semantic aliases; new `.scope-line`/`.scope-row`/`.conv-row` reuse `.pill`/`.meta-row`/`.fb-prefs`/`.fntip`/`.link-perm`.

**The real privacy upgrade, stated plainly:** redaction stops being an LLM instruction and becomes a deterministic local pass that runs on the actual outgoing bytes at **both** egress hops and on the device-link path — with the chips/counts bound to the final post, fail-closed on unknown secrets, and honest that detection is best-effort.

---

## 9. What makes it incredible (and the risks)

**Incredible:**
1. **The gate is real at both ends and on every path.** Deny-by-default scope upstream, a literal twice-scrubbed preview downstream, and the *same* scope + scrubber governing device-link — so the privacy promise isn't quietly false anywhere. This is the synthesis of the Ledger's preview, Scope-grant's possession model, and Rules-and-calm-defaults' architecture, with all three privacy holes closed.
2. **Redaction you can watch happen, honestly framed.** Inline chips bound to the *actual outgoing post*, hover-to-verify, conceal-by-default reveal, your-hides-vs-machine-hides color-coded — and never a completeness claim. "I hid the 2 I recognized — read the draft" beats a false "all clear."
3. **A forty-repo problem collapses to one honest sentence.** Rules over toggles; the safe default costs nothing; the system explains its own decisions ("excluded by `~/clients` rule"). It answers all three founding complaints (too complicated, too confusing, not privacy-conscious) with the same artifact.
4. **It's native, not bolted on.** Reuses `.pill`, `.meta-row`, `.fb-prefs`, `.fntip`, `setView`+`.fade`, the serif/sans split, one `.btn.primary` per surface, and the README's exact honest register — three new tokens, no new hues, no new alarm red.

**Risks to watch:**
1. **Detector recall is now a UX commitment.** Lean toward visible over-redaction with easy per-chip reveal/"this is fine"; keep *suggested* (dashed) distinct from confident chips so the user always knows where the machine is unsure; never let copy imply exhaustiveness.
2. **Stale/over-eager defaults silently dropping work the user wanted in.** Mitigated by always naming the excluded count, surfacing newly-active-but-dropped repos as an explicit "kept it out — right?" nudge (not just a count), and keeping the OUT list one tap away. The line between *calm* and *opaque* is whether the user trusts that what's out deserved to be out — watch it in testing.
3. **Fail-closed friction.** Holding a conversation because it "smells secret" protects the user but can feel like the app refusing to work. Keep the held-item copy specific and the clear/strip action one click, so the safe path stays the calm path rather than a wall.
