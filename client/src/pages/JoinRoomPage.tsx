import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { useRequireAuth } from "../hooks/useAuth";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function JoinRoomPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const setNotice = useAppStore((s) => s.setNotice);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const cleaned = code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 5);
    if (cleaned.length !== 5) {
      setNotice("Enter a valid 5-character room code.");
      return;
    }
    setBusy(true);
    try {
      const res = await gameApi.joinRoom(cleaned);
      if (!res.ok) {
        setNotice(res.error ?? "Could not join room.");
        return;
      }
      navigate("/room");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <ArenaBackground />
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-md items-center px-4">
        <GlassPanel className="w-full p-8 text-center">
          <h1 className="text-2xl font-semibold">Enter Room Code</h1>
          <div className="mt-8 flex justify-center gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex h-14 w-11 items-center justify-center rounded-xl border border-cyan-400/30 bg-black/40 font-mono text-2xl text-cyan-100"
              >
                {code[i] ?? "_"}
              </div>
            ))}
          </div>
          <input
            className="focus-ring mt-6 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3 text-center font-mono text-xl tracking-[0.4em] uppercase"
            value={code}
            maxLength={5}
            placeholder="K7X9Q"
            aria-label="Room code"
            onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === "Enter") void join();
            }}
          />
          <div className="mt-8 grid gap-3">
            <NeonButton disabled={busy} onClick={() => void join()}>
              Join room
            </NeonButton>
            <NeonButton variant="ghost" onClick={() => navigate("/lobby")}>
              Back
            </NeonButton>
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
