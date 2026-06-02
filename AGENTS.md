# AGENTS.md — working notes for agents on Daybook

Guidance for AI agents (and humans) working in this repo. Read this before making
changes; it records *why* things are the way they are so you don't undo deliberate
decisions.

## What this app is

**Daybook** (Electron desktop app; package name `router`, productName `Router`) reads
your local **Claude Code** (`~/.claude/projects/*/*.jsonl`) and **Codex**
(`~/.codex/sessions/...`) sessions, writes a first-person daily reflection via the
local `claude -p` CLI, and — only when you approve — posts it to the **Router**, a
cohort's shared read-only feed (`https://router.teleport.computer`, override with
`ROUTER_SERVER`).

Product values, in priority order: **simple, calm, privacy-conscious.** The three
founding complaints it exists to fix are *too complicated*, *too confusing*, and *not
privacy-conscious*. When in doubt, choose the simpler, quieter option.

## Run it

```bash
npm install
npm start            # launches Electron (electron .)
npm run collect      # node src/transcripts.js — prints today's digest, standalone
```

Requirements: the `claude` CLI on PATH; a `~/.routerrc` with `{ "key": "<router key>" }`.
Persisted app state lives in `~/.router-daybook/` (not the repo): `scope.json`,
`redactions.json`, `notes.jsonl`, `patterns.json`, `introduced` flag.

### ⚠️ Electron does not hot-reload
Editing `renderer/` or `src/` does **nothing** to a running window. You must restart:

```bash
pkill -f "router-daybook/node_modules/electron"; npm start
```

`node --check <file>` catches syntax only — not runtime `ReferenceError`s. After
renderer edits, cross-check that every `$('id')` in `app.js` exists in `index.html`
(a missing element silently breaks init). There are no automated tests; verify by
launching.

## Architecture / file map

| File | Role |
|------|------|
| `src/main.js` | Electron main process; registers all `ipcMain` handlers; threads scope into the collect/generate flow. |
| `src/preload.js` | `contextBridge` — the **only** renderer↔main surface (`window.daybook.*`). Every channel here must have a matching `ipcMain.handle`. |
| `src/transcripts.js` | Discovers + compacts sessions into a digest. Scope-filters **before reading**; masks secrets across all digest fields. Standalone-runnable. |
| `src/reflect.js` | Spawns `claude -p` to write the post. **Scrubs the digest before the spawn and the generated post after.** |
| `src/intro.js` | First-run conversational interview + intro write. Also reads repos (only `package.json`/`CLAUDE.md`/`README`, never `.env`). |
| `src/scope.js` | Per-repo scope store (`scope.json`), keyed on **full path**, deny-by-default. |
| `src/redact.js` | The deterministic secret scrubber (see below). Pure, no I/O, never throws. |
| `src/link.js` | Device-link (pairing-code TCP + SSH) to pull a peer's work. Raw-log paths are scope-gated + scrubbed. |
| `src/router.js` | The single outbound post to the Router. |
| `renderer/` | Single-window vanilla-JS UI (`index.html`, `app.js`, `styles.css`). |
| `docs/access-redaction-ux.md` | The original design spec the access/redaction work was built from (more elaborate than what shipped — see "What we simplified"). |

IPC convention: link/legacy channels are kebab (`link-host-start`); the access
feature uses namespaced channels (`scope:get`, `scope:override`,
`scope:setConversation`, `scope:preview`, `redaction:rule`, `redaction:reveal`).

## The privacy model (don't quietly weaken this)

Two things leave the machine, and the UI must stay honest about both:
1. **The digest → Anthropic** via `claude -p` (cloud inference on the user's own
   subscription). This *always* happens to write the post.
2. **The approved post → the Router cohort**, only on Post.

Never claim "nothing leaves your machine."

**Secret scrubbing (`src/redact.js`)** is *deterministic code*, not a prompt
instruction. `redact(text, rules)` masks recognized secrets — API keys (`sk-`,
`ghp_`…), AWS, JWT, `KEY=value` env lines, long hex/base64 — with grey `▮` blocks,
and applies the user's always-hide terms + client abstractions. It runs:
- on the **digest** before `spawn('claude')` in `reflect.js` (so secrets never enter
  the prompt sent to Anthropic),
- on the **generated post** after the model returns, and
- on **device-link** raw content (`link.js`), which is also scope-gated; raw sharing
  defaults **off**.

It's **best-effort** — detection has false negatives. Never write copy that claims
it caught everything.

**Scope (`src/scope.js`)** is keyed on **full repo path** (not basename — same-named
repos in different dirs must not collide) and is **deny-by-default**; sources are
filtered *before* reading.

## What we simplified (recent work — keep it this way unless asked)

The codebase still contains a more elaborate access/redaction system (rules engine,
per-conversation toggles, redaction-term editor, device-link card, the design spec in
`docs/`). The **UI was deliberately stripped down** based on user feedback. Do not
"restore" these surfaces without being asked:

- **Scope view (`#scope`) = one job:** a flat checklist of repos with recent activity,
  each a checkbox (on = in scope). No rules UI, no per-conversation toggles, no
  redaction-term editor, no search, no device-link card. (`renderScopeManager` /
  `repoRow` in `app.js`.) Toggling writes an `scope:override` include/exclude, which
  wins over everything.
- **Daily review screen has NO banners / NUX.** Removed: the first-run reassurance
  band, the daily scope sentence, the trust line, the "held conversation" amber
  banner, the inline redaction chips, and the "about to leave" confirm. Post now posts
  directly (secrets are scrubbed in the `post` handler regardless). The screen is just:
  stats → draft → "say what to change" → Post.
- **No fail-closed "held conversations."** `redact()` still computes a `suspect` flag,
  but `transcripts.js` no longer drops/holds whole sessions on it — that fired on
  harmless high-entropy strings (git SHAs, UUIDs, base64) and confused users. Secrets
  are *masked* inline; sessions are not withheld.
- Backend IPC for rules/conversations/redaction (`scope:setRule`,
  `scope:setConversation`, `redaction:*`) still exists but is **unused by the UI**.
  Leave it; it's harmless and the scrubber still runs underneath.

The underlying scrubbing stays **on but silent**: it's protection, not UI.

## Known gaps / TODO

- **Detector recall:** `redact.js` misses some common formats — notably Slack tokens
  (`xoxb-…`), Stripe (`sk_live_`), and a few others — with `suspect=false`, so they'd
  pass through. Adding those prefix detectors is the obvious next privacy win.
- Some **dead code** remains in `app.js` (e.g. `decorateRedactions`, the `.rdx`
  reveal/tooltip handlers) and unused CSS for the removed banners — harmless, fine to
  clean up.

## Conventions

- **Voice:** plain, honest, calm, lowercase-ish, no hype, **no emoji** in user-facing
  prose. See the README's "Where your data goes (honestly)" register.
- Vanilla JS in `renderer/` (no framework); CommonJS in `src/`. Match surrounding style.
- No new npm deps without reason; Node builtins + Electron only.
- Serif (`--serif`) for human/reassuring text; sans for controls. One `.btn.primary`
  per surface.

## Repo / housekeeping

- Git repo on `main`; private remote `origin` → `github.com/jameslbarnes/router-daybook`.
- **Gitignored on purpose:** `node_modules/`, `.backups/` (local pre-edit snapshots),
  and **`interviews/`** — the user's *personal* interview transcripts (real personal
  reflections, not code). Do **not** commit `interviews/`.
- End commit messages with the standard `Co-Authored-By:` trailer.
