import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { NeonButton } from "./NeonButton";

export function RoomCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="text-center">
      <p className="mb-2 font-mono text-xs uppercase tracking-[0.35em] text-slate-400">Invite your friends</p>
      <p className="font-mono text-4xl font-bold tracking-[0.35em] text-cyan-200 drop-shadow-[0_0_20px_rgba(61,231,255,0.35)]">
        {code}
      </p>
      <div className="mt-4 flex justify-center">
        <NeonButton variant="secondary" onClick={copy} aria-label="Copy room code">
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy code"}
        </NeonButton>
      </div>
    </div>
  );
}
