import type { Difficulty } from "@kod/shared";

export type AIKind = "RATIONAL" | "CHAOTIC" | "MIRROR";

export interface AIContext {
  kind: AIKind;
  round: number;
  totalRounds: number;
  multiplier: number;
  myScore: number;
  activeCount: number;
  lastAverage: number | null;
  lastTarget: number | null;
  lastWinnerChoice: number | null;
  humanChoices: number[];
  myHistory: number[];
  difficulty: Difficulty;
}

function clampInt(n: number): number {
  if (!Number.isFinite(n)) return 35;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function noise(spread: number): number {
  return (Math.random() * 2 - 1) * spread;
}

function rationalChoice(ctx: AIContext): number {
  const depth =
    ctx.difficulty === "EXTREME" ? 5 : ctx.difficulty === "HARD" ? 4 : 3;
  let guess = 50;
  for (let i = 0; i < depth; i += 1) {
    guess *= ctx.multiplier;
  }
  if (ctx.lastAverage != null) {
    const adapted = ctx.lastAverage * ctx.multiplier * ctx.multiplier;
    guess = guess * 0.45 + adapted * 0.55;
  }
  if (ctx.round >= ctx.totalRounds - 1) {
    guess *= 0.92;
  }
  const spread = ctx.difficulty === "STANDARD" ? 4 : 2;
  return clampInt(guess + noise(spread));
}

function chaoticChoice(ctx: AIContext): number {
  const roll = Math.random();
  if (roll < 0.12) return clampInt(Math.random() < 0.5 ? Math.random() * 8 : 92 + Math.random() * 8);
  if (roll < 0.22 && ctx.lastWinnerChoice != null) {
    return clampInt(ctx.lastWinnerChoice + noise(6));
  }
  if (roll < 0.32 && ctx.myHistory.length) {
    return clampInt(ctx.myHistory[ctx.myHistory.length - 1] + noise(12));
  }
  const center = ctx.lastTarget ?? 32;
  return clampInt(center + noise(22));
}

function mirrorChoice(ctx: AIContext): number {
  if (ctx.humanChoices.length === 0) {
    return rationalChoice({ ...ctx, kind: "RATIONAL" });
  }
  const recent = ctx.humanChoices.slice(-3);
  const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
  const predicted = mean * ctx.multiplier;
  const spread = ctx.difficulty === "STANDARD" ? 5 : 3;
  return clampInt(predicted + noise(spread));
}

export function chooseAINumber(ctx: AIContext): number {
  switch (ctx.kind) {
    case "CHAOTIC":
      return chaoticChoice(ctx);
    case "MIRROR":
      return mirrorChoice(ctx);
    default:
      return rationalChoice(ctx);
  }
}

export const AI_ROSTER: Array<{ kind: AIKind; name: string }> = [
  { kind: "RATIONAL", name: "AI — RATIONAL" },
  { kind: "CHAOTIC", name: "AI — CHAOTIC" },
  { kind: "MIRROR", name: "AI — MIRROR" },
];
