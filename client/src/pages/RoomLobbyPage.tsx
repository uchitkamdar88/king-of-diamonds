import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { ConnectionIndicator } from "../components/ConnectionIndicator";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { PlayerList } from "../components/PlayerList";
import { RoomCode } from "../components/RoomCode";
import { useRequireAuth } from "../hooks/useAuth";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";
import { sound } from "../services/sound";

export function RoomLobbyPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const room = useAppStore((s) => s.room);
  const setNotice = useAppStore((s) => s.setNotice);
  const clearMatch = useAppStore((s) => s.clearMatch);

  useEffect(() => {
    if (!room) return;
    if (room.status === "COUNTDOWN" || room.status === "IN_GAME") {
      sound.play("GAME_START");
      navigate("/arena", { replace: true });
    }
  }, [room, navigate]);

  if (!room) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center">
        <ArenaBackground />
        <GlassPanel className="relative z-10 p-8 text-center">
          <p>No active room.</p>
          <div className="mt-4">
            <NeonButton onClick={() => navigate("/lobby")}>Back to lobby</NeonButton>
          </div>
        </GlassPanel>
      </div>
    );
  }

  const me = room.players.find((p) => p.id === room.yourPlayerId);
  const ready = me?.status === "READY";

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-cyan-300">King of Diamonds</p>
            <h1 className="text-2xl font-semibold">{room.settings.name}</h1>
          </div>
          <ConnectionIndicator />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <GlassPanel className="p-5">
            <PlayerList players={room.players} />
          </GlassPanel>
          <GlassPanel glow="red" className="p-5">
            <RoomCode code={room.roomCode} />
            <div className="mt-6 space-y-2 font-mono text-xs text-slate-400">
              <p>Players: {room.settings.maxPlayers}</p>
              <p>Rounds: {room.settings.rounds}</p>
              <p>AI Fill: {room.settings.aiFill ? "ON" : "OFF"}</p>
              <p>Visibility: {room.settings.visibility}</p>
            </div>
            <div className="mt-6 space-y-3">
              <NeonButton
                full
                variant={ready ? "secondary" : "primary"}
                onClick={() => gameApi.setReady(!ready)}
              >
                {ready ? "Unready" : "Ready"}
              </NeonButton>
              {room.youAreHost && (
                <NeonButton
                  full
                  onClick={async () => {
                    const res = await gameApi.startGame();
                    if (!res.ok) setNotice(res.error ?? "Cannot start yet.");
                  }}
                >
                  Start game
                </NeonButton>
              )}
              <NeonButton
                full
                variant="ghost"
                onClick={() => {
                  gameApi.leaveRoom();
                  clearMatch();
                  navigate("/lobby");
                }}
              >
                Leave room
              </NeonButton>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
