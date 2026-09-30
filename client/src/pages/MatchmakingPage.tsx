import { motion } from "framer-motion";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { useRequireAuth } from "../hooks/useAuth";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function MatchmakingPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const matchmaking = useAppStore((s) => s.matchmaking);
  const room = useAppStore((s) => s.room);

  useEffect(() => {
    if (!room) return;
    if (room.status === "COUNTDOWN" || room.status === "IN_GAME" || room.status === "GAME_OVER") {
      navigate("/arena", { replace: true });
      return;
    }
    if (room.status === "LOBBY") {
      navigate("/room", { replace: true });
    }
  }, [room, navigate]);

  const found = matchmaking?.playersFound ?? room?.players.filter((p) => !p.isAI).length ?? 1;
  const max = matchmaking?.maxPlayers ?? 4;

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-lg items-center px-4">
        <GlassPanel glow="red" className="w-full p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-rose-300">Searching for opponents...</p>
          <div className="relative mx-auto mt-10 h-40 w-40">
            <motion.div
              className="absolute inset-0 rounded-full border border-rose-400/40"
              animate={{ scale: [1, 1.15, 1], opacity: [0.8, 0.2, 0.8] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <motion.div
              className="absolute inset-4 rounded-full border border-cyan-400/50"
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-0 flex items-center justify-center font-mono text-3xl text-rose-200">♢</div>
          </div>
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Players found</p>
          <p className="font-mono text-4xl text-white">
            {found} / {max}
          </p>
          <p className="mt-3 text-slate-400">{matchmaking?.message ?? "Waiting for more players..."}</p>
          {room && (
            <div className="mt-6 space-y-2 text-left">
              {room.players.map((p) => (
                <div key={p.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-sm">
                  {p.name}
                </div>
              ))}
            </div>
          )}
          <div className="mt-8">
            <NeonButton
              variant="ghost"
              onClick={() => {
                gameApi.cancelMatchmaking();
                navigate("/lobby");
              }}
            >
              Cancel
            </NeonButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
