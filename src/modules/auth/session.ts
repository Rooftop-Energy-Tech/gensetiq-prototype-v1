import {useSyncExternalStore} from 'react';

/**
 * A stand-in for authentication.
 *
 * There is no backend behind this prototype, so "logging in" writes a name to
 * localStorage and "logging out" clears it. It exists so the login screen in the
 * design has somewhere to go and the app has a route guard to demonstrate —
 * nothing here is a security boundary, and it must not survive contact with a
 * real API.
 */

const STORAGE_KEY = 'gensetiq.session';

type Session = {email: string};

const listeners = new Set<() => void>();

const read = (): Session | null => {
  // Guard the whole read: Safari in private mode throws on localStorage access
  // rather than returning null, which would take the app down at import time.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? null : (JSON.parse(raw) as Session);
  } catch {
    return null;
  }
};

// useSyncExternalStore compares snapshots by identity, so the parsed object has
// to be memoised — returning a fresh `JSON.parse` result on every call is an
// infinite render loop.
let snapshot: Session | null = read();

const emit = () => {
  snapshot = read();
  for (const listener of listeners) listener();
};

export const signIn = (email: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({email}));
  } catch {
    /* Private mode — the session just won't survive a reload. */
  }
  emit();
};

export const signOut = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* As above. */
  }
  emit();
};

export const getSession = (): Session | null => snapshot;

export const isSignedIn = (): boolean => snapshot !== null;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useSession = (): Session | null =>
  useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => null,
  );

/** `tristan@rooftop.my` → `T`, for the sidebar avatar. */
export const sessionInitial = (session: Session | null): string =>
  (session?.email.trim()[0] ?? 'U').toUpperCase();
