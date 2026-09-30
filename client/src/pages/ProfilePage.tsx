import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { ConnectionIndicator } from "../components/ConnectionIndicator";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { useRequireAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { disconnectSocket } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function ProfilePage() {
  const { user, authLoading } = useRequireAuth();
  const navigate = useNavigate();
  const setUser = useAppStore((s) => s.setUser);

  if (authLoading || !user) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <p className="relative z-10 font-mono text-cyan-200">Loading profile...</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto max-w-lg px-4 py-10">
        <div className="mb-4 flex justify-end">
          <ConnectionIndicator />
        </div>
        <GlassPanel glow="blue" className="p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.35em] text-slate-400">Player Profile</p>
          <div className="mx-auto mt-6 h-24 w-24 overflow-hidden rounded-2xl border border-cyan-400/40 bg-slate-800 shadow-[0_0_30px_rgba(61,231,255,0.2)]">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl text-cyan-200">
                {user.name.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-wide uppercase">{user.name}</h1>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <Stat label="Games" value={String(user.gamesPlayed)} />
            <Stat label="Wins" value={String(user.gamesWon)} />
            <Stat label="Win Rate" value={`${user.winRate}%`} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Best Score" value={user.bestScore == null ? "—" : String(user.bestScore)} />
            <Stat label="Losses" value={String(user.totalLosses)} />
          </div>
          <div className="mt-8 space-y-3">
            <NeonButton full onClick={() => navigate("/lobby")}>
              Continue to lobby
            </NeonButton>
            <NeonButton
              full
              variant="ghost"
              onClick={async () => {
                await api.logout();
                disconnectSocket();
                setUser(null);
                navigate("/login");
              }}
            >
              Sign out
            </NeonButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-1 font-mono text-xl text-cyan-100">{value}</p>
    </div>
  );
}
