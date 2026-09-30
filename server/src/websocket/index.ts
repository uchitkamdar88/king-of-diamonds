import type { Socket } from "socket.io";
import type { ClientToServerEvents, RoomSettings, ServerToClientEvents } from "@kod/shared";
import { toProfile } from "../auth/google.js";
import { findUserById } from "../database/users.js";
import type { Matchmaker } from "../matchmaking/matchmaker.js";
import type { RoomManager } from "../rooms/manager.js";
import type { IO } from "../rooms/room.js";

type Sock = Socket<ClientToServerEvents, ServerToClientEvents>;

function joinSocketRoom(socket: Sock, roomId: string): void {
  for (const r of socket.rooms) {
    if (r !== socket.id) socket.leave(r);
  }
  socket.join(roomId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseRoomSettings(value: unknown): RoomSettings | null {
  if (!isRecord(value)) return null;
  const { name, visibility, maxPlayers, aiFill, rounds, difficulty } = value;
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.length > 32 ||
    (visibility !== "PUBLIC" && visibility !== "PRIVATE") ||
    (maxPlayers !== 2 && maxPlayers !== 3 && maxPlayers !== 4) ||
    typeof aiFill !== "boolean" ||
    typeof rounds !== "number" ||
    !Number.isInteger(rounds) ||
    rounds < 1 ||
    rounds > 50 ||
    (difficulty !== "STANDARD" && difficulty !== "HARD" && difficulty !== "EXTREME")
  ) {
    return null;
  }
  const cleanName = name.trim().replace(/[\u0000-\u001F\u007F-\u009F]/g, "").slice(0, 32);
  if (!cleanName) return null;
  return { name: cleanName, visibility, maxPlayers, aiFill, rounds, difficulty };
}

export function registerSockets(io: IO, rooms: RoomManager, matchmaker: Matchmaker): void {
  io.use(async (socket, next) => {
    try {
      const req = socket.request as { session?: { userId?: string } };
      const userId = req.session?.userId;
      if (!userId) {
        next(new Error("unauthorized"));
        return;
      }
      const user = await findUserById(userId);
      if (!user) {
        next(new Error("unauthorized"));
        return;
      }
      socket.data.userId = user.id;
      socket.data.user = user;
      next();
    } catch (err) {
      next(err as Error);
    }
  });

  io.on("connection", (socket: Sock) => {
    const user = socket.data.user as {
      id: string;
      name: string;
      email: string;
      avatar: string | null;
      gamesPlayed: number;
      gamesWon: number;
      totalWins: number;
      totalLosses: number;
      bestScore: number | null;
    };
    socket.emit("session:user", toProfile(user));

    const existing = rooms.getByUser(user.id);
    if (existing) {
      if (existing.tryReconnect(user.id, socket.id)) joinSocketRoom(socket, existing.roomId);
    }

    socket.on("room:create", (payload, ack) => {
      try {
        const settings = parseRoomSettings(payload?.settings);
        if (!settings) {
          ack?.({ ok: false, error: "Invalid room settings." });
          return;
        }
        const active = rooms.getByUser(user.id);
        if (active && (active.status === "IN_GAME" || active.status === "COUNTDOWN")) {
          const player = active.findByUserId(user.id);
          if (player && !player.eliminated) {
            ack?.({ ok: false, error: "You are already in an active match." });
            return;
          }
        }
        const room = rooms.create(user.id, settings);
        rooms.bindUser(user.id, room);
        room.addHuman({
          userId: user.id,
          name: user.name,
          avatar: user.avatar,
          socketId: socket.id,
        });
        joinSocketRoom(socket, room.roomId);
        ack?.({ ok: true, roomCode: room.roomCode });
      } catch {
        ack?.({ ok: false, error: "Could not create room." });
      }
    });

    socket.on("room:join", (payload, ack) => {
      try {
        if (!isRecord(payload) || typeof payload.roomCode !== "string") {
          ack?.({ ok: false, error: "Enter a valid 5-character room code." });
          socket.emit("room:error", { code: "INVALID_CODE", message: "Enter a valid 5-character room code." });
          return;
        }
        const code = payload.roomCode.trim().toUpperCase();
        if (!/^[A-Z0-9]{5}$/.test(code)) {
          ack?.({ ok: false, error: "Enter a valid 5-character room code." });
          socket.emit("room:error", { code: "INVALID_CODE", message: "Enter a valid 5-character room code." });
          return;
        }
        const active = rooms.getByUser(user.id);
        if (active && (active.status === "IN_GAME" || active.status === "COUNTDOWN") && active.roomCode !== code) {
          const player = active.findByUserId(user.id);
          if (player && !player.eliminated) {
            ack?.({ ok: false, error: "You are already in an active match." });
            return;
          }
        }
        const room = rooms.getByCode(code);
        if (!room) {
          ack?.({ ok: false, error: "Room does not exist." });
          socket.emit("room:error", { code: "NOT_FOUND", message: "Room does not exist." });
          return;
        }
        const result = room.addHuman({
          userId: user.id,
          name: user.name,
          avatar: user.avatar,
          socketId: socket.id,
        });
        if ("error" in result) {
          ack?.({ ok: false, error: result.error });
          socket.emit("room:error", { code: "JOIN_DENIED", message: result.error });
          return;
        }
        rooms.bindUser(user.id, room);
        joinSocketRoom(socket, room.roomId);
        ack?.({ ok: true });
      } catch {
        ack?.({ ok: false, error: "Could not join room." });
      }
    });

    socket.on("room:leave", () => {
      try {
        matchmaker.cancel(user.id);
        const room = rooms.getByUser(user.id);
        rooms.leave(user.id);
        if (room) socket.leave(room.roomId);
      } catch (err) {
        console.error("[socket] room:leave error", err);
      }
    });

    socket.on("player:ready", (payload) => {
      try {
        if (isRecord(payload) && typeof payload.ready === "boolean") {
          rooms.getByUser(user.id)?.setReady(user.id, payload.ready);
        }
      } catch (err) {
        console.error("[socket] player:ready error", err);
      }
    });

    socket.on("game:start", (ack) => {
      try {
        const room = rooms.getByUser(user.id);
        if (!room) {
          ack?.({ ok: false, error: "You are not in a room." });
          return;
        }
        const check = room.canStart(user.id);
        if (!check.ok) {
          ack?.({ ok: false, error: check.error });
          return;
        }
        room.startGame();
        ack?.({ ok: true });
      } catch (err) {
        console.error("[socket] game:start error", err);
        ack?.({ ok: false, error: "Could not start game." });
      }
    });

    socket.on("game:rematch", (ack) => {
      try {
        const room = rooms.getByUser(user.id);
        if (!room) {
          ack?.({ ok: false, error: "You are not in a room." });
          return;
        }
        ack?.(room.rematch(user.id));
      } catch (err) {
        console.error("[socket] game:rematch error", err);
        ack?.({ ok: false, error: "Could not request rematch." });
      }
    });

    socket.on("choice:submit", (payload, ack) => {
      try {
        const room = rooms.getByUser(user.id);
        if (!room) {
          ack?.({ ok: false, error: "You are not in a room." });
          return;
        }
        if (
          !isRecord(payload) ||
          typeof payload.choice !== "number" ||
          !Number.isInteger(payload.choice) ||
          payload.choice < 0 ||
          payload.choice > 100
        ) {
          ack?.({ ok: false, error: "Choice must be an integer from 0 to 100." });
          return;
        }
        const result = room.submitChoice(user.id, payload.choice);
        ack?.(result);
        if (!result.ok) {
          socket.emit("error:notice", { code: "SUBMIT", message: result.error ?? "Invalid submission." });
        }
      } catch (err) {
        console.error("[socket] choice:submit error", err);
        ack?.({ ok: false, error: "Failed to submit choice." });
      }
    });

    socket.on("matchmaking:join", (ack) => {
      try {
        const result = matchmaker.enqueue({
          userId: user.id,
          name: user.name,
          avatar: user.avatar,
          socketId: socket.id,
        });
        if (result !== "queued") {
          joinSocketRoom(socket, result.roomId);
        }
        socket.emit("matchmaking:status", matchmaker.status(user.id));
        ack?.({ ok: true });
      } catch (err) {
        console.error("[socket] matchmaking:join error", err);
        ack?.({ ok: false, error: "Could not join matchmaking." });
      }
    });

    socket.on("matchmaking:cancel", () => {
      try {
        matchmaker.cancel(user.id);
        const room = rooms.getByUser(user.id);
        if (room && (room.status === "MATCHMAKING" || room.status === "LOBBY") && room.settings.name === "MATCHMAKING") {
          rooms.leave(user.id);
          socket.leave(room.roomId);
        }
      } catch (err) {
        console.error("[socket] matchmaking:cancel error", err);
      }
    });

    socket.on("player:reconnect", (payload) => {
      try {
        const roomCode = isRecord(payload) && typeof payload.roomCode === "string" ? payload.roomCode.trim().toUpperCase() : undefined;
        const room = roomCode ? rooms.getByCode(roomCode) : rooms.getByUser(user.id);
        if (!room) return;
        if (room.tryReconnect(user.id, socket.id)) joinSocketRoom(socket, room.roomId);
      } catch (err) {
        console.error("[socket] player:reconnect error", err);
      }
    });

    socket.on("disconnect", () => {
      try {
        matchmaker.cancel(user.id);
        const room = rooms.getByUser(user.id);
        room?.markDisconnected(socket.id);
      } catch (err) {
        console.error("[socket] disconnect error", err);
      }
    });
  });
}
