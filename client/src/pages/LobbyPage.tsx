import { motion } from "framer-motion";
import { DoorOpen, Plus, Zap } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { ConnectionIndicator } from "../components/ConnectionIndicator";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { useRequireAuth } from "../hooks/useAuth";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function LobbyPage() {
  const { user, authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const setNotice = useAppStore((s) => s.setNotice);
  const room = useAppStore((s) => s.room);

  useEffect(() => {
    if (room && (room.status === "COUNTDOWN" || room.status === "IN_GAME" || room.status === "GAME_OVER")) {
      navigate("/arena", { replace: true });
    } else if (room && room.status === "LOBBY") {
      navigate("/room", { replace: true });
    }
  }, [room, navigate]);

  if (authLoading || !user) return null;

  const playNow = async () => {
    try {
      await gameApi.joinMatchmaking();
      navigate("/matchmaking");
    } catch {
      setNotice("Could not start matchmaking.");
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <button
            type="button"
            className="focus-ring flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2"
            onClick={() => navigate("/profile")}
          >
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-9 w-9 rounded-lg object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800">{user.name[0]}</div>
            )}
            <span className="font-medium">{user.name}</span>
          </button>
          <ConnectionIndicator />
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="font-mono text-xs uppercase tracking-[0.4em] text-cyan-300">King of Diamonds</p>
          <h1 className="mt-2 text-4xl font-bold tracking-wide md:text-5xl">Ready to play?</h1>
          <p className="mt-3 max-w-xl text-slate-400">
            Choose your arena. Match publicly, claim a private table, or slip in with a room code — every diamond has a throne.
          </p>
        </motion.div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <LobbyCard
            icon={<Zap className="text-rose-300" />}
            title="Play Now"
            desc="Find opponents. AI fills empty seats after timeout."
            action="Matchmake"
            onClick={() => void playNow()}
            glow="red"
          />
          <LobbyCard
            icon={<Plus className="text-cyan-300" />}
            title="Create Room"
            desc="Set rules, get a code, invite friends."
            action="Create"
            onClick={() => navigate("/create")}
            glow="blue"
          />
          <LobbyCard
            icon={<DoorOpen className="text-violet-300" />}
            title="Join Room"
            desc="Enter a five-character room code."
            action="Join"
            onClick={() => navigate("/join")}
            glow="violet"
          />
        </div>
      </div>
    </div>
  );
}

function LobbyCard({
  icon,
  title,
  desc,
  action,
  onClick,
  glow,
}: {
  icon: ReactNode;
  title: string;
  desc: string;
  action: string;
  onClick: () => void;
  glow: "red" | "blue" | "violet";
}) {
  return (
    <GlassPanel glow={glow} className="flex flex-col p-6">
      <div className="mb-4">{icon}</div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 flex-1 text-sm text-slate-400">{desc}</p>
      <div className="mt-6">
        <NeonButton full variant={glow === "red" ? "primary" : glow === "blue" ? "secondary" : "ghost"} onClick={onClick}>
          {action}
        </NeonButton>
      </div>
    </GlassPanel>
  );
}
