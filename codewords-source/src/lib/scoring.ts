export type PlayerStats = {
  user_id: string;
  op_games: number;
  op_wins: number;
  op_correct: number;
  op_wrong: number;
  op_bystander: number;
  op_assassin: number;
  sm_games: number;
  sm_wins: number;
  sm_clues: number;
  sm_cards_cleared: number;
  sm_assassin: number;
};

/** Operative points: reward correct picks and wins, penalise mistakes. */
export function operativeScore(s: PlayerStats) {
  return s.op_correct * 10 + s.op_wins * 25 - s.op_wrong * 5 - s.op_bystander * 2 - s.op_assassin * 20;
}

/** Spymaster points: reward cards their team cleared and wins, penalise assassin losses. */
export function spymasterScore(s: PlayerStats) {
  return s.sm_cards_cleared * 10 + s.sm_wins * 30 - s.sm_assassin * 20;
}

export function operativeAccuracy(s: PlayerStats) {
  const total = s.op_correct + s.op_wrong + s.op_bystander + s.op_assassin;
  return total === 0 ? 0 : Math.round((s.op_correct / total) * 100);
}

export function clueEfficiency(s: PlayerStats) {
  return s.sm_clues === 0 ? 0 : Math.round((s.sm_cards_cleared / s.sm_clues) * 10) / 10;
}

export function winRate(wins: number, games: number) {
  return games === 0 ? 0 : Math.round((wins / games) * 100);
}

export const SCORING_RULES = {
  operative: "+10 correct card · +25 win · −5 enemy card · −2 bystander · −20 assassin",
  spymaster: "+10 per card your team clears · +30 win · −20 if your team hits the assassin",
};
