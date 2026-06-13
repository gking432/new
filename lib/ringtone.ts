"use client";

import { useEffect } from "react";

/**
 * Synthesizes a classic two-tone phone ring with the Web Audio API — no audio
 * asset to ship, works offline. Returns a stop function. Safe to call from a
 * click handler (the gesture unlocks the AudioContext).
 */
export function startRingtone(): () => void {
  let ctx: AudioContext | null = null;
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  } catch {
    return () => undefined;
  }
  const audio = ctx;
  void audio.resume?.();
  let stopped = false;

  function ringOnce() {
    if (stopped || !audio) return;
    const t = audio.currentTime;
    const gain = audio.createGain();
    gain.connect(audio.destination);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
    gain.gain.setValueAtTime(0.12, t + 0.9);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    // North-American ring pair (440 Hz + 480 Hz).
    for (const freq of [440, 480]) {
      const osc = audio.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(t);
      osc.stop(t + 1);
    }
  }

  ringOnce();
  const interval = setInterval(ringOnce, 3000); // ring … pause … ring
  return () => {
    stopped = true;
    clearInterval(interval);
    void audio.close?.();
  };
}

/** Plays the ringtone while `active` is true. */
export function useRingtone(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const stop = startRingtone();
    return stop;
  }, [active]);
}
