import { describe, expect, it, vi } from "vitest";
import type { RoomSettings } from "@kod/shared";
import type { IO } from "../rooms/room.js";
import { GameRoom } from "../rooms/room.js";

const settings: RoomSettings = {
  name: "TEST TABLE",
  visibility: "PRIVATE",
  maxPlayers: 2,
  aiFill: false,
  rounds: 5,
  difficulty: "STANDARD",
};

function createRoom() {
  const socketOps = { emit: vi.fn(), socketsJoin: vi.fn(), socketsLeave: vi.fn() };
  const io = {
    to: () => socketOps,
    in: () => socketOps,
  } as unknown as IO;
  return new GameRoom(io, "user-1", settings, "ABCDE");
}

describe("reconnect grace period", () => {
  it("accepts a reconnect within the grace period", () => {
    const room = createRoom();
    room.addHuman({ userId: "user-1", name: "Player", avatar: null, socketId: "socket-1" });
    room.status = "IN_GAME";
    room.markDisconnected("socket-1");

    expect(room.tryReconnect("user-1", "socket-2")).toBe(true);
    expect(room.findByUserId("user-1")?.connected).toBe(true);
    expect(room.findByUserId("user-1")?.socketId).toBe("socket-2");
  });

  it("rejects an expired reconnect during an active game", () => {
    const room = createRoom();
    room.addHuman({ userId: "user-1", name: "Player", avatar: null, socketId: "socket-1" });
    room.status = "IN_GAME";
    room.markDisconnected("socket-1");
    const player = room.findByUserId("user-1");
    if (!player) throw new Error("test player was not created");
    player.reconnectUntil = Date.now() - 1;

    expect(room.tryReconnect("user-1", "socket-2")).toBe(false);
    expect(player.connected).toBe(false);
    expect(player.socketId).toBeNull();
  });

  it("rejects an expired active-game room join", () => {
    const room = createRoom();
    room.addHuman({ userId: "user-1", name: "Player", avatar: null, socketId: "socket-1" });
    room.status = "IN_GAME";
    room.markDisconnected("socket-1");
    const player = room.findByUserId("user-1");
    if (!player) throw new Error("test player was not created");
    player.reconnectUntil = Date.now() - 1;

    expect(
      room.addHuman({ userId: "user-1", name: "Player", avatar: null, socketId: "socket-2" }),
    ).toEqual({ error: "Reconnect window expired." });
  });
});