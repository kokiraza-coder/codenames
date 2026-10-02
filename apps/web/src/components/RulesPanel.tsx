import type { Ruleset } from '@codenames/engine';
import type { WordPackInfo } from '../lib/config.ts';

type Props = {
  ruleset: Ruleset;
  packs: WordPackInfo[];
  dictionaryAvailable: boolean;
  /** Only the host may edit; everyone else sees the rules read-only. */
  editable: boolean;
  onChange: (next: Ruleset) => void;
};

type ToggleSpec = {
  key: keyof Ruleset['clue'];
  label: string;
  hint: string;
  /** Rules that silently do nothing without the generated word lists. */
  needsDictionary?: boolean;
};

const CLUE_TOGGLES: ToggleSpec[] = [
  {
    key: 'singleWordOnly',
    label: 'One word only',
    hint: 'No spaces or hyphens in a clue.',
  },
  {
    key: 'mustBeDictionaryWord',
    label: 'Dictionary words only',
    hint: 'The clue must be a real word.',
    needsDictionary: true,
  },
  {
    key: 'allowProperNouns',
    label: 'Allow proper nouns',
    hint: 'Names of people and places are legal clues.',
    needsDictionary: true,
  },
  {
    key: 'forbidBoardWords',
    label: 'No words on the board',
    hint: 'The clue cannot be one of the 25 words.',
  },
  {
    key: 'forbidSharedRoots',
    label: 'No shared roots',
    hint: 'Blocks OCEANIC when OCEAN is on the board.',
  },
  {
    key: 'allowZeroAndInfinity',
    label: 'Allow 0 and ∞',
    hint: 'The negative clue and the unlimited clue.',
  },
];

const GUESS_MODES: Array<{ value: Ruleset['turn']['guessLimitMode']; label: string; hint: string }> = [
  { value: 'standard', label: 'N + 1', hint: 'The classic bonus guess.' },
  { value: 'exact', label: 'Exactly N', hint: 'No bonus guess.' },
  { value: 'unlimited', label: 'Unlimited', hint: 'Guess until you stop or miss.' },
];

