/**
 * Free browser Text-to-speech for dramatic game announcements.
 * Uses window.speechSynthesis — no paid voice APIs.
 */

let unlocked = false;
let lastAnnouncementId: string | null = null;
let preferredVoice: SpeechSynthesisVoice | null = null;

export function unlockSpeech(): void {
  unlocked = true;
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    // Warm voices list (Chrome populates asynchronously).
    window.speechSynthesis.getVoices();
    const warm = new SpeechSynthesisUtterance("");
    warm.volume = 0;
    window.speechSynthesis.speak(warm);
    window.speechSynthesis.cancel();
  } catch {
    /* optional */
  }
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return preferredVoice;

  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    const lang = v.lang.toLowerCase();
    let s = 0;
    if (lang.startsWith("en")) s += 10;
    if (/uk|gb|british|daniel|male|david|alex|fred|arthur|rishi|google uk/.test(name)) s += 8;
    if (/en-gb|en_gb/.test(lang)) s += 6;
    if (/en-us|en_us/.test(lang)) s += 3;
    if (v.localService) s += 1;
    if (/female|zira|samantha|karen|moira/.test(name)) s -= 2;
    return s;
  };

  const sorted = [...voices].sort((a, b) => score(b) - score(a));
  preferredVoice = sorted[0] ?? null;
  return preferredVoice;
}

function speak(text: string, announcementId?: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  if (announcementId) {
    if (lastAnnouncementId === announcementId) return false;
    lastAnnouncementId = announcementId;
  }

  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utter.voice = voice;
    utter.rate = 0.82;
    utter.pitch = 0.75;
    utter.volume = 1;
    utter.lang = voice?.lang || "en-GB";
    window.speechSynthesis.speak(utter);
    return true;
  } catch (err) {
    console.warn("[voice] speech synthesis failed", err);
    return false;
  }
}

/** Primary announcement — only call on server-confirmed winner reveal. */
export function announceWinner(name: string, announcementId: string): boolean {
  const clean = name.trim() || "the champion";
  return speak(`The winner is ${clean}.`, announcementId);
}

export function announce(text: string, announcementId?: string): boolean {
  if (!unlocked) return false;
  return speak(text, announcementId);
}

export function cancelSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    pickVoice();
  };
}
