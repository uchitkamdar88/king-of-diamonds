import { Delete } from "lucide-react";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "DEL"] as const;

export function Numpad({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const apply = (key: (typeof KEYS)[number]) => {
    if (disabled) return;
    if (key === "CLR") {
      onChange(0);
      return;
    }
    if (key === "DEL") {
      onChange(Math.floor(value / 10));
      return;
    }
    const next = Number(`${value === 0 ? "" : value}${key}`);
    if (next <= 100) onChange(next);
  };

  return (
    <div className="grid grid-cols-3 gap-2" role="group" aria-label="Number pad">
      {KEYS.map((key) => (
        <button
          key={key}
          type="button"
          disabled={disabled}
          className="focus-ring flex h-12 items-center justify-center rounded-lg border border-cyan-400/20 bg-slate-900/80 font-mono text-lg text-cyan-50 transition hover:border-cyan-300/50 hover:bg-cyan-500/10 disabled:opacity-40"
          onClick={() => apply(key)}
          aria-label={key === "DEL" ? "Delete" : key === "CLR" ? "Clear" : `Digit ${key}`}
        >
          {key === "DEL" ? <Delete size={16} /> : key === "CLR" ? "C" : key}
        </button>
      ))}
    </div>
  );
}
