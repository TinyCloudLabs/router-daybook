# Daybook v0.1 — release notes

**Daybook is now open source** → https://github.com/jameslbarnes/router-daybook

Same mission as the rest of the Router family — get what you're building out of
private Claude conversations and into one shared, searchable feed — but a
different bet on *how*.

## The family, quickly

- **teleport-router** — the *protocol*. An MCP "sync" tool + a TEE-attested
  bulletin board (hardware-isolated, attested, 1-hour staged publishing).
  Privacy-maximalist, ambient, per-conversation.
- **router-teamwork** — the *team hub*. AI auto-tagging, a card dashboard, Lark
  bots, channels/search. Feature-rich, "say sync," built for a team to track
  everything.
- **Daybook** — the *desktop client*, and the calm/restraint take.

## What makes Daybook different

- **Reads the exhaust, not the live convo.** No write-tool wired into every
  agent — it reads your local Claude Code + Codex logs and writes **one honest
  first-person reflection a day** (since your last post).
- **Human-gated.** You edit / refine / approve every post. Nothing auto-syncs.
- **Restraint is enforced, not hoped for.** A *locked eval* scores a forced
  @-mention or a manufactured ask as **worse than none** — so it shuts up unless
  it has something real. Offers and asks only when genuinely useful.
- **Private by construction.** Local log-reading, deterministic secret-scrubbing
  in code, scope deny-by-default; generation runs on *your own* Claude subscription.
- **A daily ritual** — refine-in-interview, posting streaks, plain honest prose.

If teleport-router is the *protocol* and router-teamwork is the *team dashboard*,
Daybook is the *quiet daily journal* — the lowest-friction, most private way for
one person to keep the feed fed.

MIT. Clone + `npm start` (needs the `claude` CLI + a Router key or invite). Setup
is in the [README](./README.md).

*Dedicated, as the repo says, "to the common understanding of all humanity."*
