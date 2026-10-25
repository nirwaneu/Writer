"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

export type ReaderLayout = "scroll" | "pages";

const STORAGE_KEY = "vibedraft:reading-layout";
const CHANGE_EVENT = "vibedraft:reading-layout-change";

export function readReaderLayout(): ReaderLayout {
  if (typeof window === "undefined") return "scroll";
  return window.localStorage.getItem(STORAGE_KEY) === "pages" ? "pages" : "scroll";
}

export function useReaderLayout() {
  const [layout, setLayoutState] = useState<ReaderLayout>(() => readReaderLayout());
  const ready = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const sync = () => setLayoutState(readReaderLayout());
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) sync();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const setLayout = useCallback((next: ReaderLayout) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { layout, setLayout, ready };
}
