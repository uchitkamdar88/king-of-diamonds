import { randomBytes } from "node:crypto";
import type { Server } from "socket.io";
import {
  DEFAULT_SETTINGS,
  ELIMINATION_SCORE,
  type CalculationPayload,
  type ClientToServerEvents,
  type GameOverPayload,
  type GamePhase,
  type PublicPlayer,
  type RevealedPlayer,
  type RoomSettings,
  type RoomSnapshot,
  type RoomStatus,
  type ServerToClientEvents,
} from "@kod/shared";
import { config } from "../config/env.js";
import {
  applyGameStats,
  completeGameRecord,
  createGameRecord,
} from "../database/users.js";
import { AI_ROSTER, chooseAINumber, type AIKind } from "../ai/personalities.js";
import {
  applyRoundScores,
  calculateAverage,
  calculateTarget,
  determineWinners,
  markDuplicates,
  newlyEliminated,
  placementsFromScores,
  round2,
  ruleForRound,
} from "../game/engine.js";

export type IO = Server<ClientToServerEvents, ServerToClientEvents>;

export interface InternalPlayer {
  id: string;
  userId: string | null;
  name: string;
  avatar: string | null;
  score: number;
  ready: boolean;
  isAI: boolean;
  aiKind?: AIKind;
  isHost: boolean;
  connected: boolean;
  socketId: string | null;
  slot: number;
  joinOrder: number;
  choice: number | null;
  locked: boolean;
  eliminated: boolean;
  reconnectUntil: number | null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  const bytes = randomBytes(5);
  let code = "";
  for (let i = 0; i < 5; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function choiceMs(difficulty: RoomSettings["difficulty"]): number {
  if (difficulty === "EXTREME") return Math.min(config.choiceTimeMs, 10_000);
  if (difficulty === "HARD") return Math.min(config.choiceTimeMs, 12_000);
  return config.choiceTimeMs;
}

export class GameRoom {
  readonly roomId: string;
  readonly roomCode: string;
  hostUserId: string;
  settings: RoomSettings;
  status: RoomStatus = "LOBBY";
  phase: GamePhase = "LOBBY";
  currentRound = 0;
  players: InternalPlayer[] = [];
  phaseEndsAt: number | null = null;
  lastCalculation: CalculationPayload | null = null;
  lastAverage: number | null = null;
  lastTarget: number | null = null;
  lastWinnerChoice: number | null = null;
  humanChoiceHistory: number[] = [];
  persistedGameId: string | null = null;
  rematchVotes = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private aiTimers: ReturnType<typeof setTimeout>[] = [];
  private disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private io: IO;
  private joinSeq = 0;
  private destroyed = false;
  private onEmpty?: (room: GameRoom) => void;

  constructor(
    io: IO,
    hostUserId: string,
    settings: Partial<RoomSettings>,
    code: string,
    onEmpty?: (room: GameRoom) => void,
  ) {
    this.io = io;
    this.roomId = `rm_${randomBytes(8).toString("hex")}`;
    this.roomCode = code;
    this.hostUserId = hostUserId;
    this.settings = { ...DEFAULT_SETTINGS, ...settings };
    this.onEmpty = onEmpty;
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimer();
    for (const t of this.disconnectTimers.values()) clearTimeout(t);
    this.disconnectTimers.clear();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const t of this.aiTimers) clearTimeout(t);
    this.aiTimers = [];
  }

  private schedule(ms: number, fn: () => void): void {
    this.clearTimer();
    this.phaseEndsAt = Date.now() + ms;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.destroyed) fn();
    }, ms);
  }

  private nextId(): string {
    return `pl_${randomBytes(6).toString("hex")}`;
  }

  humanCount(): number {
    return this.players.filter((p) => !p.isAI).length;
  }

  connectedHumans(): InternalPlayer[] {
    return this.players.filter((p) => !p.isAI && p.connected);
  }

  activePlayers(): InternalPlayer[] {
    return this.players.filter((p) => !p.eliminated);
  }

  isFull(): boolean {
    return this.humanCount() >= this.settings.maxPlayers;
  }

  findByUserId(userId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.userId === userId);
  }

  findBySocket(socketId: string): InternalPlayer | undefined {
    return this.players.find((p) => p.socketId === socketId);
  }

  addHuman(input: {
    userId: string;
    name: string;
    avatar: string | null;
    socketId: string;
  }): InternalPlayer | { error: string } {
    if (this.status === "IN_GAME" || this.status === "GAME_OVER" || this.status === "COUNTDOWN") {
      const existing = this.findByUserId(input.userId);
      if (existing) {
        if (
          existing.reconnectUntil !== null &&
          Date.now() > existing.reconnectUntil &&
          (this.status === "COUNTDOWN" || this.status === "IN_GAME")
        ) {
          return { error: "Reconnect window expired." };
        }
        const dt = this.disconnectTimers.get(existing.id);
        if (dt) clearTimeout(dt);
        this.disconnectTimers.delete(existing.id);

        existing.connected = true;
        existing.socketId = input.socketId;
        existing.reconnectUntil = null;
        if (input.socketId) {
          this.io.in(input.socketId).socketsJoin(this.roomId);
        }
        this.broadcast();
        return existing;
      }
      return { error: "Game already started." };
    }
    const existing = this.findByUserId(input.userId);
    if (existing) {
      const dt = this.disconnectTimers.get(existing.id);
      if (dt) clearTimeout(dt);
      this.disconnectTimers.delete(existing.id);

      existing.connected = true;
      existing.socketId = input.socketId;
      existing.reconnectUntil = null;
      if (input.socketId) {
        this.io.in(input.socketId).socketsJoin(this.roomId);
      }
      this.broadcast();
      return existing;
    }
    if (this.humanCount() >= this.settings.maxPlayers) {
      return { error: "Room is full." };
    }
    this.stripOneAI();
    const player: InternalPlayer = {
      id: this.nextId(),
      userId: input.userId,
      name: input.name,
      avatar: input.avatar,
      score: 0,
      ready: false,
      isAI: false,
      isHost: input.userId === this.hostUserId,
      connected: true,
      socketId: input.socketId,
      slot: this.nextSlot(),
      joinOrder: this.joinSeq++,
      choice: null,
      locked: false,
      eliminated: false,
      reconnectUntil: null,
    };
    this.players.push(player);
    if (input.socketId) {
      this.io.in(input.socketId).socketsJoin(this.roomId);
    }
    this.syncHostFlags();
    this.fillAIIfNeeded(false);
    this.broadcast();
    return player;
  }

  private syncHostFlags(): void {
    const hostStillPresent = this.players.some((p) => !p.isAI && p.userId === this.hostUserId);
    if (!hostStillPresent) {
      this.transferHost();
      return;
    }
    this.players.forEach((p) => {
      p.isHost = !p.isAI && p.userId === this.hostUserId;
    });
  }

  private nextSlot(): number {
    const used = new Set(this.players.map((p) => p.slot));
    for (let i = 1; i <= this.settings.maxPlayers; i += 1) {
      if (!used.has(i)) return i;
    }
    return this.players.length + 1;
  }

  private stripOneAI(): void {
    const ai = this.players.find((p) => p.isAI);
    if (ai) {
      this.players = this.players.filter((p) => p.id !== ai.id);
    }
  }

  fillAIIfNeeded(force: boolean): void {
    if (!this.settings.aiFill) return;
    if (!force && this.status !== "LOBBY" && this.status !== "MATCHMAKING") return;
    let idx = 0;
    while (this.players.length < this.settings.maxPlayers) {
      const spec = AI_ROSTER[idx % AI_ROSTER.length];
      const taken = this.players.some((p) => p.aiKind === spec.kind);
      idx += 1;
      const name = taken ? `${spec.name} ${idx}` : spec.name;
      this.players.push({
        id: this.nextId(),
        userId: null,
        name,
        avatar: null,
        score: 0,
        ready: true,
        isAI: true,
        aiKind: spec.kind,
        isHost: false,
        connected: true,
        socketId: null,
        slot: this.nextSlot(),
        joinOrder: this.joinSeq++,
        choice: null,
        locked: false,
        eliminated: false,
        reconnectUntil: null,
      });
    }
  }

  removePlayer(userId: string): void {
    const p = this.findByUserId(userId);
    if (!p) return;
    const dt = this.disconnectTimers.get(p.id);
    if (dt) clearTimeout(dt);
    this.disconnectTimers.delete(p.id);

    if (this.status === "IN_GAME" || this.status === "COUNTDOWN") {
      p.connected = false;
      p.socketId = null;
      p.reconnectUntil = Date.now() + config.reconnectGraceMs;
      this.broadcast();

      const t = setTimeout(() => {
        this.disconnectTimers.delete(p.id);
        this.handleDisconnectExpiry(p.id);
      }, config.reconnectGraceMs);
      this.disconnectTimers.set(p.id, t);
      return;
    }
    if (p.socketId) {
      this.io.in(p.socketId).socketsLeave(this.roomId);
    }
    this.players = this.players.filter((x) => x.id !== p.id);
    if (p.isHost) this.transferHost();
    this.broadcast();
    if (this.humanCount() === 0) {
      this.onEmpty?.(this);
    }
  }

  markDisconnected(socketId: string): void {
    const p = this.findBySocket(socketId);
    if (!p || p.isAI) return;
    p.connected = false;
    p.socketId = null;
    p.reconnectUntil = Date.now() + config.reconnectGraceMs;
    this.io.to(this.roomId).emit("player:disconnect", { playerId: p.id });
    this.broadcast();

    const existingTimer = this.disconnectTimers.get(p.id);
    if (existingTimer) clearTimeout(existingTimer);
    const dt = setTimeout(() => {
      this.disconnectTimers.delete(p.id);
      this.handleDisconnectExpiry(p.id);
    }, config.reconnectGraceMs);
    this.disconnectTimers.set(p.id, dt);
  }

  private handleDisconnectExpiry(playerId: string): void {
    if (this.destroyed) return;
    const p = this.players.find((x) => x.id === playerId);
    if (!p || p.connected) return;

    if (this.status === "LOBBY") {
      this.players = this.players.filter((x) => x.id !== p.id);
      if (p.isHost) this.transferHost();
      this.broadcast();
      if (this.humanCount() === 0) {
        this.onEmpty?.(this);
      }
      return;
    }

    if (this.status === "COUNTDOWN" || this.status === "IN_GAME") {
      p.eliminated = true;
      p.reconnectUntil = null;
      this.broadcast();

      if (this.phase === "CHOOSING" && this.activePlayers().every((pl) => pl.locked)) {
        this.allLocked();
      }

      const alive = this.activePlayers();
      const connectedHumans = this.connectedHumans();
      if (connectedHumans.length === 0 || alive.length <= 1) {
        this.finishGame();
      }
      return;
    }

    if (this.status === "GAME_OVER") {
      if (this.connectedHumans().length === 0) {
        this.onEmpty?.(this);
      }
    }
  }

  tryReconnect(userId: string, socketId: string): boolean {
    const p = this.findByUserId(userId);
    if (!p) return false;
    if (
      p.reconnectUntil !== null &&
      Date.now() > p.reconnectUntil &&
      (this.status === "COUNTDOWN" || this.status === "IN_GAME")
    ) {
      return false;
    }
    const dt = this.disconnectTimers.get(p.id);
    if (dt) clearTimeout(dt);
    this.disconnectTimers.delete(p.id);

    if (p.socketId === socketId && p.connected) {
      this.io.in(socketId).socketsJoin(this.roomId);
      return true;
    }
    p.connected = true;
    p.socketId = socketId;
    p.reconnectUntil = null;
    this.io.in(socketId).socketsJoin(this.roomId);
    this.io.to(this.roomId).emit("player:reconnect", { playerId: p.id });
    this.broadcast();
    return true;
  }

  transferHost(): void {
    const human = this.players.find((p) => !p.isAI && p.connected) ?? this.players.find((p) => !p.isAI);
    this.players.forEach((p) => {
      p.isHost = false;
    });
    if (human) {
      human.isHost = true;
      this.hostUserId = human.userId ?? this.hostUserId;
    }
  }

  setReady(userId: string, ready: boolean): void {
    const p = this.findByUserId(userId);
    if (!p || p.isAI || this.status !== "LOBBY") return;
    p.ready = ready;
    this.broadcast();
  }

  canStart(userId: string): { ok: boolean; error?: string } {
    const p = this.findByUserId(userId);
    if (!p?.isHost) return { ok: false, error: "Only the host can start." };
    if (this.status !== "LOBBY" && this.status !== "MATCHMAKING") {
      return { ok: false, error: "Game already in progress." };
    }
    this.fillAIIfNeeded(false);
    if (this.players.length < 2) return { ok: false, error: "Need at least 2 players (enable AI fill or invite friends)." };
    const humans = this.players.filter((x) => !x.isAI);
    const disconnected = humans.find((h) => !h.connected);
    if (disconnected) {
      return { ok: false, error: `${disconnected.name} is disconnected.` };
    }
    if (humans.some((h) => !h.ready && !h.isHost)) {
      return { ok: false, error: "Waiting for players to ready up." };
    }
    return { ok: true };
  }

  startGame(): void {
    this.fillAIIfNeeded(false);
    this.status = "COUNTDOWN";
    this.phase = "COUNTDOWN";
    this.currentRound = 0;
    this.lastCalculation = null;
    this.lastAverage = null;
    this.lastTarget = null;
    this.lastWinnerChoice = null;
    this.players.forEach((p) => {
      p.score = 0;
      p.eliminated = false;
      p.choice = null;
      p.locked = false;
      p.ready = true;
    });
    this.persistGameStart();
    this.broadcast();
    this.emitCountdown(Math.round(config.countdownMs / 1000));
    this.schedule(config.countdownMs, () => this.beginRound());
  }

  private emitCountdown(seconds: number): void {
    const endsAt = Date.now() + seconds * 1000;
    this.io.to(this.roomId).emit("game:countdown", {
      seconds,
      endsAt,
      serverNow: Date.now(),
    });
  }

  private beginRound(): void {
    const alive = this.activePlayers();
    if (alive.filter((p) => !p.isAI).length === 0 && alive.every((p) => p.isAI)) {
      this.finishGame();
      return;
    }
    if (alive.length <= 1) {
      this.finishGame();
      return;
    }
    if (this.currentRound >= this.settings.rounds) {
      this.finishGame();
      return;
    }
    this.currentRound += 1;
    this.status = "IN_GAME";
    this.phase = "CHOOSING";
    this.lastCalculation = null;
    this.players.forEach((p) => {
      p.choice = null;
      p.locked = false;
    });
    const ms = choiceMs(this.settings.difficulty);
    this.broadcast();
    this.emitCountdown(Math.round(ms / 1000));
    this.scheduleAILocks();
    this.schedule(ms, () => this.lockTimeExpired());
  }

  private scheduleAILocks(): void {
    const aliveAI = this.activePlayers().filter((p) => p.isAI);
    for (const ai of aliveAI) {
      const delay = 1800 + Math.random() * 7000;
      const t = setTimeout(() => {
        if (this.destroyed || this.phase !== "CHOOSING" || ai.eliminated) return;
        this.lockChoice(ai, this.computeAIChoice(ai));
      }, delay);
      this.aiTimers.push(t);
    }
  }

  private computeAIChoice(ai: InternalPlayer): number {
    return chooseAINumber({
      kind: ai.aiKind ?? "RATIONAL",
      round: this.currentRound,
      totalRounds: this.settings.rounds,
      multiplier: ruleForRound(this.currentRound, this.settings.rounds).multiplier,
      myScore: ai.score,
      activeCount: this.activePlayers().length,
      lastAverage: this.lastAverage,
      lastTarget: this.lastTarget,
      lastWinnerChoice: this.lastWinnerChoice,
      humanChoices: this.humanChoiceHistory,
      myHistory: [],
      difficulty: this.settings.difficulty,
    });
  }

  submitChoice(userId: string, choice: number): { ok: boolean; error?: string } {
    const p = this.findByUserId(userId);
    if (!p) return { ok: false, error: "You are not in this room." };
    if (this.phase !== "CHOOSING") return { ok: false, error: "Submission window is closed." };
    if (p.eliminated) return { ok: false, error: "You are eliminated." };
    if (p.locked) return { ok: false, error: "Number already locked." };
    if (!Number.isInteger(choice) || choice < 0 || choice > 100) {
      return { ok: false, error: "Choice must be an integer from 0 to 100." };
    }
    this.lockChoice(p, choice);
    return { ok: true };
  }

  private lockChoice(player: InternalPlayer, choice: number): void {
    if (player.locked || player.eliminated || this.phase !== "CHOOSING") return;
    player.choice = choice;
    player.locked = true;
    this.io.to(this.roomId).emit("choice:locked", { playerId: player.id });
    this.broadcast();
    if (this.activePlayers().every((p) => p.locked)) {
      this.allLocked();
    }
  }

  private lockTimeExpired(): void {
    if (this.phase !== "CHOOSING") return;
    for (const p of this.activePlayers()) {
      if (!p.locked) {
        if (p.isAI) this.lockChoice(p, this.computeAIChoice(p));
        else {
          // Late humans who never submitted get a null choice and lose the round.
          p.locked = true;
          p.choice = null;
        }
      }
    }
    this.allLocked();
  }

  private allLocked(): void {
    if (this.phase !== "CHOOSING") return;
    this.clearTimer();
    this.phase = "LOCKED";
    this.io.to(this.roomId).emit("round:allLocked");
    this.broadcast();
    this.schedule(900, () => this.runCalculation());
  }

  private runCalculation(): void {
    const rule = ruleForRound(this.currentRound, this.settings.rounds);
    const alive = this.activePlayers();
    const entries = alive
      .filter((p) => p.choice != null)
      .map((p) => ({ playerId: p.id, choice: p.choice as number }));
    const resolved = markDuplicates(entries, rule.id);
    const validNums = resolved.filter((r) => r.valid).map((r) => r.choice);
    const average = calculateAverage(validNums);
    const target = calculateTarget(average, rule.multiplier);
    const winners = determineWinners(resolved, target, rule.id);

    const prevScores: Record<string, number> = {};
    const nextSeed: Record<string, number> = {};
    for (const p of this.players) {
      prevScores[p.id] = p.score;
      nextSeed[p.id] = p.score;
    }
    const scored = applyRoundScores(
      nextSeed,
      alive.map((p) => p.id),
      winners.winnerIds,
    );
    const already = new Set(this.players.filter((p) => p.eliminated).map((p) => p.id));
    const eliminatedIds = newlyEliminated(prevScores, scored, already);

    for (const p of this.players) {
      p.score = scored[p.id] ?? p.score;
      if (eliminatedIds.includes(p.id) || p.score <= ELIMINATION_SCORE) {
        p.eliminated = true;
      }
    }

    this.phase = "CALCULATING";
    const resolvedMap = new Map(resolved.map((r) => [r.playerId, r]));
    const revealed: RevealedPlayer[] = this.players.map((p) => {
      const r = resolvedMap.get(p.id);
      const choice = p.choice;
      const valid = r ? r.valid : false;
      const dist = choice != null && valid ? round2(Math.abs(choice - target)) : null;
      return {
        ...this.toPublic(p, null),
        status: p.eliminated
          ? "ELIMINATED"
          : winners.winnerIds.includes(p.id)
            ? "WINNER"
            : p.locked
              ? "LOCKED"
              : "THINKING",
        choice,
        distance: dist,
        valid,
      };
    });

    this.lastAverage = average;
    this.lastTarget = target;
    const winnerPlayer = this.players.find((p) => winners.winnerIds.includes(p.id));
    this.lastWinnerChoice = winnerPlayer?.choice ?? null;
    for (const p of this.players) {
      if (!p.isAI && p.choice != null) this.humanChoiceHistory.push(p.choice);
    }
    // Cap history to prevent unbounded memory growth in long sessions
    if (this.humanChoiceHistory.length > 50) {
      this.humanChoiceHistory = this.humanChoiceHistory.slice(-50);
    }

    const payload: CalculationPayload = {
      round: this.currentRound,
      multiplier: rule.multiplier,
      rule,
      players: revealed,
      average: round2(average),
      target: round2(target),
      winnerIds: winners.winnerIds,
      perfectHit: winners.perfectHit,
      tieBreak: winners.tieBreak,
      eliminatedIds,
    };
    this.lastCalculation = payload;
    this.io.to(this.roomId).emit("round:calculating", payload);
    this.broadcast();
    this.schedule(config.calculationDurationMs, () => this.showResult(payload));
  }

  private showResult(payload: CalculationPayload): void {
    this.phase = "RESULT";
    this.io.to(this.roomId).emit("round:result", payload);
    this.broadcast();
    this.schedule(config.resultDurationMs, () => {
      if (payload.eliminatedIds.length) this.showElimination(payload);
      else this.afterRound();
    });
  }

  private showElimination(payload: CalculationPayload): void {
    this.phase = "ELIMINATION";
    const names = payload.eliminatedIds.map(
      (id) => this.players.find((p) => p.id === id)?.name ?? "UNKNOWN",
    );
    const scores = payload.eliminatedIds.map(
      (id) => this.players.find((p) => p.id === id)?.score ?? ELIMINATION_SCORE,
    );
    this.io.to(this.roomId).emit("round:elimination", {
      playerIds: payload.eliminatedIds,
      names,
      scores,
    });
    this.broadcast();
    this.schedule(config.eliminationDurationMs, () => this.afterRound());
  }

  private afterRound(): void {
    const alive = this.activePlayers();
    const humansAlive = alive.filter((p) => !p.isAI);
    if (alive.length <= 1 || humansAlive.length === 0 || this.currentRound >= this.settings.rounds) {
      this.finishGame();
      return;
    }
    this.phase = "NEXT_ROUND";
    this.io.to(this.roomId).emit("round:complete", this.snapshot(null));
    this.broadcast();
    this.schedule(1600, () => this.beginRound());
  }

  private async persistGameStart(): Promise<void> {
    const game = await createGameRecord(this.roomId);
    this.persistedGameId = game?.id ?? null;
  }

  private async persistGameEnd(over: GameOverPayload): Promise<void> {
    if (this.persistedGameId) {
      await completeGameRecord({
        gameId: this.persistedGameId,
        winnerId: over.winnerId,
        placements: over.placements.map((row) => {
          const player = this.players.find((p) => p.id === row.playerId);
          return {
            userId: player?.userId ?? null,
            displayName: row.name,
            isAI: row.isAI,
            finalScore: row.score,
            placement: row.placement,
          };
        }),
      });
    }
    for (const row of over.placements) {
      const player = this.players.find((p) => p.id === row.playerId);
      if (player?.userId) {
        await applyGameStats({
          userId: player.userId,
          score: player.score,
          isWin: over.winnerId === player.id,
        });
      }
    }
  }

  finishGame(): void {
    this.clearTimer();
    this.status = "GAME_OVER";
    this.phase = "GAME_OVER";
    const ranked = placementsFromScores(
      this.players.map((p) => ({
        id: p.id,
        score: p.score,
        eliminated: p.eliminated,
        joinOrder: p.joinOrder,
      })),
    );
    const placements = ranked.map((r) => {
      const p = this.players.find((x) => x.id === r.id)!;
      return {
        playerId: p.id,
        name: p.name,
        avatar: p.avatar,
        score: p.score,
        placement: r.placement,
        isAI: p.isAI,
      };
    });
    const winnerCandidate = placements[0] ? this.players.find((x) => x.id === placements[0].playerId) : null;
    const winner = winnerCandidate && !winnerCandidate.eliminated ? placements[0] : null;
    const over: GameOverPayload = {
      winnerId: winner?.playerId ?? null,
      winnerName: winner?.name ?? null,
      placements,
    };
    void this.persistGameEnd(over);
    this.io.to(this.roomId).emit("game:over", over);
    this.broadcast();

    // Auto-cleanup after 10 minutes in GAME_OVER if abandoned
    this.schedule(10 * 60 * 1000, () => {
      this.onEmpty?.(this);
    });
  }

  rematch(userId: string): { ok: boolean; error?: string } {
    const p = this.findByUserId(userId);
    if (!p) return { ok: false, error: "Not in room." };
    if (this.status !== "GAME_OVER") return { ok: false, error: "Game is still running." };
    this.rematchVotes.add(userId);
    const humans = this.players.filter((x) => !x.isAI && x.connected);
    if (p.isHost || humans.every((h) => this.rematchVotes.has(h.userId ?? ""))) {
      this.rematchVotes.clear();
      this.clearTimer();
      this.persistedGameId = null;
      this.lastAverage = null;
      this.lastTarget = null;
      this.lastWinnerChoice = null;
      this.status = "LOBBY";
      this.phase = "LOBBY";
      this.currentRound = 0;
      this.lastCalculation = null;
      this.players.forEach((pl) => {
        pl.score = 0;
        pl.eliminated = false;
        pl.choice = null;
        pl.locked = false;
        pl.ready = pl.isAI;
      });
      this.broadcast();
      return { ok: true };
    }
    this.broadcast();
    return { ok: true };
  }

  toPublic(p: InternalPlayer, viewerUserId: string | null): PublicPlayer {
    let status: PublicPlayer["status"] = "WAITING";
    if (p.eliminated) status = "ELIMINATED";
    else if (!p.connected && !p.isAI) status = "DISCONNECTED";
    else if (this.phase === "CHOOSING") status = p.locked ? "LOCKED" : "THINKING";
    else if (this.phase === "LOCKED" || this.phase === "CALCULATING" || this.phase === "RESULT") {
      status = this.lastCalculation?.winnerIds.includes(p.id) ? "WINNER" : p.locked ? "LOCKED" : "THINKING";
    } else if (this.status === "LOBBY" || this.status === "MATCHMAKING") {
      status = p.ready || p.isAI ? "READY" : "WAITING";
    } else if (this.phase === "GAME_OVER") {
      status = p.eliminated ? "ELIMINATED" : "READY";
    }
    return {
      id: p.id,
      userId: p.userId,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      status,
      isAI: p.isAI,
      aiKind: p.aiKind,
      isHost: p.isHost,
      connected: p.connected,
      slot: p.slot,
    };
  }

  snapshot(viewerUserId: string | null): RoomSnapshot {
    const you = viewerUserId ? this.findByUserId(viewerUserId) : undefined;
    const rule = ruleForRound(Math.max(this.currentRound, 1), this.settings.rounds);
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      hostId: this.hostUserId,
      status: this.status,
      settings: this.settings,
      players: this.players
        .slice()
        .sort((a, b) => a.slot - b.slot)
        .map((p) => this.toPublic(p, viewerUserId)),
      phase: this.phase,
      currentRound: this.currentRound,
      totalRounds: this.settings.rounds,
      rule,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: Date.now(),
      youAreHost: you?.isHost ?? false,
      yourPlayerId: you?.id ?? null,
      yourLocked: you?.locked ?? false,
      yourChoice: you?.choice ?? null,
    };
  }

  broadcast(): void {
    for (const p of this.players) {
      if (p.socketId) {
        this.io.to(p.socketId).emit("room:update", this.snapshot(p.userId));
        this.io.to(p.socketId).emit("game:state", this.snapshot(p.userId));
      }
    }
  }
}
