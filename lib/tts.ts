"use client";

/**
 * Browser text-to-speech helpers for the AI-to-AI call playback (e.g. the
 * existing-customer callback, where both the assistant and the customer are
 * AI). Uses the Web Speech API — free, offline, and lets us give each role a
 * distinct voice.
 */

export interface TtsVoice {
  voice: SpeechSynthesisVoice | null;
  pitch: number;
  rate: number;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const handler = () => {
      resolve(window.speechSynthesis.getVoices());
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    // Safety timeout in case the event never fires.
    setTimeout(() => resolve(window.speechSynthesis.getVoices()), 500);
  });
}

const FEMALE_HINTS = ["female", "samantha", "victoria", "karen", "tessa", "moira", "fiona", "zira", "susan", "allison", "ava", "joanna", "salli", "kendra"];

/**
 * Picks two distinct, ideally feminine English voices for the assistant and
 * the customer. Falls back to pitch/rate differences when the browser only
 * exposes one usable voice, so the two roles still sound different.
 */
export async function pickTwoVoices(): Promise<{ agent: TtsVoice; customer: TtsVoice }> {
  const voices = (await loadVoices()).filter((v) => v.lang?.toLowerCase().startsWith("en"));
  const score = (v: SpeechSynthesisVoice) =>
    FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h)) ? 1 : 0;
  const sorted = [...voices].sort((a, b) => score(b) - score(a));
  const agentVoice = sorted[0] ?? null;
  const customerVoice = sorted.find((v) => v !== agentVoice) ?? agentVoice;
  return {
    // Warm, steady assistant.
    agent: { voice: agentVoice, pitch: 1.0, rate: 1.02 },
    // Slightly higher/faster so Sarah reads as a different person even if the
    // browser reuses the same underlying voice.
    customer: { voice: customerVoice, pitch: customerVoice === agentVoice ? 1.25 : 1.08, rate: 1.06 },
  };
}

/** Speaks one line; resolves when finished (or immediately if TTS is unavailable). */
export function speak(text: string, v: TtsVoice): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      resolve();
      return;
    }
    try {
      // Chrome occasionally leaves the queue paused; nudge it before speaking.
      window.speechSynthesis.resume();
      const utter = new SpeechSynthesisUtterance(text);
      if (v.voice) utter.voice = v.voice;
      utter.pitch = v.pitch;
      utter.rate = v.rate;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
      // Hard cap so a stuck utterance never hangs the playback.
      setTimeout(resolve, Math.min(12000, 1800 + text.length * 70));
    } catch {
      resolve();
    }
  });
}

export function cancelSpeech() {
  if (typeof window !== "undefined" && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}
