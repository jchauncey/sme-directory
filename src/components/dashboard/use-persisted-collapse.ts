"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sme:dashboard:collapsed";

type CollapsedMap = Record<string, true>;

function read(): CollapsedMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as CollapsedMap;
    }
    return {};
  } catch {
    return {};
  }
}

function write(map: CollapsedMap): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage unavailable (private mode, quota) — collapse state is best-effort.
  }
}

const listeners = new Set<() => void>();

// Single module-level storage listener — fanned out to all subscribers — so
// mounting many DashboardBlocks doesn't duplicate window event listeners.
let storageListenerAttached = false;
function ensureStorageListener(): void {
  if (storageListenerAttached || typeof window === "undefined") return;
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    for (const l of listeners) l();
  });
  storageListenerAttached = true;
}

function subscribe(cb: () => void): () => void {
  ensureStorageListener();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify() {
  for (const l of listeners) l();
}

// Stable empty-map snapshot for SSR / first server render so the snapshot
// reference is identical across calls (useSyncExternalStore requires this).
const SERVER_SNAPSHOT: CollapsedMap = {};

// Cache the last-read client snapshot and only return a new object when the
// underlying string changes, so useSyncExternalStore sees a stable reference.
let cachedRaw: string | null = null;
let cachedSnapshot: CollapsedMap = {};
function getClientSnapshot(): CollapsedMap {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  cachedSnapshot = read();
  return cachedSnapshot;
}

export function usePersistedCollapse(id: string): {
  collapsed: boolean;
  toggle: () => void;
} {
  const map = useSyncExternalStore(subscribe, getClientSnapshot, () => SERVER_SNAPSHOT);

  const collapsed = map[id] === true;

  const toggle = useCallback(() => {
    const next = { ...read() };
    if (next[id]) delete next[id];
    else next[id] = true;
    write(next);
    notify();
  }, [id]);

  return { collapsed, toggle };
}
