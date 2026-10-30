"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "vibedraft:debug-mode";
const EVENT = "vibedraft:debug-mode-changed";

export function readDebugMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

function writeDebugMode(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // Ignore storage failures; the in-memory state still works.
  }
}

function subscribe(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

export function useDebugMode() {
  const enabled = useSyncExternalStore(subscribe, readDebugMode, () => false);

  const setEnabled = useCallback((next: boolean) => {
    writeDebugMode(next);
  }, []);

  const toggle = useCallback(() => {
    writeDebugMode(!readDebugMode());
  }, []);

  return { enabled, setEnabled, toggle };
}
