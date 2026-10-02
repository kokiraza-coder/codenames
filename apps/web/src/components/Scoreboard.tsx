import type { ClientGameState } from '@codenames/engine';

type Props = { state: ClientGameState };

export function Scoreboard({ state }: Props) {
  const active = state.turn;

  return (
    <div className="flex items-center justify-center gap-3">
      {(['red', 'blue'] as const).map((team) => {
        const isActive = active === team;
        return (
          <div
            key={team}
            className={[
              'flex min-w-24 items-baseline justify-center gap-2 rounded-lg border px-4 py-2',
              'transition-all duration-200',
              team === 'red'
                ? 'border-agent-red/40 bg-agent-red/10'
                : 'border-agent-blue/40 bg-agent-blue/10',
              isActive
                ? team === 'red'
                  ? 'ring-2 ring-agent-red shadow-[0_0_20px_-4px] shadow-agent-red/60'
                  : 'ring-2 ring-agent-blue shadow-[0_0_20px_-4px] shadow-agent-blue/60'
                : 'opacity-60',
            ].join(' ')}
          >
            <span
              className={`font-display text-2xl tabular-nums ${
                team === 'red' ? 'text-agent-red' : 'text-agent-blue'
              }`}
            >
              {state.remaining[team]}
            </span>
            <span className="text-xs uppercase tracking-widest text-neutral-400">{team}</span>
          </div>
        );
      })}
    </div>
  );
}
