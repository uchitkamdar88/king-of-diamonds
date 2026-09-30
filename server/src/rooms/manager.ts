import type { RoomSettings } from "@kod/shared";
import type { IO } from "./room.js";
import { GameRoom, generateRoomCode } from "./room.js";

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  private codeIndex = new Map<string, string>();
  private userRoom = new Map<string, string>();
  private io: IO;

  constructor(io: IO) {
    this.io = io;
  }

  get(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getByCode(code: string): GameRoom | undefined {
    const id = this.codeIndex.get(code.toUpperCase());
    return id ? this.rooms.get(id) : undefined;
  }

  getByUser(userId: string): GameRoom | undefined {
    const id = this.userRoom.get(userId);
    return id ? this.rooms.get(id) : undefined;
  }

  create(hostUserId: string, settings: Partial<RoomSettings>): GameRoom {
    let code = generateRoomCode();
    while (this.codeIndex.has(code)) code = generateRoomCode();
    const room = new GameRoom(this.io, hostUserId, settings, code, (r) => this.destroyRoom(r));
    this.rooms.set(room.roomId, room);
    this.codeIndex.set(room.roomCode, room.roomId);
    return room;
  }

  bindUser(userId: string, room: GameRoom): void {
    const prev = this.getByUser(userId);
    if (prev && prev.roomId !== room.roomId) {
      prev.removePlayer(userId);
      this.maybeGc(prev);
    }
    this.userRoom.set(userId, room.roomId);
  }

  leave(userId: string): void {
    const room = this.getByUser(userId);
    if (!room) return;
    room.removePlayer(userId);
    if (!room.findByUserId(userId) || room.status === "LOBBY") {
      if (!room.findByUserId(userId)) this.userRoom.delete(userId);
    }
    this.maybeGc(room);
  }

  findPublicSeat(): GameRoom | undefined {
    for (const room of this.rooms.values()) {
      if (
        room.settings.visibility === "PUBLIC" &&
        (room.status === "LOBBY" || room.status === "MATCHMAKING") &&
        !room.isFull()
      ) {
        return room;
      }
    }
    return undefined;
  }

  destroyRoom(room: GameRoom): void {
    room.destroy();
    this.rooms.delete(room.roomId);
    this.codeIndex.delete(room.roomCode);
    for (const [uid, rId] of this.userRoom.entries()) {
      if (rId === room.roomId) {
        this.userRoom.delete(uid);
      }
    }
  }

  maybeGc(room: GameRoom): void {
    const humans = room.players.filter((p) => !p.isAI);
    if (humans.length === 0) {
      this.destroyRoom(room);
    }
  }

  all(): GameRoom[] {
    return [...this.rooms.values()];
  }
}
