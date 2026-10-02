import { useEffect, useState } from 'react';
import { DEFAULT_RULESET, type Ruleset } from '@codenames/engine';

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';

export type WordPackInfo = {
  id: string;
  name: string;
  description: string;
  count: number;
};

export type ServerConfig = {
  wordPacks: WordPackInfo[];
  defaultRuleset: Ruleset;
  dictionaryAvailable: boolean;
};

const FALLBACK: ServerConfig = {
  wordPacks: [],
  defaultRuleset: DEFAULT_RULESET,
  dictionaryAvailable: false,
};

/** Fetched once; the lobby needs the pack list before a room exists. */
export function useServerConfig(): ServerConfig {
  const [config, setConfig] = useState<ServerConfig>(FALLBACK);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${SERVER_URL}/api/config`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setConfig)
      .catch(() => {
        /* The lobby still works with defaults; the server reports the truth. */
      });
    return () => controller.abort();
  }, []);

  return config;
}

export async function reserveRoomCode(): Promise<string> {
  const response = await fetch(`${SERVER_URL}/api/rooms`, { method: 'POST' });
  if (!response.ok) throw new Error('Could not reach the server.');
  const body = (await response.json()) as { roomCode: string };
  return body.roomCode;
}
