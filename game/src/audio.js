// All sound is synthesised with WebAudio: short oscillator and noise envelopes, no audio
// files. The context is created on the first user gesture; until then every call is a no-op,
// so headless renders and the screenshot scenes stay silent and never throw.

export function createAudio() {
  let context = null;
  let master = null;
  let enabled = true;

  function ensure() {
    if (context) return context;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** Unlock the context from a real gesture (click or key press). */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone({ frequency, end, duration, type = 'sine', volume = 1, delay = 0 }) {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx || !master) return;
    try {
      const start = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (end) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, end), start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  function noise({ duration, volume = 1, delay = 0, lowpass = 1200 }) {
    if (!enabled) return;
    const ctx = ensure();
    if (!ctx || !master) return;
    try {
      const start = ctx.currentTime + delay;
      const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.value = volume;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  return {
    unlock,
    toggle() {
      enabled = !enabled;
      return enabled;
    },
    get enabled() {
      return enabled;
    },
    shoot() {
      tone({ frequency: 740, end: 320, duration: 0.09, type: 'triangle', volume: 0.35 });
    },
    hit() {
      noise({ duration: 0.06, volume: 0.25, lowpass: 900 });
    },
    kill() {
      tone({ frequency: 220, end: 55, duration: 0.16, type: 'sawtooth', volume: 0.3 });
      noise({ duration: 0.1, volume: 0.2, lowpass: 700 });
    },
    pickup() {
      tone({ frequency: 1180, end: 1760, duration: 0.07, type: 'sine', volume: 0.22 });
    },
    hurt() {
      tone({ frequency: 160, end: 70, duration: 0.22, type: 'sawtooth', volume: 0.5 });
      noise({ duration: 0.14, volume: 0.3, lowpass: 500 });
    },
    levelup() {
      [523, 659, 784, 1047].forEach((frequency, index) => {
        tone({ frequency, duration: 0.16, type: 'triangle', volume: 0.35, delay: index * 0.07 });
      });
    },
    waveHorn() {
      tone({ frequency: 196, end: 294, duration: 0.5, type: 'triangle', volume: 0.4 });
      tone({ frequency: 294, end: 392, duration: 0.5, type: 'triangle', volume: 0.25, delay: 0.12 });
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((frequency, index) => {
        tone({ frequency, duration: 0.3, type: 'triangle', volume: 0.35, delay: index * 0.11 });
      });
    },
    lose() {
      [392, 330, 262, 196].forEach((frequency, index) => {
        tone({ frequency, duration: 0.32, type: 'sine', volume: 0.35, delay: index * 0.16 });
      });
    },
  };
}
