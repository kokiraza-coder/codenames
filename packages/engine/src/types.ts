export type Team = 'red' | 'blue';
export type Role = 'spymaster' | 'operative';

/** What a card actually is. Only spymasters (and finished games) may see this. */
export type CardColor = Team | 'bystander' | 'assassin';

export type Card = {
  readonly word: string;
  readonly color: CardColor;
  revealed: boolean;
  /** Who flipped it, for the log and for post-game analytics. */
  revealedBy: string | null;
};

export type Clue = {
  readonly word: string;
  /** 0 and -1 (infinity) are legal when the ruleset allows them. */
  readonly count: number;
  readonly team: Team;
  readonly by: string;
  readonly at: number;
};

export type GuessLimitMode = 'standard' | 'unlimited' | 'exact';

export type Ruleset = {
  clue: {
    singleWordOnly: boolean;
    mustBeDictionaryWord: boolean;
    allowProperNouns: boolean;
    forbidBoardWords: boolean;
    forbidSharedRoots: boolean;
    allowZeroAndInfinity: boolean;
    maxClueNumber: number;
  };
  turn: {
    guessLimitMode: GuessLimitMode;
    turnTimerSec: number | null;
    spymasterTimerSec: number | null;
  };
  game: {
    assassinCount: number;
    boardSize: 20 | 25 | 36;
    wordPackIds: string[];
    customWords: string[];
  };
};

export const DEFAULT_RULESET: Ruleset = {
  clue: {
    singleWordOnly: true,
    mustBeDictionaryWord: false,
    allowProperNouns: true,
    forbidBoardWords: true,
    forbidSharedRoots: false,
    allowZeroAndInfinity: true,
    maxClueNumber: 9,
  },
  turn: {
    guessLimitMode: 'standard',
    turnTimerSec: null,
    spymasterTimerSec: null,
  },
  game: {
    assassinCount: 1,
    boardSize: 25,
    wordPackIds: ['classic'],
    customWords: [],
  },
};

export type Player = {
  readonly id: string;
  name: string;
  team: Team | null;
  role: Role;
  connected: boolean;
  isHost: boolean;
  isGuest: boolean;
};

export type Phase = 'lobby' | 'playing' | 'finished';

export type EndReason = 'all-words-found' | 'assassin' | 'conceded';

export type GameState = {
  readonly id: string;
  readonly seed: string;
  phase: Phase;
  ruleset: Ruleset;
  players: Player[];
  cards: Card[];
  /** The team whose turn it is. Null only in the lobby. */
  turn: Team | null;
  /** The clue currently in play, or null when the spymaster still owes one. */
  currentClue: Clue | null;
  /** Guesses already spent against the current clue. */
  guessesMade: number;
  startingTeam: Team;
  winner: Team | null;
  endReason: EndReason | null;
  log: LogEntry[];
  /** Monotonic, bumped on every applied action. Clients use it to order frames. */
  version: number;
  startedAt: number | null;
  endedAt: number | null;
  /** Wall-clock deadline for the current turn, when a timer is configured. */
  turnDeadline: number | null;
};

export type LogEntry =
  | { type: 'game-started'; at: number; startingTeam: Team }
  | { type: 'clue'; at: number; team: Team; by: string; word: string; count: number }
  | {
      type: 'guess';
      at: number;
      team: Team;
      by: string;
      word: string;
      color: CardColor;
      correct: boolean;
    }
  | { type: 'pass'; at: number; team: Team; by: string }
  | { type: 'timeout'; at: number; team: Team }
  | { type: 'game-ended'; at: number; winner: Team; reason: EndReason };

export type Action =
  | { type: 'give-clue'; playerId: string; word: string; count: number; at: number }
  | { type: 'guess'; playerId: string; cardIndex: number; at: number }
  | { type: 'pass'; playerId: string; at: number }
  | { type: 'timeout'; at: number };

/** Machine-readable so the client can localise; `message` is the English default. */
export type RuleViolation = {
  code: ViolationCode;
  message: string;
};

export type ViolationCode =
  | 'not-playing'
  | 'not-your-turn'
  | 'not-spymaster'
  | 'not-operative'
  | 'clue-already-given'
  | 'no-clue-yet'
  | 'no-team'
  | 'card-already-revealed'
  | 'card-out-of-range'
  | 'no-guesses-left'
  | 'clue-empty'
  | 'clue-not-single-word'
  | 'clue-not-a-word'
  | 'clue-is-board-word'
  | 'clue-shares-root'
  | 'clue-count-invalid'
  | 'clue-count-too-high'
  | 'not-enough-players'
  | 'not-enough-words';

export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; error: RuleViolation };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (code: ViolationCode, message: string): Err => ({
  ok: false,
  error: { code, message },
});
