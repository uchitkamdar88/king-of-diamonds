import { useAppStore } from "../stores/appStore";

export function ConnectionIndicator() {
  const connection = useAppStore((s) => s.connection);
  const label =
    connection === "connected"
      ? "Connected"
      : connection === "reconnecting" || connection === "connecting"
        ? "Reconnecting..."
        : "Disconnected";
  const color =
    connection === "connected"
      ? "bg-emerald-400"
      : connection === "disconnected"
        ? "bg-red-500"
        : "bg-amber-400";

  return (
    <div
      className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-300"
      aria-live="polite"
    >
      <span className={`h-2 w-2 rounded-full ${color} ${connection !== "connected" ? "animate-pulse" : ""}`} />
      {label}
    </div>
  );
}
