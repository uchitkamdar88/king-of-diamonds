import { useEffect, useState } from "react";
import { useAppStore } from "../stores/appStore";

export function useServerCountdown() {
  const endsAt = useAppStore((s) => s.countdownEndsAt);
  const offset = useAppStore((s) => s.serverOffset);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!endsAt) {
      setSeconds(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAt - (Date.now() + offset)) / 1000));
      setSeconds(remaining);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [endsAt, offset]);

  return seconds;
}
