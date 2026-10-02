import { useMemo, useState } from 'react';
import { INFINITY_COUNT, validateClue, type ClientGameState } from '@codenames/engine';

type Props = {
  state: ClientGameState;
  me: ClientGameState['players'][number] | null;
  onGiveClue: (word: string, count: number) => void;
  onPass: () => void;
};

const COUNTS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, INFINITY_COUNT];
const label = (n: number) => (n === INFINITY_COUNT ? '∞' : String(n));

export function ClueBar({ state, me, onGiveClue, onPass }: Props) {
  const [word, setWord] = useState('');
  const [count, setCount] = useState(2);

  const isMyTeamsTurn = me?.team === state.turn;
  const awaitingClue = state.currentClue === null;
  const iAmSpymaster = me?.role === 'spymaster';

  /**
   * Run the real rule engine locally. The server validates again — it has to —
   * but checking here means a spymaster learns their clue is illegal as they
   * type instead of after a round trip.
   */
  const check = useMemo(() => {
    if (word.trim().length === 0) return null;
    return validateClue(word, count, {
      ruleset: state.ruleset,
      boardWords: state.cards.map((c) => c.word),
      // The dictionary lives on the server; those rules are confirmed there.
    });
  }, [word, count, state.ruleset, state.cards]);

  const problem = check && !check.ok ? check.error.message : null;

  if (state.phase !== 'playing') return null;

  // --- waiting on the other side ------------------------------------------
  if (!isMyTeamsTurn || (iAmSpymaster && !awaitingClue) || (!iAmSpymaster && awaitingClue)) {
    return (
      <div className="rounded-lg border border-felt-700 bg-felt-800/60 px-4 py-3 text-sm text-neutral-400">
        {awaitingClue
          ? `Waiting for the ${state.turn} spymaster to give a clue…`
          : `${state.turn === 'red' ? 'Red' : 'Blue'} is guessing.`}
      </div>
    );
  }

  // --- operatives: guess or pass ------------------------------------------
  if (!iAmSpymaster) {
    const clue = state.currentClue!;
    const left =
      state.guessesAllowed === null
        ? 'unlimited guesses'
        : `${state.guessesAllowed - state.guessesMade} guess${
            state.guessesAllowed - state.guessesMade === 1 ? '' : 'es'
          } left`;
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-felt-700 bg-felt-800 px-4 py-3">
        <span className="font-display text-xl tracking-wide">
          {clue.word} <span className="text-neutral-400">·</span> {label(clue.count)}
        </span>
        <span className="text-sm text-neutral-400">{left}</span>
        <button
          type="button"
          onClick={onPass}
          className="ml-auto rounded-md border border-felt-700 px-3 py-1.5 text-sm hover:bg-felt-700"
        >
          End turn
        </button>
      </div>
    );
  }

  // --- spymaster: compose a clue ------------------------------------------
  const submit = () => {
    if (!check?.ok) return;
    onGiveClue(word, count);
    setWord('');
    setCount(2);
  };

  return (
    <div className="rounded-lg border border-felt-700 bg-felt-800 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={word}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Your clue"
          autoFocus
          maxLength={30}
          aria-invalid={problem !== null}
          className={[
            'min-w-0 flex-1 rounded-md border bg-felt-900 px-3 py-2 uppercase tracking-wide',
            'placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-500',
            'focus:outline-none focus:ring-2',
            problem
              ? 'border-agent-red/60 focus:ring-agent-red/40'
              : 'border-felt-700 focus:ring-agent-blue/40',
          ].join(' ')}
        />
        <select
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          aria-label="Number of words"
          className="rounded-md border border-felt-700 bg-felt-900 px-3 py-2"
        >
          {COUNTS.filter(
            (n) =>
              (n !== 0 && n !== INFINITY_COUNT) || state.ruleset.clue.allowZeroAndInfinity,
          )
            .filter((n) => n === INFINITY_COUNT || n <= state.ruleset.clue.maxClueNumber)
            .map((n) => (
              <option key={n} value={n}>
                {label(n)}
              </option>
            ))}
        </select>
        <button
          type="button"
          onClick={submit}
          disabled={!check?.ok}
          className="rounded-md bg-agent-blue px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Give clue
        </button>
      </div>
      {problem && <p className="mt-2 text-sm text-agent-red">{problem}</p>}
    </div>
  );
}
