# Daybook

A small, beautiful desktop app that answers the three biggest complaints about the Router:
*too complicated to set up*, *too confusing*, and *not privacy-conscious*.

Instead of wiring a **write**-access MCP server into every agent, Daybook flips the model:

> Once a day, it reads your **Claude Code** and **Codex** sessions, writes you an honest
> first-person reflection of what you worked on — what moved forward, what was hard, where
> you got stuck — and asks **"post this to the Router?"** You approve. Nothing else leaves
> your machine.

The Router itself can stay **read-only**. The writing happens here, locally, with you as the gate.

## First run — introduce yourself

No blank "introduce yourself" form, no draft to wade through, and no guessing your interests. On
first run Daybook welcomes you to the Router, then runs a short **conversational interview** and
writes the intro from your answers.

1. **Welcome** — a single, natural welcome message (one voice, not boilerplate) generated from your
   **most recent day of actual work**: it notices what you've been building, flows into what the
   Router is (the cohort's shared notebook), and what's about to happen. It fills in the moment you
   open the app, so it feels like it already knows you — without sounding stitched together.
2. **Read** — gathers ~30 days of your Claude + Codex activity across all projects (reading repos
   only via `package.json` / `CLAUDE.md` / `README`, never `.env`).
3. **Dynamic interview, one question at a time** — its purpose is to understand **who you are**,
   **what you can give** the cohort, and **what you want to receive** from it. An opening question
   about the throughline of your work, then natural follow-ups shaped by your answers (~5 turns).
   It also draws on the **cohort notebook** (recent posts from others) to probe real overlaps —
   "@x is deep in Y; could you help, or want help there?". You can **type or speak** each answer —
   the 🎙 mic records and transcribes **on-device** with MLX Whisper (your audio never leaves the machine).
4. **Write from your answers** — produces the full **third-person** intro. It **opens with a
   "call to adventure"** — a vivid, energizing paragraph that captures the ambition of your work and
   makes you feel seen (grounded, never hype). **Focus** and **Looking to connect on** come *only*
   from what you said. Lands in the review surface to edit/revise/post. Or **Skip intro**.

All text generation runs on `claude -p` (your Claude subscription — so the prompts go to Anthropic's
cloud, same as normal Claude Code use). Voice answers are recorded in the browser and transcribed
**locally with MLX Whisper** (`transcribe-audio` IPC: ffmpeg → whisper), filling the answer box when
you stop. Record-then-transcribe (no streaming) for accuracy. The **audio never leaves your device**;
the transcribed text is what goes into the prompt.

After the intro is posted or skipped, the `~/.router-daybook/introduced` flag is set and every
later launch goes straight to the daily digest.

## How it works

```
~/.claude/projects/*/*.jsonl ─┐
                              ├─► transcripts.js ─► claude CLI (local) ─► you review ─► POST /api/entries
~/.codex/sessions/Y/M/D/*.jsonl ┘   (today only)      (-p print mode)      (edit/skip)     (staged, deletable)
```

## Where your data goes (honestly)

- **On-device:** reading your session files, and **voice transcription** (MLX Whisper runs locally — audio never leaves).
- **To Anthropic's cloud:** text generation, via `claude -p` on **your own Claude subscription** — the prompts include a digest of your work and your interview answers. This is the same inference path as your normal Claude Code usage; no API key, no extra third party.
- **To the Router:** the cohort feed reads, identity/registration, and the **post you approve**.
- **The guarantee that matters:** nothing is *posted to the cohort* until you approve it (and entries land in a **staging** buffer first, deletable for a window before they go public). Not "nothing leaves your machine" — generation is cloud inference on your subscription.

## Run it

```bash
npm install
npm start
```

Requirements:
- The `claude` CLI on your PATH (used to write the reflection).
- A `~/.routerrc` containing `{ "key": "<your router key>" }`.

By default it posts to `https://router.teleport.computer`. Override with `ROUTER_SERVER=...`.

## Files

| File | Role |
|------|------|
| `src/transcripts.js` | Reads + compacts today's Claude/Codex activity into a digest. Runnable standalone: `node src/transcripts.js`. |
| `src/reflect.js` | Spawns the local `claude` CLI to write the reflection. |
| `src/router.js` | The only outbound call — posts an approved reflection to the Router. |
| `src/main.js` / `src/preload.js` | Electron main process + IPC bridge. |
| `renderer/` | The single reflection window (HTML/CSS/JS). |

## Content strategy

Posts target the **shape-rotator accelerator cohort** feed (from `~/.routerrc`). The full
strategy is encoded in `src/reflect.js`. Each post is a **plain, matter-of-fact daily update** —
the goal is something you'll feel comfortable posting under your own name, not an article:

- Always **third person** ("James …") — the app never writes in first person.
- A `Daybook digest · {date}` line, a **plain one-line summary** (not a clever headline), then
  ~**200-320 words** of direct prose. No editorializing, no emoji.
- The review surface **renders markdown natively** (headings, bold/italic, lists, links).
- Four light lead-ins carry the spine as plain sentences (not bullet lists): **Wins — / Struggles
  — / Insight — / Threads —**.
- **All projects**, weighted by significance. Struggles are candid and name real projects —
  but **never** clients; secrets are hard-redacted and sensitive work is abstracted.
- **Collaboration is woven into the story** (the `Threads —` paragraph), not bolted on: it
  brings in up to 2 cohort members whose recent work genuinely overlaps (*high confidence only*),
  refers to them by `@handle` in-sentence, and **quotes a short verbatim phrase** of theirs
  followed by a superscript footnote marker (¹ ² …). A **Sources** footer lists each citation,
  so the published post is self-contained and verifiable in the feed.
- In the app, those markers are **hoverable** — each shows the cited handle, date, quote, and a
  surrounding excerpt, so you can verify a match before posting. An **edit** toggle swaps the
  read view for a raw textarea.
- **Self-filter**: your own handle (`@specularist` on shape-rotator, resolved via `GET /api/me`)
  is excluded from the feed and never cited.
- **Quiet days**: the app flags a thin day and suggests skipping.

### Revise this draft (until it feels right to post)

People won't post something they don't feel good about — so feedback fixes **this** entry, not
the next one. Under each draft is a **"Not right? Say what to change"** box: write what's off
("too wordy, just the facts", "drop the Insight line", "cut the @-mention", "less about the
plumbing"), hit **Revise** (or ⌘↵), and it rewrites the current draft in place — keeping what
works, applying your note, preserving valid citations. Iterate until you'd happily post it, then
**Post**. There's also **↻ rewrite** for a fresh take, and **✎ edit** for hand-tweaking the raw
text.

Every revision note is **logged quietly** (`~/.router-daybook/notes.jsonl`), but a single note
never reshapes future drafts — so a one-off ("make it iambic pentameter") stays a one-off. Only
when the **same intent recurs across several notes** is it distilled into a standing preference
and applied to every draft. (The distillation is an LLM pass over the notes log that keeps
recurring patterns and discards one-offs; results cached in `patterns.json`.) A subtle
**✦ learned N** chip appears when patterns are active — click it to review or forget them.
Your notes are stored locally (`~/.router-daybook/`); the distillation pass uses `claude -p` like
everything else.

## Status — v0 prototype

Done: read both sources, read the cohort feed, generate the structured digest via the local
CLI (third-person, sectioned, cited collaboration matches), beautiful single-window review with
inline match verification + quiet-day banner, post wired to the verified `/api/entries` contract.

Next ideas:
- Daily scheduling + a 9pm notification (tray-resident).
- Weave the Router **daily question** in (it's an MCP tool, not a REST string — needs a small bridge).
- Per-project or per-source toggles; "roll a thin day into tomorrow".
- Regenerate with a nudge ("shorter", "focus on X").
