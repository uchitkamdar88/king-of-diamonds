import type { RoomSettings } from "@kod/shared";
import { config } from "../config/env.js";
import type { RoomManager } from "../rooms/manager.js";
import type { GameRoom } from "../rooms/room.js";

interface QueueEntry {
  userId: string;
  name: string;
  avatar: string | null;
  socketId: string;
  joinedAt: number;
}

export class Matchmaker {
  private queue: QueueEntry[] = [];
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private roomTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private rooms: RoomManager) {}

  enqueue(entry: Omit<QueueEntry, "joinedAt">): GameRoom | "queued" {
    const existing = this.rooms.getByUser(entry.userId);
    if (existing && (existing.status === "IN_GAME" || existing.status === "COUNTDOWN")) {
      existing.tryReconnect(entry.userId, entry.socketId);
      return existing;
    }

    const publicRoom = this.rooms.findPublicSeat();
    if (publicRoom) {
      this.dequeue(entry.userId);
      this.rooms.bindUser(entry.userId, publicRoom);
      publicRoom.status = "MATCHMAKING";
      publicRoom.addHuman(entry);
      this.maybePromote(publicRoom);
      return publicRoom;
    }

    const queued = this.queue.find((q) => q.userId === entry.userId);
    if (queued) {
      queued.socketId = entry.socketId;
      return "queued";
    }
    this.queue.push({ ...entry, joinedAt: Date.now() });
    this.timers.set(
      entry.userId,
      setTimeout(() => this.timeoutUser(entry.userId), config.matchmakingTimeoutMs),
    );
    this.tryMatch();
    return this.rooms.getByUser(entry.userId) ?? "queued";
  }

  cancel(userId: string): void {
    this.dequeue(userId);
  }

  dequeue(userId: string): void {
    this.queue = this.queue.filter((q) => q.userId !== userId);
    const t = this.timers.get(userId);
    if (t) clearTimeout(t);
    this.timers.delete(userId);
  }

  private tryMatch(): void {
    while (this.queue.length >= 2) {
      const batch = this.queue.splice(0, Math.min(4, this.queue.length));
      this.formRoom(batch, batch.length >= 4);
    }
  }

  private timeoutUser(userId: string): void {
    const entry = this.queue.find((q) => q.userId === userId);
    if (!entry) return;
    const batch = this.queue.filter((q) => Date.now() - q.joinedAt >= config.matchmakingTimeoutMs - 50);
    const take = batch.length ? batch : [entry];
    this.queue = this.queue.filter((q) => !take.some((t) => t.userId === q.userId));
    this.formRoom(take, true);
  }

  private formRoom(batch: QueueEntry[], fillAI: boolean): void {
    for (const b of batch) {
      const t = this.timers.get(b.userId);
      if (t) clearTimeout(t);
      this.timers.delete(b.userId);
    }
    const host = batch[0];
    const settings: Partial<RoomSettings> = {
      name: "MATCHMAKING",
      visibility: "PUBLIC",
      maxPlayers: 4,
      aiFill: true,
      rounds: 10,
      difficulty: "STANDARD",
    };
    const room = this.rooms.create(host.userId, settings);
    room.status = "MATCHMAKING";
    for (const b of batch) {
      this.rooms.bindUser(b.userId, room);
      room.addHuman(b);
    }
    if (fillAI) room.fillAIIfNeeded(true);
    this.maybePromote(room);
  }

  private scheduleRoomMatchTimeout(room: GameRoom): void {
    if (this.roomTimers.has(room.roomId)) return;
    const t = setTimeout(() => {
      this.roomTimers.delete(room.roomId);
      if (room.status === "MATCHMAKING") {
        room.fillAIIfNeeded(true);
        this.maybePromote(room);
      }
    }, config.matchmakingTimeoutMs);
    this.roomTimers.set(room.roomId, t);
  }

  private maybePromote(room: GameRoom): void {
    if (room.players.length >= room.settings.maxPlayers) {
      const t = this.roomTimers.get(room.roomId);
      if (t) {
        clearTimeout(t);
        this.roomTimers.delete(room.roomId);
      }
      room.players.forEach((p) => {
        if (!p.isAI) p.ready = true;
      });
      room.startGame();
    } else {
      this.scheduleRoomMatchTimeout(room);
    }
  }

  status(userId: string): { playersFound: number; maxPlayers: number; message: string } {
    const room = this.rooms.getByUser(userId);
    if (room) {
      return {
        playersFound: room.humanCount(),
        maxPlayers: room.settings.maxPlayers,
        message: room.humanCount() >= 2 ? "Players found — locking table..." : "Waiting for more players...",
      };
    }
    return {
      playersFound: Math.max(1, this.queue.length),
      maxPlayers: 4,
      message: "Searching for opponents...",
    };
  }
}
