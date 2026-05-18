// sounds.js — UI sound effects only (click, toast chime, score reveal)
// No background music — audio plays on user interaction only

const SFX = (() => {
  let ctx = null;
  let masterGain = null;
  let muted = false;

  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.4;
      masterGain.connect(ctx.destination);
    } catch (e) {
      console.warn("AudioContext not available:", e);
    }
  }

  // Ensure audio context is unlocked before playing
  async function ensureReady() {
    init();
    if (ctx && ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  // Light click sound on button press
  function playClick() {
    if (!ctx || muted) return;
    if (ctx.state === "suspended") return; // skip if suspended
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.06);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  // Toast notification chime
  function playToast(type = "ok") {
    if (!ctx || muted) return;
    if (ctx.state === "suspended") return;
    try {
      const now = ctx.currentTime;
      const freqs = type === "ok" ? [523, 659] : type === "warn" ? [440, 349] : [660, 880];
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.08, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.15);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.15);
      });
    } catch (_) {}
  }

  // Score reveal fanfare
  function playScoreReveal(score) {
    if (!ctx || muted) return;
    if (ctx.state === "suspended") return;
    try {
      const now = ctx.currentTime;
      const baseFreq = score >= 80 ? 523 : score >= 50 ? 440 : 349;
      [0, 0.12, 0.24].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.value = baseFreq * (1 + i * 0.25);
        gain.gain.setValueAtTime(0.1, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.35);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now + delay);
        osc.stop(now + delay + 0.35);
      });
    } catch (_) {}
  }

  function toggleMute() {
    muted = !muted;
    return muted;
  }

  function isMuted() { return muted; }

  return {
    init,
    ensureReady,
    playClick,
    playToast,
    playScoreReveal,
    toggleMute,
    isMuted,
    get muted() { return muted; }
  };
})();

// Unlock audio on first interaction (click/key)
document.addEventListener("click", () => SFX.ensureReady(), { once: true });
document.addEventListener("keydown", () => SFX.ensureReady(), { once: true });
