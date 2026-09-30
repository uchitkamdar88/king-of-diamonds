import type { User } from "@prisma/client";
import { prisma } from "./prisma.js";

const memory = new Map<string, User>();
let dbAvailable: boolean | null = null;

export async function checkDatabase(): Promise<boolean> {
  if (dbAvailable != null) return dbAvailable;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    console.warn("[kod] PostgreSQL unavailable — using in-memory user/game store (stats will not persist).");
  }
  return dbAvailable;
}

function memUser(data: Partial<User> & { googleId: string; name: string; email: string }): User {
  const existing = [...memory.values()].find((u) => u.googleId === data.googleId || u.email === data.email);
  if (existing) {
    const updated: User = {
      ...existing,
      name: data.name,
      email: data.email,
      avatar: data.avatar ?? existing.avatar,
      lastLoginAt: new Date(),
    };
    memory.set(updated.id, updated);
    return updated;
  }
  const user: User = {
    id: `mem_${data.googleId}`,
    googleId: data.googleId,
    name: data.name,
    email: data.email,
    avatar: data.avatar ?? null,
    createdAt: new Date(),
    lastLoginAt: new Date(),
    gamesPlayed: 0,
    gamesWon: 0,
    totalWins: 0,
    totalLosses: 0,
    bestScore: null,
  };
  memory.set(user.id, user);
  return user;
}

export async function findUserById(id: string): Promise<User | null> {
  if (await checkDatabase()) {
    try {
      return await prisma.user.findUnique({ where: { id } });
    } catch (err) {
      console.error("[kod] findUserById error", err);
      return null;
    }
  }
  return memory.get(id) ?? null;
}

export async function upsertGoogleIdentity(payload: {
  googleId: string;
  name: string;
  email: string;
  avatar: string | null;
}): Promise<User> {
  if (await checkDatabase()) {
    try {
      return await prisma.user.upsert({
        where: { googleId: payload.googleId },
        update: {
          name: payload.name,
          email: payload.email,
          avatar: payload.avatar,
          lastLoginAt: new Date(),
        },
        create: {
          googleId: payload.googleId,
          name: payload.name,
          email: payload.email,
          avatar: payload.avatar,
        },
      });
    } catch (err) {
      console.error("[kod] upsertGoogleIdentity error", err);
      // Fallback to memory if database operation fails
      return memUser(payload);
    }
  }
  return memUser(payload);
}

export async function applyGameStats(input: {
  userId: string;
  score: number;
  isWin: boolean;
}): Promise<void> {
  if (await checkDatabase()) {
    try {
      const user = await prisma.user.findUnique({ where: { id: input.userId } });
      if (!user) return;
      const best = user.bestScore == null ? input.score : Math.max(user.bestScore, input.score);
      await prisma.user.update({
        where: { id: input.userId },
        data: {
          gamesPlayed: { increment: 1 },
          gamesWon: { increment: input.isWin ? 1 : 0 },
          totalWins: { increment: input.isWin ? 1 : 0 },
          totalLosses: { increment: input.isWin ? 0 : 1 },
          bestScore: best,
        },
      });
    } catch (err) {
      console.error("[kod] applyGameStats error", err);
    }
    return;
  }
  const user = memory.get(input.userId);
  if (!user) return;
  user.gamesPlayed += 1;
  if (input.isWin) {
    user.gamesWon += 1;
    user.totalWins += 1;
  } else {
    user.totalLosses += 1;
  }
  user.bestScore = user.bestScore == null ? input.score : Math.max(user.bestScore, input.score);
  memory.set(user.id, user);
}

export async function listLeaderboard(take = 20) {
  if (await checkDatabase()) {
    try {
      return await prisma.user.findMany({
        orderBy: [{ gamesWon: "desc" }, { gamesPlayed: "desc" }],
        take,
      });
    } catch (err) {
      console.error("[kod] listLeaderboard error", err);
    }
  }
  return [...memory.values()]
    .sort((a, b) => b.gamesWon - a.gamesWon || b.gamesPlayed - a.gamesPlayed)
    .slice(0, take);
}

export async function createGameRecord(roomId: string) {
  if (!(await checkDatabase())) return null;
  try {
    return await prisma.game.create({ data: { roomId, status: "IN_PROGRESS" } });
  } catch {
    return null;
  }
}

export async function completeGameRecord(input: {
  gameId: string;
  winnerId: string | null;
  placements: Array<{
    userId: string | null;
    displayName: string;
    isAI: boolean;
    finalScore: number;
    placement: number;
  }>;
}) {
  if (!(await checkDatabase())) return;
  try {
    await prisma.game.update({
      where: { id: input.gameId },
      data: {
        endedAt: new Date(),
        status: "COMPLETED",
        winnerId: input.winnerId,
      },
    });
    for (const row of input.placements) {
      await prisma.gamePlayer.create({
        data: {
          gameId: input.gameId,
          userId: row.userId,
          displayName: row.displayName,
          isAI: row.isAI,
          finalScore: row.finalScore,
          placement: row.placement,
        },
      });
    }
  } catch {
    /* ignore persistence errors */
  }
}
