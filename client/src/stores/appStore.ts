import { create } from "zustand";
import type {
  CalculationPayload,
  GameOverPayload,
  RoomSnapshot,
  UserProfile,
} from "@kod/shared";

export type ConnectionState = "connected" | "connecting" | "disconnected" | "reconnecting";

interface AppState {
  user: UserProfile | null;
  authLoading: boolean;
  connection: ConnectionState;
  room: RoomSnapshot | null;
  matchmaking: { playersFound: number; maxPlayers: number; message: string } | null;
  calculation: CalculationPayload | null;
  elimination: { names: string[]; scores: number[] } | null;
  gameOver: GameOverPayload | null;
  countdownEndsAt: number | null;
  serverOffset: number;
  notice: string | null;
  setUser: (user: UserProfile | null) => void;
  setAuthLoading: (v: boolean) => void;
  setConnection: (c: ConnectionState) => void;
  setRoom: (room: RoomSnapshot | null) => void;
  setMatchmaking: (m: AppState["matchmaking"]) => void;
  setCalculation: (c: CalculationPayload | null) => void;
  setElimination: (e: AppState["elimination"]) => void;
  setGameOver: (g: GameOverPayload | null) => void;
  setCountdown: (endsAt: number | null, serverNow?: number) => void;
  setNotice: (msg: string | null) => void;
  clearMatch: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authLoading: true,
  connection: "disconnected",
  room: null,
  matchmaking: null,
  calculation: null,
  elimination: null,
  gameOver: null,
  countdownEndsAt: null,
  serverOffset: 0,
  notice: null,
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setConnection: (connection) => set({ connection }),
  setRoom: (room) => set({ room }),
  setMatchmaking: (matchmaking) => set({ matchmaking }),
  setCalculation: (calculation) => set({ calculation }),
  setElimination: (elimination) => set({ elimination }),
  setGameOver: (gameOver) => set({ gameOver }),
  setCountdown: (endsAt, serverNow) =>
    set((s) => ({
      countdownEndsAt: endsAt,
      serverOffset: serverNow != null ? serverNow - Date.now() : s.serverOffset,
    })),
  setNotice: (notice) => set({ notice }),
  clearMatch: () =>
    set({
      room: null,
      matchmaking: null,
      calculation: null,
      elimination: null,
      gameOver: null,
      countdownEndsAt: null,
    }),
}));
