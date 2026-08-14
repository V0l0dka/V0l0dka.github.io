/* ============================================================
   SOUND

   Every effect is synthesised with WebAudio - there are no audio
   files. That is a deliberate trade:

     + nothing to download, nothing to lazy-load, no licence to
       check, no 200 KB of MP3s in git history
     - it can do blips, thuds and whooshes, not music

   Which suits this site: the brief asks for subtle interface
   sounds, not a soundtrack.

   OFF by default and wired to the existing toggle in the corner.
   The site is completely understandable with sound never enabled,
   and nothing here ever plays without the user switching it on.
   ============================================================ */

let ctx = null;
let enabled = false;

/* An AudioContext created before a user gesture starts suspended,
   so it is built on first use - which is always after a click. */
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

/* One oscillator + one gain envelope. Everything below is this
   function with different numbers. */
function tone({ freq = 440, to = null, dur = 0.12, type = 'sine', gain = 0.15, delay = 0 }) {
  const ac = audio();
  if (!ac || !enabled) return;

  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);

  // A short attack and an exponential tail: an instant cut sounds
  // like a click, which is the one artefact you always notice.
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/* Filtered white noise - used for dust, crashes and water. */
function noise({ dur = 0.3, gain = 0.12, freq = 900, q = 1, type = 'lowpass' }) {
  const ac = audio();
  if (!ac || !enabled) return;

  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;

  const amp = ac.createGain();
  const t0 = ac.currentTime;
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  click:  () => tone({ freq: 320, to: 220, dur: 0.06, type: 'square', gain: 0.05 }),
  catch:  () => tone({ freq: 660, to: 990, dur: 0.10, type: 'triangle', gain: 0.12 }),
  miss:   () => tone({ freq: 200, to: 90,  dur: 0.22, type: 'sawtooth', gain: 0.10 }),
  jump:   () => tone({ freq: 300, to: 620, dur: 0.14, type: 'triangle', gain: 0.10 }),
  crash:  () => { noise({ dur: 0.45, gain: 0.18, freq: 1400 }); tone({ freq: 150, to: 50, dur: 0.4, type: 'sawtooth', gain: 0.12 }); },
  found:  () => { tone({ freq: 520, dur: 0.12, type: 'sine', gain: 0.11 }); tone({ freq: 780, dur: 0.16, type: 'sine', gain: 0.09, delay: 0.09 }); },
  bubble: () => tone({ freq: 420, to: 900, dur: 0.16, type: 'sine', gain: 0.05 }),
  win:    () => [0, 0.1, 0.2].forEach((d, i) => tone({ freq: 523 * (1 + i * 0.26), dur: 0.22, type: 'triangle', gain: 0.1, delay: d })),
  lose:   () => [0, 0.12].forEach((d, i) => tone({ freq: 300 - i * 90, dur: 0.3, type: 'sawtooth', gain: 0.1, delay: d })),
  equip:  () => { tone({ freq: 440, to: 880, dur: 0.25, type: 'square', gain: 0.08 }); noise({ dur: 0.2, gain: 0.06, freq: 2600, type: 'highpass' }); },
};

/* The toggle in the corner owns this. interactions.js dispatches
   the event; nothing here reaches back into the DOM. */
export function initAudioEngine() {
  document.addEventListener('audio:toggle', (e) => {
    enabled = Boolean(e.detail?.on);
    if (enabled) sfx.click();
  });
}

export const audioEnabled = () => enabled;
