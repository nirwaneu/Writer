"use client";

import { useCallback, useSyncExternalStore } from "react";

export type EnterBehavior = "send" | "newline";

const STORAGE_KEY = "vibedraft:enter-behavior";
const CHANGE_EVENT = "vibedraft:enter-behavior-change";

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

function getSnapshot(): EnterBehavior {
  if (typeof window === "undefined") return "send";
  return window.localStorage.getItem(STORAGE_KEY) === "newline" ? "newline" : "send";
}

function getServerSnapshot(): EnterBehavior {
  return "send";
}

export function useEnterBehavior() {
  const behavior = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setBehavior = useCallback((next: EnterBehavior) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { behavior, setBehavior };
}

export function submitsOnEnter(
  behavior: EnterBehavior,
  event: { key: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean },
): boolean {
  if (event.key !== "Enter") return false;
  if (behavior === "send") {
    return !event.shiftKey && !event.ctrlKey && !event.metaKey;
  }
  return event.ctrlKey || event.metaKey;
}

export function enterHint(behavior: EnterBehavior): string {
  return behavior === "send"
    ? "Enter to send · Shift + Enter for a new line"
    : "Enter for a new line · Ctrl/⌘ + Enter to send";
}

export function handleEnterKey({
  behavior,
  event,
  value,
  onChange,
  onSubmit,
}: {
  behavior: EnterBehavior;
  event: React.KeyboardEvent<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
}): void {
  if (event.key !== "Enter") return;
  if (submitsOnEnter(behavior, event)) {
    event.preventDefault();
    onSubmit();
    return;
  }
  if (event.ctrlKey || event.metaKey) return;
  if (behavior === "newline" || event.shiftKey) {
    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart ?? value.length;
    const end = target.selectionEnd ?? start;
    onChange(`${value.slice(0, start)}\n${value.slice(end)}`);
    requestAnimationFrame(() => {
      target.selectionStart = start + 1;
      target.selectionEnd = start + 1;
    });
  }
}
