import { useState } from 'react';
import { canStart } from '@codenames/engine';
import { useRoom } from '../lib/useRoom.ts';
import { useServerConfig } from '../lib/config.ts';
import { Board } from '../components/Board.tsx';
import { Chat } from '../components/Chat.tsx';
import { ClueBar } from '../components/ClueBar.tsx';
import { GameLog } from '../components/GameLog.tsx';
import { RulesPanel } from '../components/RulesPanel.tsx';
import { Scoreboard } from '../components/Scoreboard.tsx';
import { TeamPanel } from '../components/TeamPanel.tsx';
import { TurnTimer } from '../components/TurnTimer.tsx';

type Props = {
  roomCode: string;
  name: string;
  onLeave: () => void;
};

export function RoomScreen({ roomCode, name, onLeave }: Props) {
  const room = useRoom(roomCode, name);
  const config = useServerConfig();
  const [copied, setCopied] = useState(false);

  const { state, me } = room;

  if (!state) {
    return (
      <main className="flex min-h-full items-center justify-center text-neutral-400">
        {room.status === 'error'
          ? 'Cannot reach the server. Is it running on port 3001?'
          : `Joining ${roomCode}…`}
      </main>
    );
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const startable = canStart(state);
  const amHost = me?.isHost ?? false;

  return (
    // Bound to the viewport so the board grid can stretch to fill it; the
    // sidebar scrolls internally rather than pushing the page down.
    <div className="mx-auto flex h-dvh max-w-[1400px] flex-col gap-3 overflow-hidden p-3 sm:p-4">
      {/* --- header ------------------------------------------------------ */}
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl">Codenames</h1>

        <button
          type="button"
          onClick={copyLink}
          title="Copy the invite link"
          className="rounded-md border border-felt-700 px-3 py-1.5 font-mono tracking-[0.25em] hover:bg-felt-800"
        >
          {copied ? 'Copied!' : roomCode}
        </button>

        {state.phase === 'playing' && (
          <>
            <Scoreboard state={state} />
            <TurnTimer deadline={state.turnDeadline} />
          </>
        )}

        <div className="ml-auto flex items-center gap-3 text-sm">
          {room.status !== 'connected' && (
            <span className="text-amber-400">
              {room.status === 'reconnecting' ? 'Reconnecting…' : room.status}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              room.leave();
              onLeave();
            }}
            className="text-neutral-500 hover:text-neutral-300"
          >
            Leave
          </button>
        </div>
      </header>

      {room.error && (
        <div
          role="alert"
          className="rounded-md border border-agent-red/50 bg-agent-red/10 px-3 py-2 text-sm text-agent-red"
        >
          {room.error.message}
        </div>
      )}

      {/* --- main layout -------------------------------------------------- */}
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          {state.phase === 'lobby' ? (
            <LobbyBoard
              ready={startable.ok}
              reason={startable.ok ? null : startable.error.message}
              amHost={amHost}
              onStart={room.start}
            />
          ) : (
            <Board
              state={state}
              me={me}
              pendingGuess={room.pendingGuess}
              onGuess={room.guess}
            />
          )}

          {state.phase === 'playing' && (
            <ClueBar state={state} me={me} onGiveClue={room.giveClue} onPass={room.pass} />
          )}

          {state.phase === 'finished' && (
            <GameOver
              winner={state.winner!}
              reason={state.endReason}
              amHost={amHost}
              onRematch={room.rematch}
            />
          )}
        </div>

        {/* --- sidebar ---------------------------------------------------- */}
        <aside className="flex min-h-0 flex-col gap-3">
          <TeamPanel
            state={state}
            me={me}
            onSetTeam={room.setTeam}
            onSetRole={room.setRole}
          />

          {state.phase === 'lobby' ? (
            <div className="min-h-0 overflow-y-auto">
              <RulesPanel
                ruleset={state.ruleset}
                packs={config.wordPacks}
                dictionaryAvailable={config.dictionaryAvailable}
                editable={amHost}
                onChange={room.setRuleset}
              />
            </div>
          ) : (
            <div className="flex min-h-0 flex-[2] flex-col">
              <GameLog state={state} />
            </div>
          )}

          <div className="flex min-h-32 flex-1 flex-col">
            <Chat messages={room.chat} onSend={room.sendChat} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function LobbyBoard({
  ready,
  reason,
  amHost,
  onStart,
}: {
  ready: boolean;
  reason: string | null;
  amHost: boolean;
  onStart: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-felt-700 p-10 text-center">
      <p className="max-w-sm text-neutral-400">
        Share the room code with your friends, pick teams, then start. Each team needs a
        spymaster and at least one operative.
      </p>
      {amHost ? (
        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="rounded-md bg-agent-blue px-6 py-3 font-medium text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Start game
        </button>
      ) : (
        <p className="text-sm text-neutral-500">Waiting for the host to start.</p>
      )}
      {!ready && reason && <p className="text-sm text-neutral-500">{reason}</p>}
    </div>
  );
}

function GameOver({
  winner,
  reason,
  amHost,
  onRematch,
}: {
  winner: 'red' | 'blue';
  reason: string | null;
  amHost: boolean;
  onRematch: () => void;
}) {
  return (
    <div
      className={[
        'flex flex-wrap items-center gap-4 rounded-lg border px-4 py-3',
        winner === 'red'
          ? 'border-agent-red/50 bg-agent-red/10'
          : 'border-agent-blue/50 bg-agent-blue/10',
      ].join(' ')}
    >
      <span className="font-display text-2xl">
        <span className={winner === 'red' ? 'text-agent-red' : 'text-agent-blue'}>
          {winner === 'red' ? 'Red' : 'Blue'}
        </span>{' '}
        wins
      </span>
      {reason === 'assassin' && (
        <span className="text-sm text-neutral-400">The assassin was revealed.</span>
      )}
      {amHost ? (
        <button
          type="button"
          onClick={onRematch}
          className="ml-auto rounded-md border border-felt-700 bg-felt-800 px-4 py-2 hover:bg-felt-700"
        >
          Rematch (swap sides)
        </button>
      ) : (
        <span className="ml-auto text-sm text-neutral-500">
          Waiting for the host to start a rematch.
        </span>
      )}
    </div>
  );
}
