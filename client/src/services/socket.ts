import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, RoomSettings, ServerToClientEvents } from "@kod/shared";
import { useAppStore } from "../stores/appStore";
import { sound } from "./sound";

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

const base = import.meta.env.VITE_SERVER_URL?.replace(/\/$/, "") ?? undefined;

export function getSocket() {
  return socket;
}

export function connectSocket() {
  if (socket?.connected) return socket;
  const store = useAppStore.getState();
  store.setConnection("connecting");

  socket = io(base ?? "/", {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 20,
    reconnectionDelay: 800,
  });

  socket.on("connect", () => {
    useAppStore.getState().setConnection("connected");
    const currentRoom = useAppStore.getState().room;
    if (currentRoom?.roomCode) {
      socket?.emit("player:reconnect", { roomCode: currentRoom.roomCode });
    }
  });
  socket.on("disconnect", () => {
    useAppStore.getState().setConnection("reconnecting");
  });
  socket.on("connect_error", () => {
    useAppStore.getState().setConnection("disconnected");
  });

  socket.on("session:user", (user) => {
    useAppStore.getState().setUser(user);
  });

  socket.on("room:update", (room) => {
    useAppStore.getState().setRoom(room);
    if (room.status === "IN_GAME" || room.status === "COUNTDOWN" || room.status === "GAME_OVER") {
      useAppStore.getState().setMatchmaking(null);
    }
  });

  socket.on("game:state", (room) => {
    useAppStore.getState().setRoom(room);
  });

  socket.on("game:countdown", ({ endsAt, serverNow }) => {
    useAppStore.getState().setCountdown(endsAt, serverNow);
    sound.play("COUNTDOWN");
  });

  socket.on("choice:locked", () => {
    sound.play("LOCK");
  });

  socket.on("round:allLocked", () => {
    sound.play("ALL_LOCKED");
  });

  socket.on("round:calculating", (payload) => {
    useAppStore.getState().setCalculation(payload);
    useAppStore.getState().setElimination(null);
    sound.play("CALCULATING");
  });

  socket.on("round:result", (payload) => {
    useAppStore.getState().setCalculation(payload);
  });

  socket.on("round:elimination", (payload) => {
    useAppStore.getState().setElimination({
      names: payload.names,
      scores: payload.scores,
    });
    sound.play("ELIMINATION");
  });

  socket.on("round:complete", (room) => {
    useAppStore.getState().setRoom(room);
    useAppStore.getState().setCalculation(null);
    useAppStore.getState().setElimination(null);
  });

  socket.on("game:over", (payload) => {
    useAppStore.getState().setGameOver(payload);
    sound.play("GAME_END");
  });

  socket.on("matchmaking:status", (status) => {
    useAppStore.getState().setMatchmaking(status);
  });

  socket.on("room:error", ({ message }) => {
    useAppStore.getState().setNotice(message);
  });

  socket.on("error:notice", ({ message }) => {
    useAppStore.getState().setNotice(message);
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

function s(): TypedSocket {
  if (!socket) connectSocket();
  return socket!;
}

export const gameApi = {
  createRoom: (settings: RoomSettings) =>
    new Promise<{ ok: boolean; error?: string; roomCode?: string }>((resolve) => {
      s().emit("room:create", { settings }, resolve);
    }),
  joinRoom: (roomCode: string) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      s().emit("room:join", { roomCode }, resolve);
    }),
  leaveRoom: () => s().emit("room:leave"),
  setReady: (ready: boolean) => s().emit("player:ready", { ready }),
  startGame: () =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      s().emit("game:start", resolve);
    }),
  rematch: () =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      s().emit("game:rematch", resolve);
    }),
  submitChoice: (choice: number) =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      s().emit("choice:submit", { choice }, resolve);
    }),
  joinMatchmaking: () =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      s().emit("matchmaking:join", resolve);
    }),
  cancelMatchmaking: () => s().emit("matchmaking:cancel"),
};
