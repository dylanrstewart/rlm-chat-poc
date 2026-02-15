import { useCallback } from "react";
import { useAppStore } from "../store/appStore";
import { soundEngine, type SoundType } from "./soundEngine";

export function useSound() {
  const soundMuted = useAppStore((s) => s.soundMuted);
  const setSoundMuted = useAppStore((s) => s.setSoundMuted);

  const play = useCallback(
    (type: SoundType) => {
      if (!soundMuted) {
        soundEngine.play(type);
      }
    },
    [soundMuted],
  );

  return { play, muted: soundMuted, setMuted: setSoundMuted };
}

let lastReplStep = 0;

export function playIfUnmuted(type: SoundType) {
  if (useAppStore.getState().soundMuted) return;

  if (type === "replStep") {
    const now = Date.now();
    if (now - lastReplStep < 150) return;
    lastReplStep = now;
  }

  soundEngine.play(type);
}
