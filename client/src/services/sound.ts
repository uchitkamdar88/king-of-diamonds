export type SoundEvent =
  | "UI_CLICK"
  | "COUNTDOWN"
  | "LOCK"
  | "ALL_LOCKED"
  | "CALCULATING"
  | "TARGET_REVEAL"
  | "WINNER"
  | "ELIMINATION"
  | "GAME_START"
  | "GAME_END";

type Listener = (event: SoundEvent) => void;

class SoundManager {
  private enabled = true;
  private listeners = new Set<Listener>();
  private ctx: AudioContext | null = null;

  setEnabled(on: boolean) {
    this.enabled = on;
  }

  on(listener: Listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private ensureCtx() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
    }
    return this.ctx;
  }

  play(event: SoundEvent) {
    if (!this.enabled) return;
    for (const l of this.listeners) l(event);
    try {
      this.beep(event);
    } catch {
      /* audio optional */
    }
  }

  private beep(event: SoundEvent) {
    const ctx = this.ensureCtx();
    if (ctx.state === "suspended") void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    const map: Record<SoundEvent, { f: number; d: number; type: OscillatorType }> = {
      UI_CLICK: { f: 880, d: 0.04, type: "square" },
      COUNTDOWN: { f: 520, d: 0.08, type: "triangle" },
      LOCK: { f: 660, d: 0.1, type: "sawtooth" },
      ALL_LOCKED: { f: 420, d: 0.18, type: "square" },
      CALCULATING: { f: 300, d: 0.2, type: "triangle" },
      TARGET_REVEAL: { f: 740, d: 0.25, type: "sine" },
      WINNER: { f: 980, d: 0.35, type: "sine" },
      ELIMINATION: { f: 110, d: 0.4, type: "sawtooth" },
      GAME_START: { f: 540, d: 0.22, type: "square" },
      GAME_END: { f: 360, d: 0.4, type: "triangle" },
    };
    const cfg = map[event];
    osc.type = cfg.type;
    osc.frequency.setValueAtTime(cfg.f, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + cfg.d);
    osc.start(now);
    osc.stop(now + cfg.d + 0.02);
  }
}

export const sound = new SoundManager();
