import { useState } from 'react';
import { reserveRoomCode } from '../lib/config.ts';

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  onEnterRoom: (roomCode: string) => void;
};

export function Home({ name, onNameChange, onEnterRoom }: Props) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const ready = name.trim().length > 0;

  const createRoom = async () => {
    if (!ready) return;
    setBusy(true);
    setProblem(null);
    try {
      onEnterRoom(await reserveRoomCode());
    } catch {
      setProblem('Could not reach the server. Is it running on port 3001?');
      setBusy(false);
    }
  };

  const joinRoom = () => {
    const trimmed = code.trim().toUpperCase();
    if (!ready || !/^[A-Z0-9]{4,8}$/.test(trimmed)) {
      setProblem('Room codes are 4-8 letters and digits.');
      return;
    }
    onEnterRoom(trimmed);
  };

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-6 px-6 py-12">
      <header>
        <h1 className="font-display text-5xl tracking-tight">Codenames</h1>
        <p className="mt-1 text-neutral-400">
          Two teams. One board. Say the right word.
        </p>
      </header>

      <label className="block">
        <span className="text-xs uppercase tracking-widest text-neutral-500">Your name</span>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="e.g. Sam"
          maxLength={20}
          autoFocus
          className="mt-1 w-full rounded-md border border-felt-700 bg-felt-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-agent-blue/40"
        />
      </label>

      <button
        type="button"
        onClick={createRoom}
        disabled={!ready || busy}
        className="rounded-md bg-agent-blue px-4 py-3 font-medium text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Creating…' : 'Create a room'}
      </button>

      <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-neutral-600">
        <span className="h-px flex-1 bg-felt-700" />
        or
        <span className="h-px flex-1 bg-felt-700" />
      </div>

      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
          placeholder="ROOM CODE"
          maxLength={8}
          aria-label="Room code"
          className="min-w-0 flex-1 rounded-md border border-felt-700 bg-felt-900 px-3 py-2 font-mono tracking-[0.3em] placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-agent-blue/40"
        />
        <button
          type="button"
          onClick={joinRoom}
          disabled={!ready}
          className="rounded-md border border-felt-700 px-4 py-2 hover:bg-felt-800 disabled:opacity-40"
        >
          Join
        </button>
      </div>

      {problem && <p className="text-sm text-agent-red">{problem}</p>}
    </main>
  );
}
