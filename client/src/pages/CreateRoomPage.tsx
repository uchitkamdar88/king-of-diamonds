import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DEFAULT_SETTINGS, type Difficulty, type RoomSettings } from "@kod/shared";
import { ArenaBackground } from "../components/ArenaBackground";
import { GlassPanel } from "../components/GlassPanel";
import { NeonButton } from "../components/NeonButton";
import { useRequireAuth } from "../hooks/useAuth";
import { gameApi } from "../services/socket";
import { useAppStore } from "../stores/appStore";

export function CreateRoomPage() {
  useRequireAuth();
  const navigate = useNavigate();
  const setNotice = useAppStore((s) => s.setNotice);
  const [settings, setSettings] = useState<RoomSettings>({ ...DEFAULT_SETTINGS });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const res = await gameApi.createRoom(settings);
      if (!res.ok) {
        setNotice(res.error ?? "Could not create room.");
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
      <div className="relative z-10 mx-auto max-w-xl px-4 py-10">
        <GlassPanel className="p-6 md:p-8">
          <h1 className="text-2xl font-semibold">Create Room</h1>
          <p className="mt-2 text-sm text-slate-400">Defaults: 4 players · 10 rounds · AI fill on · private</p>

          <label className="mt-6 block">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Room name</span>
            <input
              className="focus-ring mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3"
              value={settings.name}
              onChange={(e) => setSettings({ ...settings, name: e.target.value.slice(0, 32) })}
            />
          </label>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Toggle
              label="Visibility"
              value={settings.visibility}
              options={["PRIVATE", "PUBLIC"] as const}
              onChange={(visibility) => setSettings({ ...settings, visibility })}
            />
            <Toggle
              label="AI Fill"
              value={settings.aiFill ? "ON" : "OFF"}
              options={["ON", "OFF"] as const}
              onChange={(v) => setSettings({ ...settings, aiFill: v === "ON" })}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Players</span>
              <select
                className="focus-ring mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3"
                value={settings.maxPlayers}
                onChange={(e) =>
                  setSettings({ ...settings, maxPlayers: Number(e.target.value) as 2 | 3 | 4 })
                }
              >
                {[2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Rounds</span>
              <select
                className="focus-ring mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3"
                value={settings.rounds}
                onChange={(e) => setSettings({ ...settings, rounds: Number(e.target.value) })}
              >
                {[5, 8, 10, 12].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="mt-5 block">
            <span className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">Difficulty</span>
            <select
              className="focus-ring mt-2 w-full rounded-xl border border-white/15 bg-black/40 px-4 py-3"
              value={settings.difficulty}
              onChange={(e) => setSettings({ ...settings, difficulty: e.target.value as Difficulty })}
            >
              <option value="STANDARD">Standard</option>
              <option value="HARD">Hard</option>
              <option value="EXTREME">Extreme</option>
            </select>
          </label>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <NeonButton disabled={busy} onClick={() => void create()}>
              Create room
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

function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-slate-500">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`focus-ring rounded-xl border px-3 py-3 font-mono text-xs uppercase tracking-widest ${
              value === opt ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-100" : "border-white/10 bg-black/30"
            }`}
            onClick={() => onChange(opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
