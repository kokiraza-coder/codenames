import type { CardColor, ClientCard } from '@codenames/engine';

type Props = {
  card: ClientCard;
  index: number;
  /** True when this player may click it right now. */
  clickable: boolean;
  pending: boolean;
  /** The viewer holds the key, so face-down cards get a colour hint. */
  showKey: boolean;
  onGuess: (index: number) => void;
};

/** Face-up card styling. These are the colours players actually read. */
const REVEALED: Record<CardColor, string> = {
  red: 'bg-agent-red text-white border-agent-red',
  blue: 'bg-agent-blue text-white border-agent-blue',
  bystander: 'bg-bystander text-felt-900 border-bystander',
  assassin: 'bg-assassin text-neutral-400 border-neutral-700',
};

/**
 * The spymaster's hint on a face-down card: a strong tint plus a corner stripe,
 * so the key is still readable for anyone who struggles to separate the red and
 * blue by hue alone.
 */
const KEY_HINT: Record<CardColor, string> = {
  red: 'bg-agent-red-dim/70 border-agent-red ring-1 ring-agent-red/50',
  blue: 'bg-agent-blue-dim/70 border-agent-blue ring-1 ring-agent-blue/50',
  bystander: 'bg-bystander-dim/50 border-bystander/60',
  assassin: 'bg-assassin border-neutral-500 ring-2 ring-neutral-400/70',
};

const KEY_MARK: Record<CardColor, string> = {
  red: '●',
  blue: '◆',
  bystander: '',
  assassin: '✕',
};

export function Card({ card, index, clickable, pending, showKey, onGuess }: Props) {
  const revealed = card.revealed;
  const keyColor = !revealed && showKey ? card.color : undefined;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onGuess(index)}
      aria-label={
        revealed
          ? `${card.word}, revealed ${card.color}`
          : keyColor
            ? `${card.word}, secretly ${keyColor}`
            : card.word
      }
      className={[
        // No fixed aspect ratio: the grid stretches rows to fill the viewport,
        // so the board is as large as the window allows on any screen.
        'group relative size-full min-h-14 select-none rounded-lg border text-center',
        'transition-transform duration-150',
        clickable
          ? 'cursor-pointer hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:brightness-95'
          : 'cursor-default',
        pending ? 'is-pending' : '',
        revealed
          ? `${REVEALED[card.color ?? 'bystander']} shadow-inner`
          : keyColor
            ? `${KEY_HINT[keyColor]} shadow-md`
            : 'border-felt-700 bg-felt-800 text-neutral-100 shadow-md',
      ].join(' ')}
    >
      <span
        className={[
          'absolute inset-0 flex items-center justify-center px-1',
          'text-[clamp(0.6rem,1.45vw,1rem)] font-semibold uppercase tracking-wide',
          revealed && card.color === 'assassin' ? 'line-through' : '',
          revealed ? 'opacity-80' : '',
        ].join(' ')}
      >
        {card.word}
      </span>

      {keyColor && KEY_MARK[keyColor] && (
        <span
          aria-hidden
          className="absolute right-1 top-1 text-[0.6rem] leading-none opacity-80"
        >
          {KEY_MARK[keyColor]}
        </span>
      )}
    </button>
  );
}
