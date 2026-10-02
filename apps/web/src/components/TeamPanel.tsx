import type { ClientGameState, Role, Team } from '@codenames/engine';

type Props = {
  state: ClientGameState;
  me: ClientGameState['players'][number] | null;
  onSetTeam: (team: Team | null) => void;
  onSetRole: (role: Role) => void;
};

const ACCENT: Record<Team, string> = {
  red: 'border-agent-red/40 bg-agent-red/5',
  blue: 'border-agent-blue/40 bg-agent-blue/5',
};

export function TeamPanel({ state, me, onSetTeam, onSetRole }: Props) {
  const locked = state.phase === 'playing';

  return (
    <div className="grid grid-cols-2 gap-3">
      {(['red', 'blue'] as const).map((team) => {
        const members = state.players.filter((p) => p.team === team);
        const spymasters = members.filter((p) => p.role === 'spymaster');
        const operatives = members.filter((p) => p.role === 'operative');
        const onThisTeam = me?.team === team;

        return (
          <section key={team} className={`rounded-lg border p-3 ${ACCENT[team]}`}>
            <h3
              className={`mb-2 text-xs font-semibold uppercase tracking-widest ${
                team === 'red' ? 'text-agent-red' : 'text-agent-blue'
              }`}
            >
              {team}
            </h3>

            <Group title="Spymaster" players={spymasters} state={state} />
            <Group title="Operatives" players={operatives} state={state} />

            {!locked && (
              <div className="mt-3 flex flex-col gap-1.5">
                {!onThisTeam && (
                  <button
                    type="button"
                    onClick={() => onSetTeam(team)}
                    className="rounded-md border border-felt-700 px-2 py-1 text-xs hover:bg-felt-700"
                  >
                    Join {team}
                  </button>
                )}
                {onThisTeam && me?.role !== 'spymaster' && (
                  <button
                    type="button"
                    onClick={() => onSetRole('spymaster')}
                    className="rounded-md border border-felt-700 px-2 py-1 text-xs hover:bg-felt-700"
                  >
                    Become spymaster
                  </button>
                )}
                {onThisTeam && me?.role === 'spymaster' && (
                  <button
                    type="button"
                    onClick={() => onSetRole('operative')}
                    className="rounded-md border border-felt-700 px-2 py-1 text-xs hover:bg-felt-700"
                  >
                    Back to operative
                  </button>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function Group({
  title,
  players,
  state,
}: {
  title: string;
  players: ClientGameState['players'];
  state: ClientGameState;
}) {
  return (
    <div className="mb-2">
      <p className="text-[0.65rem] uppercase tracking-wider text-neutral-500">{title}</p>
      {players.length === 0 ? (
        <p className="text-sm text-neutral-600">—</p>
      ) : (
        <ul className="text-sm">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={`inline-block size-1.5 rounded-full ${
                  p.connected ? 'bg-emerald-400' : 'bg-neutral-600'
                }`}
                title={p.connected ? 'Online' : 'Disconnected'}
              />
              <span className={p.connected ? '' : 'text-neutral-500 line-through'}>
                {p.name}
              </span>
              {p.isHost && <span className="text-[0.6rem] text-neutral-500">host</span>}
              {p.id === state.you?.id && (
                <span className="text-[0.6rem] text-neutral-500">you</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
