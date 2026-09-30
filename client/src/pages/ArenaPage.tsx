import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { CalculationSequence } from "../components/CalculationSequence";
import { ConnectionIndicator } from "../components/ConnectionIndicator";
import { Countdown } from "../components/Countdown";
import { EliminationOverlay } from "../components/EliminationOverlay";
import { GamePhaseIndicator } from "../components/GamePhaseIndicator";
import { Leaderboard } from "../components/Leaderboard";
import { NeonButton } from "../components/NeonButton";
import { NumberSlider } from "../components/NumberSlider";
import { Numpad } from "../components/Numpad";
import { PlayerCard } from "../components/PlayerCard";
import { TargetDisplay } from "../components/TargetDisplay";
import { WinnerOverlay } from "../components/WinnerOverlay";
import { useRequireAuth } from "../hooks/useAuth";
import { useServerCountdown } from "../hooks/useServerCountdown";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function ArenaPage() {
  const { authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const room = useAppStore((s) => s.room);
  const connection = useAppStore((s) => s.connection);
  const calculation = useAppStore((s) => s.calculation);
  const elimination = useAppStore((s) => s.elimination);
  const gameOver = useAppStore((s) => s.gameOver);
  const setNotice = useAppStore((s) => s.setNotice);
  const clearMatch = useAppStore((s) => s.clearMatch);
  const setGameOver = useAppStore((s) => s.setGameOver);
  const seconds = useServerCountdown();
  const [choice, setChoice] = useState(37);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && connection === "connected" && !room) {
      navigate("/lobby", { replace: true });
    }
  }, [room, authLoading, connection, navigate]);

  useEffect(() => {
    if (room?.status === "LOBBY" && room.phase === "LOBBY") {
      setGameOver(null);
      navigate("/room", { replace: true });
    }
  }, [room?.status, room?.phase, navigate, setGameOver]);

  if (!room) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <p className="relative z-10 font-mono text-cyan-200">Synchronizing arena...</p>
      </div>
    );
  }

  const me = room.players.find((p) => p.id === room.yourPlayerId);
  const eliminated = me?.status === "ELIMINATED";
  const locked = room.yourLocked;
  const choosing = room.phase === "CHOOSING" && !locked && !eliminated;
  const showCalc =
    calculation &&
    (room.phase === "CALCULATING" || room.phase === "RESULT" || room.phase === "LOCKED");
  const showWinner = calculation && room.phase === "RESULT";
  const players = room.players;

  const lockNumber = async () => {
    setSubmitting(true);
    try {
      const res = await gameApi.submitChoice(choice);
      if (!res.ok) setNotice(res.error ?? "Could not lock number.");
    } finally {
      setSubmitting(false);
    }
  };

  if (gameOver && room.phase === "GAME_OVER") {
    return (
      <div className="relative min-h-dvh overflow-hidden">
        <ArenaBackground />
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-10">
          <Leaderboard
            payload={gameOver}
            onRematch={async () => {
              const res = await gameApi.rematch();
              if (!res.ok) setNotice(res.error ?? "Rematch failed.");
            }}
            onLobby={() => {
              gameApi.leaveRoom();
              clearMatch();
              navigate("/lobby");
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      {elimination && room.phase === "ELIMINATION" && (
        <EliminationOverlay names={elimination.names} scores={elimination.scores} />
      )}

      <div className="relative z-10 mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan-300">
              Round {String(room.currentRound).padStart(2, "0")} / {String(room.totalRounds).padStart(2, "0")}
            </p>
            <h1 className="text-lg font-semibold tracking-wide md:text-xl">King of Diamonds</h1>
          </div>
          <div className="flex items-center gap-3">
            <GamePhaseIndicator phase={room.phase} />
            <ConnectionIndicator />
          </div>
        </header>

        <div className="mb-4 rounded-xl border border-violet-400/30 bg-violet-950/30 px-4 py-3">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-violet-200">{room.rule.title}</p>
          <p className="mt-1 text-sm text-slate-300">{room.rule.description}</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
          <div className="space-y-3">
            {players.slice(0, Math.ceil(players.length / 2)).map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>

          <div className="flex flex-col items-center justify-center gap-4">
            <TargetDisplay
              target={calculation?.target ?? null}
              multiplier={room.rule.multiplier}
              revealed={Boolean(calculation) && room.phase !== "CHOOSING" && room.phase !== "COUNTDOWN"}
            />
            {(room.phase === "CHOOSING" || room.phase === "COUNTDOWN") && (
              <Countdown seconds={seconds} label={room.phase === "COUNTDOWN" ? "Starting" : "Time remaining"} />
            )}
          </div>

          <div className="space-y-3">
            {players.slice(Math.ceil(players.length / 2)).map((p) => (
              <PlayerCard key={p.id} player={p} />
            ))}
          </div>
        </div>

        {showCalc && (
          <div className="mt-6">
            <CalculationSequence payload={calculation} />
          </div>
        )}

        {showWinner && (
          <WinnerOverlay
            payload={calculation}
            announcementKey={`${room.roomId}-r${calculation.round}-${calculation.winnerIds.join(",")}`}
          />
        )}

        {(choosing || locked || eliminated) && room.phase === "CHOOSING" && (
          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-white/10 bg-slate-950/80 p-5 backdrop-blur">
            <p className="text-center font-mono text-xs uppercase tracking-[0.3em] text-slate-400">
              {eliminated ? "Eliminated" : locked ? "Number locked" : "Your number"}
            </p>
            <p className="mt-2 text-center font-mono text-5xl font-bold text-white">
              {locked ? room.yourChoice ?? choice : choice}
            </p>
            {!locked && !eliminated && (
              <>
                <div className="mt-5">
                  <NumberSlider value={choice} onChange={setChoice} />
                </div>
                <div className="mt-4">
                  <Numpad value={choice} onChange={setChoice} />
                </div>
                <div className="mt-5">
                  <NeonButton full disabled={submitting} onClick={() => void lockNumber()}>
                    Lock number
                  </NeonButton>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
