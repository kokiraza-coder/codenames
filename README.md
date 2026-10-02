# Codenames

A web Codenames clone, built for speed: live game state lives in server memory and is
pushed over a WebSocket. Postgres is reserved for identity and history (phase 2+) and is
never in the path of a card flip.

## Running it

```bash
npm install
npm run dictionary      # optional; enables the dictionary + proper-noun rules
npm run dev             # server on :3001, web on :5173
```

Open http://localhost:5173, create a room, and share the link. Four players minimum:
a spymaster and an operative on each side.

## Layout

```
apps/
  web/        React 19 + Vite + Tailwind 4
  server/     Fastify + Socket.IO, in-memory rooms
packages/
  engine/     Pure game rules — no I/O, no clock, no randomness
  protocol/   Zod schemas for every socket message
  words/      Word packs, Porter stemmer, dictionary loader
```

### The engine is pure on purpose

`packages/engine` is a set of pure functions: `(state, action) => state | RuleViolation`.
The caller injects the seed and the timestamp. That means the server can run it as the
authority *and* the client can run the identical code to validate a clue inline, with no
round trip — which is why an illegal clue greys out the submit button as you type.

### The key card never leaves the server

Every outbound payload goes through one function, `projectStateFor(state, viewerId)`. For
a face-down card seen by a non-spymaster it emits `{ word, revealed: false }` with **no
colour field at all** — not null, not masked, absent. `project.test.ts` asserts this over
the serialised JSON, and the socket integration tests assert it again over a real wire.

### House rules

Each room picks a `Ruleset` in the lobby, frozen at game start and stored with the game.
All checks are deterministic and in-process (< 5 ms, no network, no LLM): one-word-only,
dictionary words only, no proper nouns, no board words, no shared roots (Porter stemming,
so OCEANIC is blocked when OCEAN is on the board), 0/∞ clues, guess-limit mode, timers,
board size, assassin count and word packs.

The dictionary is generated, not committed — `npm run dictionary` builds it from the
system word list (public domain). Without it, the two dictionary-dependent rules stay
permissive rather than rejecting every clue.

## Verifying

```bash
npm test          # 81 tests: engine rules, projection, stemmer, socket integration
npm run typecheck # server + web
```

The socket tests run a real Socket.IO server over a real port and drive four clients
through a full game, including a mid-game disconnect and reconnect.

## Status

Phase 1 (playable core) is done. Phases 2-4 — accounts, friends, Glicko-2 ratings,
head-to-head stats and the friends leaderboard — are specified in the plan file.
