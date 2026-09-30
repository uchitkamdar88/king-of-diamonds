import { describe, expect, it } from "vitest";
import {
  applyRoundScores,
  calculateAverage,
  calculateTarget,
  determineWinners,
  markDuplicates,
  newlyEliminated,
  placementsFromScores,
} from "../game/engine.js";
import { chooseAINumber } from "../ai/personalities.js";

describe("target calculation", () => {
  it("matches the spec example 20,30,40,50 → average 35 → target 28", () => {
    const avg = calculateAverage([20, 30, 40, 50]);
    expect(avg).toBe(35);
    expect(calculateTarget(avg, 0.8)).toBe(28);
  });

  it("returns 0 for empty valid set", () => {
    expect(calculateAverage([])).toBe(0);
  });
});

describe("closest player", () => {
  it("picks the nearest valid choice", () => {
    const resolved = markDuplicates(
      [
        { playerId: "a", choice: 30 },
        { playerId: "b", choice: 42 },
        { playerId: "c", choice: 18 },
        { playerId: "d", choice: 51 },
      ],
      "CLASSIC",
    );
    const target = calculateTarget(calculateAverage([30, 42, 18, 51]), 0.8);
    const result = determineWinners(resolved, target, "CLASSIC");
    expect(result.winnerIds).toEqual(["a"]);
  });

  it("tie-breaks with lower number then playerId", () => {
    const resolved = markDuplicates(
      [
        { playerId: "b", choice: 20 },
        { playerId: "a", choice: 20 },
      ],
      "CLASSIC",
    );
    const result = determineWinners(resolved, 20, "CLASSIC");
    expect(result.winnerIds).toEqual(["a"]);
  });
});

describe("duplicate penalty", () => {
  it("invalidates identical numbers", () => {
    const resolved = markDuplicates(
      [
        { playerId: "a", choice: 40 },
        { playerId: "b", choice: 40 },
        { playerId: "c", choice: 10 },
      ],
      "DUPLICATE_PENALTY",
    );
    expect(resolved.filter((r) => r.valid).map((r) => r.playerId)).toEqual(["c"]);
    const avg = calculateAverage(resolved.filter((r) => r.valid).map((r) => r.choice));
    expect(avg).toBe(10);
    const result = determineWinners(resolved, calculateTarget(avg, 0.8), "DUPLICATE_PENALTY");
    expect(result.winnerIds).toEqual(["c"]);
  });
});

describe("perfect target", () => {
  it("awards perfect hit on exact rounded target", () => {
    const resolved = markDuplicates(
      [
        { playerId: "a", choice: 28 },
        { playerId: "b", choice: 40 },
      ],
      "PERFECT_TARGET",
    );
    const result = determineWinners(resolved, 28, "PERFECT_TARGET");
    expect(result.perfectHit).toBe(true);
    expect(result.winnerIds).toEqual(["a"]);
  });
});

describe("scoring and elimination", () => {
  it("winner stays, others lose 1", () => {
    const next = applyRoundScores({ a: 0, b: 0, c: 0 }, ["a", "b", "c"], ["a"]);
    expect(next).toEqual({ a: 0, b: -1, c: -1 });
  });

  it("eliminates at -10", () => {
    const prev = { a: -9, b: 0 };
    const next = { a: -10, b: 0 };
    expect(newlyEliminated(prev, next, new Set())).toEqual(["a"]);
  });

  it("ranks non-eliminated players first by score", () => {
    const places = placementsFromScores([
      { id: "a", score: -3, eliminated: false, joinOrder: 0 },
      { id: "b", score: -1, eliminated: false, joinOrder: 1 },
      { id: "c", score: -10, eliminated: true, joinOrder: 2 },
    ]);
    expect(places.map((p) => p.id)).toEqual(["b", "a", "c"]);
  });
});

describe("AI", () => {
  const base = {
    round: 2,
    totalRounds: 10,
    multiplier: 0.8,
    myScore: 0,
    activeCount: 4,
    lastAverage: 40,
    lastTarget: 32,
    lastWinnerChoice: 30,
    humanChoices: [37, 41, 28],
    myHistory: [33],
    difficulty: "STANDARD" as const,
  };

  it("Rational stays in range", () => {
    const n = chooseAINumber({ ...base, kind: "RATIONAL" });
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
  });

  it("Chaotic stays in range", () => {
    const n = chooseAINumber({ ...base, kind: "CHAOTIC" });
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
  });

  it("Mirror stays in range", () => {
    const n = chooseAINumber({ ...base, kind: "MIRROR" });
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(100);
  });
});
