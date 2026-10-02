import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import { WORD_PACKS } from '@codenames/words';
import { DEFAULT_RULESET } from '@codenames/engine';
import { RoomManager } from './rooms/RoomManager.ts';
import { registerHandlers } from './socket/handlers.ts';
import { loadDictionary } from './dictionary.ts';

const PORT = Number(process.env.PORT ?? 3001);
const ORIGIN = process.env.CORS_ORIGIN ?? 'http://localhost:5173';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
await app.register(cors, { origin: ORIGIN, credentials: true });

const rooms = new RoomManager();
const dictionary = await loadDictionary();

if (dictionary.available) {
  app.log.info(`Dictionary loaded: ${dictionary.size.toLocaleString()} words`);
} else {
  app.log.warn(
    'No dictionary found — the dictionary and proper-noun rules will stay permissive. ' +
      'Run `node scripts/build-dictionary.mjs` to enable them.',
  );
}

// --- HTTP ------------------------------------------------------------------

app.get('/health', async () => ({
  ok: true,
  rooms: rooms.size,
  dictionary: dictionary.available ? dictionary.size : 0,
}));

/** The lobby needs the pack list and the rule defaults before joining a room. */
app.get('/api/config', async () => ({
  wordPacks: WORD_PACKS.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    count: p.words.length,
  })),
  defaultRuleset: DEFAULT_RULESET,
  dictionaryAvailable: dictionary.available,
}));

/** Reserve a code so "New game" can hand out a shareable link immediately. */
app.post('/api/rooms', async () => ({ roomCode: rooms.freeCode() }));

// --- Socket.IO --------------------------------------------------------------

await app.listen({ port: PORT, host: '0.0.0.0' });

const io = new Server(app.server, {
  cors: { origin: ORIGIN, credentials: true },
  // Go straight to WebSocket; the HTTP long-poll fallback adds a round trip to
  // every action, which is exactly what we are trying to avoid.
  transports: ['websocket', 'polling'],
});

registerHandlers({ io, rooms, dictionary });

// Empty rooms are kept warm for a grace period, then dropped.
const sweeper = setInterval(() => {
  const evicted = rooms.evictStale();
  if (evicted > 0) app.log.info(`Evicted ${evicted} idle room(s)`);
}, 60_000);
sweeper.unref();

app.log.info(`Socket.IO listening on :${PORT}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    clearInterval(sweeper);
    io.close();
    void app.close().then(() => process.exit(0));
  });
}
