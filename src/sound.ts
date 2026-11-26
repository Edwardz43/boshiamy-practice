// Lightweight Web Audio API sound effects (zero external assets, safe with strict CSP).

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  try {
    if (typeof window === "undefined") return null;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioCtx) audioCtx = new Ctor();
    if (audioCtx.state === "suspended") {
      void audioCtx.resume().catch(() => undefined);
    }
    return audioCtx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  durSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0,
  endFreq?: number,
): void {
  try {
    const ac = ctx();
    if (!ac) return;
    const now = ac.currentTime + delaySec;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq != null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + durSec);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + Math.min(0.008, durSec * 0.25));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durSec);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(now);
    osc.stop(now + durSec + 0.01);
  } catch {
    /* ignore audio failures */
  }
}

export function playKeySound(): void {
  tone(640, 0.018, "triangle", 0.03, 0, 420);
}

export function playOkSound(): void {
  tone(523.25, 0.075, "sine", 0.055, 0);
  tone(659.25, 0.11, "sine", 0.055, 0.055);
}

export function playBadSound(): void {
  tone(185, 0.14, "triangle", 0.055, 0, 128);
}

export function playComboSound(): void {
  tone(523.25, 0.07, "sine", 0.06, 0);
  tone(659.25, 0.07, "sine", 0.06, 0.055);
  tone(783.99, 0.14, "sine", 0.065, 0.11);
}

export function playFanfareSound(): void {
  tone(523.25, 0.09, "sine", 0.06, 0);
  tone(659.25, 0.09, "sine", 0.06, 0.07);
  tone(783.99, 0.1, "sine", 0.065, 0.14);
  tone(1046.5, 0.22, "sine", 0.07, 0.21);
}
