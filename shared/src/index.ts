export type RoomVisibility = "PUBLIC" | "PRIVATE";
export type Difficulty = "STANDARD" | "HARD" | "EXTREME";

export type RoomStatus =
  | "LOBBY"
  | "MATCHMAKING"
  | "COUNTDOWN"
  | "IN_GAME"
  | "GAME_OVER";

export type GamePhase =
  | "WAITING_FOR_PLAYERS"
  | "LOBBY"
  | "COUNTDOWN"
  | "CHOOSING"
  | "LOCKED"
  | "CALCULATING"
  | "RESULT"
  | "ELIMINATION"
  | "NEXT_ROUND"
  | "GAME_OVER";

export type PlayerStatus =
  | "WAITING"
  | "READY"
  | "THINKING"
  | "LOCKED"
  | "WINNER"
  | "ELIMINATED"
  | "DISCONNECTED";

export type ActiveRule =
  | "CLASSIC"
  | "DUPLICATE_PENALTY"
  | "PERFECT_TARGET"
  | "KINGS_DECREE";

export interface RoomSettings {
  name: string;
  visibility: RoomVisibility;
  maxPlayers: 2 | 3 | 4;
  aiFill: boolean;
  rounds: number;
  difficulty: Difficulty;
}

export interface PublicPlayer {
  id: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  score: number;
  status: PlayerStatus;
  isAI: boolean;
  aiKind?: "RATIONAL" | "CHAOTIC" | "MIRROR";
  isHost: boolean;
  connected: boolean;
  slot: number;
}

export interface RevealedPlayer extends PublicPlayer {
  choice: number | null;
  distance: number | null;
  valid: boolean;
}

export interface RoundRuleInfo {
  id: ActiveRule;
  title: string;
  description: string;
  multiplier: number;
}

export interface RoomSnapshot {
  roomId: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  settings: RoomSettings;
  players: PublicPlayer[];
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  rule: RoundRuleInfo;
  phaseEndsAt: number | null;
  serverNow: number;
  youAreHost: boolean;
  yourPlayerId: string | null;
  yourLocked: boolean;
  yourChoice: number | null;
}

export interface CalculationPayload {
  round: number;
  multiplier: number;
  rule: RoundRuleInfo;
  players: RevealedPlayer[];
  average: number;
  target: number;
  winnerIds: string[];
  perfectHit: boolean;
  tieBreak: string;
  eliminatedIds: string[];
}

export interface GameOverPayload {
  winnerId: string | null;
  winnerName: string | null;
  placements: Array<{
    playerId: string;
    name: string;
    avatar: string | null;
    score: number;
    placement: number;
    isAI: boolean;
  }>;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  gamesPlayed: number;
  gamesWon: number;
  totalWins: number;
  totalLosses: number;
  bestScore: number | null;
  winRate: number;
}

export type ClientToServerEvents = {
  "room:create": (
    payload: { settings: RoomSettings },
    ack?: (res: { ok: boolean; error?: string; roomCode?: string }) => void,
  ) => void;
  "room:join": (
    payload: { roomCode: string },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "room:leave": () => void;
  "player:ready": (payload: { ready: boolean }) => void;
  "game:start": (
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "game:rematch": (
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "choice:submit": (
    payload: { choice: number },
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "matchmaking:join": (
    ack?: (res: { ok: boolean; error?: string }) => void,
  ) => void;
  "matchmaking:cancel": () => void;
  "player:reconnect": (payload: { roomCode?: string }) => void;
};

export type ServerToClientEvents = {
  "session:user": (payload: UserProfile) => void;
  "room:update": (payload: RoomSnapshot) => void;
  "room:error": (payload: { code: string; message: string }) => void;
  "game:state": (payload: RoomSnapshot) => void;
  "game:countdown": (payload: { seconds: number; endsAt: number; serverNow: number }) => void;
  "choice:locked": (payload: { playerId: string }) => void;
  "round:allLocked": () => void;
  "round:calculating": (payload: CalculationPayload) => void;
  "round:result": (payload: CalculationPayload) => void;
  "round:elimination": (payload: { playerIds: string[]; names: string[]; scores: number[] }) => void;
  "round:complete": (payload: RoomSnapshot) => void;
  "game:over": (payload: GameOverPayload) => void;
  "player:disconnect": (payload: { playerId: string }) => void;
  "player:reconnect": (payload: { playerId: string }) => void;
  "matchmaking:status": (payload: {
    playersFound: number;
    maxPlayers: number;
    message: string;
  }) => void;
  "error:notice": (payload: { code: string; message: string }) => void;
};

export const DEFAULT_SETTINGS: RoomSettings = {
  name: "KING'S TABLE",
  visibility: "PRIVATE",
  maxPlayers: 4,
  aiFill: true,
  rounds: 10,
  difficulty: "STANDARD",
};

export const ELIMINATION_SCORE = -10;
export const MIN_CHOICE = 0;
export const MAX_CHOICE = 100;
export const CLASSIC_MULTIPLIER = 0.8;
export const KINGS_DECREE_MULTIPLIER = 0.7;
