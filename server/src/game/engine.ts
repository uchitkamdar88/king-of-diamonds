import {
  CLASSIC_MULTIPLIER,
  ELIMINATION_SCORE,
  KINGS_DECREE_MULTIPLIER,
  type ActiveRule,
  type RoundRuleInfo,
} from "@kod/shared";

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function ruleForRound(round: number, totalRounds: number): RoundRuleInfo {
  if (round === totalRounds) {
    return {
      id: "KINGS_DECREE",
      title: "KING'S DECREE",
      description: "The multiplier collapses to 0.70. Think deeper.",
      multiplier: KINGS_DECREE_MULTIPLIER,
    };
  }
  if (round >= 7) {
    return {
      id: "PERFECT_TARGET",
      title: "PERFECT TARGET",
      description: "Hit the exact rounded target and claim a PERFECT HIT.",
      multiplier: CLASSIC_MULTIPLIER,
    };
  }
  if (round >= 4) {
    return {
      id: "DUPLICATE_PENALTY",
      title: "DUPLICATE PENALTY",
      description: "Identical numbers are invalid and excluded from the average.",
      multiplier: CLASSIC_MULTIPLIER,
    };
  }
  return {
    id: "CLASSIC",
    title: "CLASSIC",
    description: "Target = average of all choices × 0.80.",
    multiplier: CLASSIC_MULTIPLIER,
  };
}

export interface ChoiceEntry {
  playerId: string;
  choice: number;
}

export interface ResolvedChoice extends ChoiceEntry {
  valid: boolean;
  duplicate: boolean;
}

export function markDuplicates(
  entries: ChoiceEntry[],
  rule: ActiveRule,
): ResolvedChoice[] {
  const counts = new Map<number, number>();
  for (const e of entries) {
    counts.set(e.choice, (counts.get(e.choice) ?? 0) + 1);
  }
  return entries.map((e) => {
    const duplicate = (counts.get(e.choice) ?? 0) > 1;
    const invalidByDup = rule === "DUPLICATE_PENALTY" && duplicate;
    return { ...e, duplicate, valid: !invalidByDup };
  });
}

export function calculateAverage(validChoices: number[]): number {
  if (validChoices.length === 0) return 0;
  const sum = validChoices.reduce((a, b) => a + b, 0);
  return sum / validChoices.length;
}

export function calculateTarget(average: number, multiplier: number): number {
  return average * multiplier;
}

export function distanceToTarget(choice: number, target: number): number {
  return Math.abs(choice - target);
}

export interface WinnerResult {
  winnerIds: string[];
  perfectHit: boolean;
  tieBreak: string;
}

/**
 * Deterministic ranking:
 * 1. Invalid choices cannot win.
 * 2. Exact rounded target (PERFECT_TARGET rounds) wins if uniquely closest-or-exact.
 * 3. Lowest absolute distance wins.
 * 4. If still tied, lower numeric choice wins.
 * 5. If still tied, lexicographic playerId wins.
 */
export function determineWinners(
  resolved: ResolvedChoice[],
  target: number,
  rule: ActiveRule,
): WinnerResult {
  const valid = resolved.filter((r) => r.valid);
  if (valid.length === 0) {
    return {
      winnerIds: [],
      perfectHit: false,
      tieBreak: "No valid choices — round is void.",
    };
  }

  const roundedTarget = Math.round(target);
  const withDist = valid.map((r) => ({
    ...r,
    dist: distanceToTarget(r.choice, target),
    exactRounded: r.choice === roundedTarget,
  }));

  if (rule === "PERFECT_TARGET") {
    const perfect = withDist.filter((r) => r.exactRounded);
    if (perfect.length === 1) {
      return {
        winnerIds: [perfect[0].playerId],
        perfectHit: true,
        tieBreak: "PERFECT HIT — exact rounded target.",
      };
    }
    if (perfect.length > 1) {
      perfect.sort((a, b) => a.dist - b.dist || a.choice - b.choice || a.playerId.localeCompare(b.playerId));
      return {
        winnerIds: [perfect[0].playerId],
        perfectHit: true,
        tieBreak: "PERFECT HIT tie — lowest distance, then lower number, then seat id.",
      };
    }
  }

  withDist.sort(
    (a, b) => a.dist - b.dist || a.choice - b.choice || a.playerId.localeCompare(b.playerId),
  );
  const best = withDist[0].dist;
  const closest = withDist.filter((r) => Math.abs(r.dist - best) < 1e-9);
  if (closest.length === 1) {
    return {
      winnerIds: [closest[0].playerId],
      perfectHit: closest[0].exactRounded && Math.abs(target - roundedTarget) < 1e-9,
      tieBreak: "Closest to target.",
    };
  }

  closest.sort((a, b) => a.choice - b.choice || a.playerId.localeCompare(b.playerId));
  return {
    winnerIds: [closest[0].playerId],
    perfectHit: false,
    tieBreak: "Tie-break: lower number, then seat id.",
  };
}

export function applyRoundScores(
  scores: Record<string, number>,
  activeIds: string[],
  winnerIds: string[],
): Record<string, number> {
  const next = { ...scores };
  for (const id of activeIds) {
    if (!winnerIds.includes(id)) {
      next[id] = (next[id] ?? 0) - 1;
    }
  }
  return next;
}

export function newlyEliminated(
  previous: Record<string, number>,
  next: Record<string, number>,
  alreadyEliminated: Set<string>,
): string[] {
  const out: string[] = [];
  for (const [id, score] of Object.entries(next)) {
    if (alreadyEliminated.has(id)) continue;
    if (score <= ELIMINATION_SCORE && (previous[id] ?? 0) > ELIMINATION_SCORE) {
      out.push(id);
    }
  }
  return out;
}

export function placementsFromScores(
  players: Array<{ id: string; score: number; eliminated: boolean; joinOrder: number }>,
): Array<{ id: string; placement: number }> {
  const sorted = [...players].sort((a, b) => {
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    if (b.score !== a.score) return b.score - a.score;
    return a.joinOrder - b.joinOrder;
  });
  return sorted.map((p, i) => ({ id: p.id, placement: i + 1 }));
}