export function RulesPanel({ ruleset, packs, dictionaryAvailable, editable, onChange }: Props) {
  const setClue = <K extends keyof Ruleset['clue']>(key: K, value: Ruleset['clue'][K]) =>
    onChange({ ...ruleset, clue: { ...ruleset.clue, [key]: value } });
  const setTurn = <K extends keyof Ruleset['turn']>(key: K, value: Ruleset['turn'][K]) =>
    onChange({ ...ruleset, turn: { ...ruleset.turn, [key]: value } });
  const setGame = <K extends keyof Ruleset['game']>(key: K, value: Ruleset['game'][K]) =>
    onChange({ ...ruleset, game: { ...ruleset.game, [key]: value } });

  const togglePack = (id: string) => {
    const current = ruleset.game.wordPackIds;
    const next = current.includes(id) ? current.filter((p) => p !== id) : [...current, id];
    // Never let the host deselect everything — there would be no words to deal.
    if (next.length === 0) return;
    setGame('wordPackIds', next);
  };

  return (
    <section className="space-y-4 rounded-lg border border-felt-700 bg-felt-900/60 p-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-xs uppercase tracking-widest text-neutral-500">House rules</h2>
        {!editable && <span className="text-[0.65rem] text-neutral-600">host only</span>}
      </header>

      <Fieldset legend="Clues">
        {CLUE_TOGGLES.map((spec) => {
          const inert = spec.needsDictionary && !dictionaryAvailable;
          return (
            <label
              key={spec.key}
              className={`flex cursor-pointer items-start gap-2 ${
                editable && !inert ? '' : 'cursor-default opacity-60'
              }`}
            >
              <input
                type="checkbox"
                checked={ruleset.clue[spec.key] as boolean}
                disabled={!editable || inert}
                onChange={(e) => setClue(spec.key, e.target.checked as never)}
                className="mt-0.5 size-4 accent-agent-blue"
              />
              <span>
                <span className="text-sm">{spec.label}</span>
                <span className="block text-xs text-neutral-500">
                  {inert ? 'Needs the generated word list — see the README.' : spec.hint}
                </span>
              </span>
            </label>
          );
        })}

        <label className="flex items-center gap-2 pt-1">
          <span className="text-sm">Highest number</span>
          <input
            type="number"
            min={1}
            max={25}
            value={ruleset.clue.maxClueNumber}
            disabled={!editable}
            onChange={(e) =>
              setClue('maxClueNumber', Math.min(25, Math.max(1, Number(e.target.value))))
            }
            className="w-16 rounded-md border border-felt-700 bg-felt-900 px-2 py-1 text-sm"
          />
        </label>
      </Fieldset>

      <Fieldset legend="Guesses">
        {GUESS_MODES.map((mode) => (
          <label key={mode.value} className="flex items-start gap-2">
            <input
              type="radio"
              name="guessLimitMode"
              checked={ruleset.turn.guessLimitMode === mode.value}
              disabled={!editable}
              onChange={() => setTurn('guessLimitMode', mode.value)}
              className="mt-0.5 size-4 accent-agent-blue"
            />
            <span>
              <span className="text-sm">{mode.label}</span>
              <span className="block text-xs text-neutral-500">{mode.hint}</span>
            </span>
          </label>
        ))}
      </Fieldset>

      <Fieldset legend="Timers">
        <TimerRow
          label="Spymaster"
          value={ruleset.turn.spymasterTimerSec}
          editable={editable}
          onChange={(v) => setTurn('spymasterTimerSec', v)}
        />
        <TimerRow
          label="Guessing"
          value={ruleset.turn.turnTimerSec}
          editable={editable}
          onChange={(v) => setTurn('turnTimerSec', v)}
        />
      </Fieldset>

      <Fieldset legend="Board">
        <label className="flex items-center gap-2">
          <span className="text-sm">Size</span>
          <select
            value={ruleset.game.boardSize}
            disabled={!editable}
            onChange={(e) => setGame('boardSize', Number(e.target.value) as 20 | 25 | 36)}
            className="rounded-md border border-felt-700 bg-felt-900 px-2 py-1 text-sm"
          >
            <option value={20}>20 cards</option>
            <option value={25}>25 cards (classic)</option>
            <option value={36}>36 cards</option>
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm">Assassins</span>
          <input
            type="number"
            min={0}
            max={3}
            value={ruleset.game.assassinCount}
            disabled={!editable}
            onChange={(e) =>
              setGame('assassinCount', Math.min(3, Math.max(0, Number(e.target.value))))
            }
            className="w-16 rounded-md border border-felt-700 bg-felt-900 px-2 py-1 text-sm"
          />
        </label>

        <div className="pt-1">
          <p className="text-xs uppercase tracking-wider text-neutral-500">Word packs</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {packs.map((pack) => {
              const on = ruleset.game.wordPackIds.includes(pack.id);
              return (
                <button
                  key={pack.id}
                  type="button"
                  disabled={!editable}
                  onClick={() => togglePack(pack.id)}
                  title={`${pack.description} (${pack.count} words)`}
                  className={[
                    'rounded-full border px-3 py-1 text-xs transition-colors',
                    on
                      ? 'border-agent-blue bg-agent-blue/20 text-neutral-100'
                      : 'border-felt-700 text-neutral-400 hover:bg-felt-800',
                    editable ? '' : 'cursor-default',
                  ].join(' ')}
                >
                  {pack.name}
                </button>
              );
            })}
          </div>
        </div>
      </Fieldset>
    </section>
  );
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="mb-1 text-[0.65rem] uppercase tracking-wider text-neutral-500">
        {legend}
      </legend>
      {children}
    </fieldset>
  );
}

const TIMER_CHOICES = [null, 60, 120, 180] as const;

function TimerRow({
  label,
  value,
  editable,
  onChange,
}: {
  label: string;
  value: number | null;
  editable: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="w-20 text-sm">{label}</span>
      <select
        value={value === null ? 'off' : String(value)}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value === 'off' ? null : Number(e.target.value))}
        className="rounded-md border border-felt-700 bg-felt-900 px-2 py-1 text-sm"
      >
        {TIMER_CHOICES.map((choice) => (
          <option key={String(choice)} value={choice === null ? 'off' : String(choice)}>
            {choice === null ? 'Off' : `${choice / 60} min`}
          </option>
        ))}
      </select>
    </label>
  );
}
