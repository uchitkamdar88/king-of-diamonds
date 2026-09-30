import { Minus, Plus } from "lucide-react";

export function NumberSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Decrease number"
          disabled={disabled}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/5"
          onClick={() => onChange(Math.max(0, value - 1))}
        >
          <Minus size={16} />
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          aria-label="Choose number from 0 to 100"
          className="w-full accent-rose-500"
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <button
          type="button"
          aria-label="Increase number"
          disabled={disabled}
          className="focus-ring flex h-11 w-11 items-center justify-center rounded-lg border border-white/15 bg-white/5"
          onClick={() => onChange(Math.min(100, value + 1))}
        >
          <Plus size={16} />
        </button>
      </div>
    </div>
  );
}
