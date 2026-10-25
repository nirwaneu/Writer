"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ReaderLayout = "scroll" | "pages";

const STORAGE_KEY = "vibedraft:reading-layout";
const CHANGE_EVENT = "vibedraft:reading-layout-change";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

function getSnapshot(): ReaderLayout {
  if (typeof window === "undefined") return "scroll";
  return window.localStorage.getItem(STORAGE_KEY) === "pages" ? "pages" : "scroll";
}

function getServerSnapshot(): ReaderLayout {
  return "scroll";
}

export function useReaderLayout() {
  const layout = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  const setLayout = useCallback((next: ReaderLayout) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { layout, setLayout, ready };
}
