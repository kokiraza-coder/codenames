import { useEffect, useRef } from 'react';
import type { ClientGameState, LogEntry } from '@codenames/engine';

type Props = { state: ClientGameState };

const teamText = (team: 'red' | 'blue') =>
  team === 'red' ? 'text-agent-red' : 'text-agent-blue';

function describe(entry: LogEntry, nameOf: (id: string) => string) {
  switch (entry.type) {
    case 'game-started':
      return (
        <>
          <span className={teamText(entry.startingTeam)}>{entry.startingTeam}</span> starts.
        </>
      );
    case 'clue':
      return (
        <>
          <span className={teamText(entry.team)}>{nameOf(entry.by)}</span> gave{' '}
          <strong className="font-semibold">
            {entry.word} {entry.count === -1 ? '∞' : entry.count}
          </strong>
        </>
      );
    case 'guess':
      return (
        <>
          <span className={teamText(entry.team)}>{nameOf(entry.by)}</span> picked{' '}
          <strong className="font-semibold">{entry.word}</strong>{' '}
          <span className="text-neutral-500">
            ({entry.color === 'assassin' ? 'the assassin' : entry.color})
          </span>
        </>
      );
    case 'pass':
      return (
        <>
          <span className={teamText(entry.team)}>{nameOf(entry.by)}</span> ended the turn.
        </>
      );
    case 'timeout':
      return (
        <>
          <span className={teamText(entry.team)}>{entry.team}</span> ran out of time.
        </>
      );
    case 'game-ended':
      return (
        <>
          <span className={teamText(entry.winner)}>{entry.winner}</span> wins
          {entry.reason === 'assassin' ? ' — the assassin was revealed.' : '.'}
        </>
      );
  }
}

export function GameLog({ state }: Props) {
  const scroller = useRef<HTMLOListElement>(null);
  const nameOf = (id: string) =>
    state.players.find((p) => p.id === id)?.name ?? 'Someone';

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-felt-700 bg-felt-900/60">
      <h2 className="border-b border-felt-700 px-3 py-2 text-xs uppercase tracking-widest text-neutral-500">
        Game log
      </h2>
      <ol ref={scroller} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-2 text-sm">
        {state.log.length === 0 && (
          <li className="text-neutral-600">Nothing has happened yet.</li>
        )}
        {state.log.map((entry, i) => (
          <li key={`${entry.type}-${entry.at}-${i}`} className="text-neutral-300">
            {describe(entry, nameOf)}
          </li>
        ))}
      </ol>
    </section>
  );
}
