import { hasBlot, loomNoise, ROWS, stepSeconds, type Pattern } from "./loom.ts";
import { dbToGain } from "./sound.ts";
import { openSoundSession } from "./sound-client.ts";

/** One short-lived source per active row. Eight simultaneous voices sum below the site's -18 dB ceiling. */
export function createLoomVoice(c: AudioContext) {
  const noise = c.createBuffer(1, Math.ceil(c.sampleRate * .24), c.sampleRate);
  noise.getChannelData(0).set(loomNoise(285, noise.length));
  const active = new Set<() => void>();
  return {
    play(row: number, at: number) {
      const spec = ROWS[row], percussive = spec.voice === "brush" || spec.voice === "paper";
      const gain = c.createGain(), filter = c.createBiquadFilter();
      const source = percussive ? c.createBufferSource() : c.createOscillator();
      const length = spec.voice === "marimba" ? .32 : .12;
      if ("buffer" in source) source.buffer = noise;
      else { source.type = spec.voice === "chip" ? "square" : "sine"; source.frequency.value = spec.hz; }
      filter.type = spec.voice === "paper" ? "highpass" : "lowpass";
      filter.frequency.value = percussive ? spec.hz : 6000;
      const peak = dbToGain(-40);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(peak, at + .003);
      gain.gain.exponentialRampToValueAtTime(.00001, at + length);
      source.connect(filter).connect(gain).connect(c.destination);
      const clean = () => { source.disconnect(); filter.disconnect(); gain.disconnect(); active.delete(cancel); };
      const cancel = () => { try { source.stop(); } catch { /* ended */ } clean(); };
      active.add(cancel); source.onended = clean;
      source.start(at); source.stop(at + length + .01);
    },
    stop() { for (const cancel of active) cancel(); },
  };
}

/** Look ahead 100ms on a 25ms clock. UI follows due times, never the ahead-of-time audio scheduling. */
export function startLoom(read: () => Pattern, onStep: (step: number) => void) {
  let stopped = false, step = 0, next = performance.now() + 30;
  let audio: { c: AudioContext; voice: ReturnType<typeof createLoomVoice> } | undefined;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const cancelAudio = openSoundSession(c => {
    const voice = createLoomVoice(c); audio = { c, voice };
    return () => { voice.stop(); audio = undefined; };
  });
  function tick() {
    if (stopped || document.hidden) return;
    const now = performance.now();
    // A stalled foreground tab skips missed notes instead of bursting them all at once.
    if (next < now - 100) next = now + 10;
    while (next < now + 100) {
      const pattern = read(), current = step;
      if (audio) {
        const { c, voice } = audio;
        for (let row = 0; row < 8; row++) if (hasBlot(pattern, row, current)) {
          try { voice.play(row, c.currentTime + Math.max(.005, (next - now) / 1000)); } catch { /* audio unavailable */ }
        }
      }
      const timer = setTimeout(() => { timers.delete(timer); if (!stopped) onStep(current); }, Math.max(0, next - now));
      timers.add(timer);
      next += stepSeconds(pattern.tempo, pattern.swing, step) * 1000;
      step = (step + 1) % 16;
    }
  }
  tick();
  const clock = setInterval(tick, 25);
  return () => { stopped = true; clearInterval(clock); for (const timer of timers) clearTimeout(timer); cancelAudio(); };
}
