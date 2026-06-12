"use client";

/**
 * Session-persistent demo event log. Events survive navigation (the Demo
 * Center page previously lost its log on route change) and any component —
 * including the floating call window — can append to it.
 */

export interface DemoLogEntry {
  at: string; // ISO
  label: string;
}

const KEY = "northstar-demo-events";
const EVENT = "northstar-demo-log";

export function readDemoEvents(): DemoLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as DemoLogEntry[];
  } catch {
    return [];
  }
}

export function appendDemoEvent(label: string) {
  if (typeof window === "undefined") return;
  const events = readDemoEvents();
  events.push({ at: new Date().toISOString(), label });
  try {
    sessionStorage.setItem(KEY, JSON.stringify(events.slice(-200)));
  } catch {
    // sessionStorage full or unavailable — drop the event.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function clearDemoEvents() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function subscribeDemoEvents(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
