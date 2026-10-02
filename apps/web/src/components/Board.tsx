import type { ClientGameState } from '@codenames/engine';
import { Card } from './Card.tsx';

type Props = {
  state: ClientGameState;
  me: ClientGameState['players'][number] | null;
  pendingGuess: number | null;
  onGuess: (index: number) => void;
};

/** Column count per board size, so 20 and 36 stay rectangular. */
const COLUMNS: Record<number, string> = {
  20: 'grid-cols-5',
  25: 'grid-cols-5',
  36: 'grid-cols-6',
};

export function Board({ state, me, pendingGuess, onGuess }: Props) {
  const showKey = state.you?.canSeeKey ?? false;

  // The server is the authority on legality; this only decides what looks
  // clickable, so a player is not invited to make a move that will bounce.
  const myTurn =
    state.phase === 'playing' &&
    me?.team === state.turn &&
    me?.role === 'operative' &&
    state.currentClue !== null &&
    pendingGuess === null;

  return (
    <div
      className={[
        'grid flex-1 auto-rows-fr gap-1.5 sm:gap-2',
        COLUMNS[state.cards.length] ?? 'grid-cols-5',
      ].join(' ')}
      role="grid"
      aria-label="Codenames board"
    >
      {state.cards.map((card, index) => (
        <Card
          key={`${card.word}-${index}`}
          card={card}
          index={index}
          clickable={myTurn && !card.revealed}
          pending={pendingGuess === index}
          showKey={showKey}
          onGuess={onGuess}
        />
      ))}
    </div>
  );
}
