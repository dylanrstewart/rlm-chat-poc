export type SoundType =
  | "tabClick"
  | "confirm"
  | "messageSend"
  | "messageReceive"
  | "error"
  | "replStep"
  | "keystroke";

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const bufferCache = new Map<string, AudioBuffer>();

function getContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
    masterGain = ctx.createGain();
    masterGain.gain.value = 1.0;
    masterGain.connect(ctx.destination);
  }
  return ctx;
}

function getMaster(): GainNode {
  getContext();
  return masterGain!;
}

async function loadBuffer(path: string): Promise<AudioBuffer | null> {
  const cached = bufferCache.get(path);
  if (cached) return cached;

  try {
    const res = await fetch(path);
    const arrayBuf = await res.arrayBuffer();
    const audioBuf = await getContext().decodeAudioData(arrayBuf);
    bufferCache.set(path, audioBuf);
    return audioBuf;
  } catch {
    return null;
  }
}

function playBuffer(buffer: AudioBuffer, gain = 1.0) {
  const ac = getContext();
  if (ac.state === "suspended") return;

  const src = ac.createBufferSource();
  src.buffer = buffer;

  const g = ac.createGain();
  g.gain.setValueAtTime(gain, ac.currentTime);

  src.connect(g);
  g.connect(getMaster());
  src.start(ac.currentTime);
}

async function playFile(path: string, gain = 1.0) {
  const buf = await loadBuffer(path);
  if (buf) playBuffer(buf, gain);
}

/** Hacking terminal char sounds — cycle through them for variety */
const hackingChars = [
  "/sounds/hacking-char-1.wav",
  "/sounds/hacking-char-2.wav",
  "/sounds/hacking-char-3.wav",
  "/sounds/hacking-char-4.wav",
  "/sounds/hacking-char-5.wav",
  "/sounds/hacking-char-6.wav",
];
let hackingIdx = 0;

const recipes: Record<SoundType, () => void> = {
  tabClick: () => playFile("/sounds/tab-click.wav", 0.6),
  confirm: () => playFile("/sounds/confirm.wav", 0.5),
  messageSend: () => playFile("/sounds/message-send.wav", 0.4),
  messageReceive: () => playFile("/sounds/message-receive.wav", 0.5),
  error: () => playFile("/sounds/error.wav", 0.7),
  replStep: () => {
    const file = hackingChars[hackingIdx % hackingChars.length];
    hackingIdx++;
    playFile(file, 0.3);
  },
  keystroke: () => {
    const file = hackingChars[hackingIdx % hackingChars.length];
    hackingIdx++;
    playFile(file, 0.15);
  },
};

/** Pre-load all sounds so first play is instant */
function preload() {
  const allFiles = [
    "/sounds/tab-click.wav",
    "/sounds/confirm.wav",
    "/sounds/message-send.wav",
    "/sounds/message-receive.wav",
    "/sounds/error.wav",
    ...hackingChars,
  ];
  for (const f of allFiles) {
    loadBuffer(f);
  }
}

export const soundEngine = {
  play(type: SoundType) {
    recipes[type]();
  },

  setMasterVolume(vol: number) {
    getMaster().gain.setValueAtTime(
      Math.max(0, Math.min(1, vol)),
      getContext().currentTime,
    );
  },

  resume() {
    if (ctx?.state === "suspended") {
      ctx.resume();
    }
    preload();
  },
};
