/**
 * The little celebration when a booking is confirmed or completed:
 * confetti fired from both bottom corners and raining across the screen,
 * with a synthesised fanfare. Client-only — call it from an event handler,
 * after the action has succeeded.
 *
 * No assets and no dependencies: the confetti is one <canvas> that removes
 * itself when the last piece has fallen, and the sound is a few oscillators
 * (Web Audio), so there's nothing to load and nothing to cache.
 *
 * Respects the user: reduced-motion skips the confetti, and the sound can be
 * switched off (SoundToggle in the nav) — it's a shared office, after all.
 */
export const SOUND_KEY = "celebrate-sound";

export function isSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    // storage unavailable — the choice just won't persist
  }
}

export function celebrate(): void {
  if (typeof window === "undefined") return;
  if (isSoundOn()) playFanfare();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) launchConfetti();
}

// ---- sound -------------------------------------------------------------------

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };
let audio: AudioContext | null = null;

function audioContext(): AudioContext | null {
  try {
    const AC = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
    if (!AC) return null;
    audio ??= new AC();
    if (audio.state === "suspended") void audio.resume();
    return audio;
  } catch {
    return null;
  }
}

/** A soft tone that swells in fast and rings out. */
function tone(ac: AudioContext, out: AudioNode, freq: number, start: number, length: number, type: OscillatorType, volume: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(gain).connect(out);
  osc.start(start);
  osc.stop(start + length + 0.05);
}

/** The "thump" of a party popper: a noise burst plus a falling sine. */
function pop(ac: AudioContext, out: AudioNode, start: number, freq: number) {
  const length = 0.14;
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * length), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1400;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.9, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(start);

  const sweep = ac.createOscillator();
  const sweepGain = ac.createGain();
  sweep.frequency.setValueAtTime(freq, start);
  sweep.frequency.exponentialRampToValueAtTime(70, start + 0.12);
  sweepGain.gain.setValueAtTime(0.7, start);
  sweepGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
  sweep.connect(sweepGain).connect(out);
  sweep.start(start);
  sweep.stop(start + 0.15);
}

function playFanfare() {
  const ac = audioContext();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = 0.2;
  master.connect(ac.destination);

  const t = ac.currentTime + 0.03;
  // two poppers, one per corner
  pop(ac, master, t, 520);
  pop(ac, master, t + 0.07, 430);
  // a rising C-major arpeggio…
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(ac, master, f, t + 0.12 + i * 0.09, 0.6, "triangle", 0.5));
  // …landing on a held chord…
  [523.25, 659.25, 783.99, 1318.5].forEach((f) => tone(ac, master, f, t + 0.5, 1.2, "sine", 0.28));
  // …with glitter on top
  for (let i = 0; i < 10; i++) {
    tone(ac, master, 2000 + Math.random() * 2600, t + 0.5 + i * 0.11 + Math.random() * 0.05, 0.16, "sine", 0.11);
  }
}

// ---- confetti ----------------------------------------------------------------

const COLORS = ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#eab308", "#06b6d4", "#ec4899"];

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  spin: number;
  flutter: number;
  flutterSpeed: number;
  color: string;
  round: boolean;
  /** Seconds after launch at which it appears (the rain staggers in). */
  delay: number;
  life: number;
}

let running: HTMLCanvasElement | null = null;

function launchConfetti() {
  running?.remove(); // a second celebration replaces the first rather than stacking
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", pointerEvents: "none", zIndex: "9999" });
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const g = canvas.getContext("2d");
  if (!g) return;
  g.scale(dpr, dpr);
  document.body.appendChild(canvas);
  running = canvas;

  const scale = Math.max(0.7, Math.min(h / 900, 1.3)); // bursts reach the same fraction of any screen
  const rand = (a: number, b: number) => a + Math.random() * (b - a);
  const pieces: Piece[] = [];
  const make = (x: number, y: number, vx: number, vy: number, delay: number): Piece => ({
    x,
    y,
    vx,
    vy,
    size: rand(6, 12),
    rotation: rand(0, Math.PI * 2),
    spin: rand(-9, 9),
    flutter: rand(0, Math.PI * 2),
    flutterSpeed: rand(6, 14),
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    round: Math.random() < 0.25,
    delay,
    life: rand(3.2, 4.6),
  });

  // Two cannons, low in each bottom corner, aimed up and inward.
  for (let i = 0; i < 90; i++) {
    const speed = rand(750, 1500) * scale;
    const left = (rand(52, 86) * Math.PI) / 180;
    const right = (rand(52, 86) * Math.PI) / 180;
    pieces.push(make(-10, h + 10, Math.cos(left) * speed, -Math.sin(left) * speed, rand(0, 0.12)));
    pieces.push(make(w + 10, h + 10, -Math.cos(right) * speed, -Math.sin(right) * speed, rand(0.05, 0.17)));
  }
  // …and a shower across the top.
  for (let i = 0; i < 130; i++) pieces.push(make(rand(0, w), rand(-60, -10), rand(-70, 70), rand(80, 260), rand(0.3, 1.6)));

  const start = performance.now();
  let last = start;
  function frame(now: number) {
    if (running !== canvas) return; // superseded
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const elapsed = (now - start) / 1000;
    g!.clearRect(0, 0, w, h);

    let alive = 0;
    for (const p of pieces) {
      const age = elapsed - p.delay;
      if (age < 0) {
        alive++;
        continue;
      }
      if (age > p.life || p.y > h + 40) continue;
      alive++;
      p.vx *= Math.pow(0.32, dt); // air drag: the burst slows quickly, then it floats
      p.vy = Math.min(p.vy * Math.pow(0.32, dt) + 900 * dt, 320 * scale + Math.max(0, -p.vy)); // gravity, with a terminal fall speed
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.spin * dt;
      p.flutter += p.flutterSpeed * dt;

      g!.save();
      g!.globalAlpha = Math.min(1, (p.life - age) / 0.7);
      g!.translate(p.x, p.y);
      g!.rotate(p.rotation);
      g!.fillStyle = p.color;
      if (p.round) {
        g!.beginPath();
        g!.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
        g!.fill();
      } else {
        g!.fillRect(-p.size / 2, (-p.size / 4) * Math.abs(Math.cos(p.flutter)), p.size, (p.size / 2) * Math.abs(Math.cos(p.flutter)) + 1);
      }
      g!.restore();
    }

    if (alive > 0 && elapsed < 7) requestAnimationFrame(frame);
    else {
      canvas.remove();
      if (running === canvas) running = null;
    }
  }
  requestAnimationFrame(frame);
}
