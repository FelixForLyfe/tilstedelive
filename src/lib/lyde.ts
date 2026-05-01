// App-specifikke lyde via WebAudio – kræver ikke filer

let ctx: AudioContext | null = null;
function getCtx() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.15, delay = 0) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durationMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durationMs / 1000 + 0.05);
}

export const lyde = {
  ind() {
    tone(660, 120, "sine", 0.18);
    tone(990, 180, "sine", 0.16, 0.1);
  },
  ud() {
    tone(520, 120, "sine", 0.18);
    tone(330, 220, "sine", 0.16, 0.1);
  },
  bekraeftelse() {
    tone(880, 100, "triangle", 0.14);
  },
  hjemAlarm() {
    // Tre tydelige bip
    for (let i = 0; i < 3; i++) {
      tone(740, 250, "square", 0.22, i * 0.32);
      tone(990, 250, "square", 0.18, i * 0.32 + 0.05);
    }
  },
};
