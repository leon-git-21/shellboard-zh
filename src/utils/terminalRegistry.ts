import type { Terminal as XTerm } from "@xterm/xterm";
import type { SerializeAddon } from "@xterm/addon-serialize";

/**
 * Central registry of mounted xterm instances, keyed by PTY session id.
 * Used by features that need to inspect multiple terminals at once
 * (global search, buffer serialization for session persistence, …).
 *
 * Terminal components register on mount and unregister on dispose.
 */
type Entry = {
  xterm: XTerm;
  serializer: SerializeAddon;
  ready: boolean;
};

const instances = new Map<string, Entry>();
const readyListeners = new Map<string, Set<() => void>>();

export function registerTerminal(
  id: string,
  xterm: XTerm,
  serializer: SerializeAddon,
): void {
  instances.set(id, { xterm, serializer, ready: false });
}

export function markTerminalReady(id: string): void {
  const entry = instances.get(id);
  if (!entry) return;
  entry.ready = true;
  for (const resolve of readyListeners.get(id) ?? []) resolve();
}

export function waitForTerminalReady(id: string): Promise<void> {
  if (instances.get(id)?.ready) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const listeners = readyListeners.get(id) ?? new Set<() => void>();
    readyListeners.set(id, listeners);
    function cleanup() { listeners.delete(ready); if (!listeners.size) readyListeners.delete(id); }
    const timeout = setTimeout(() => { cleanup(); reject(new Error("Terminal initialization timed out")); }, 8000);
    function ready() { clearTimeout(timeout); cleanup(); resolve(); }
    listeners.add(ready);
  });
}

export function unregisterTerminal(id: string): void {
  instances.delete(id);
}

export function getTerminal(id: string): XTerm | undefined {
  return instances.get(id)?.xterm;
}

export function getSerializer(id: string): SerializeAddon | undefined {
  return instances.get(id)?.serializer;
}

export type TerminalEntry = { id: string; xterm: XTerm };

export function listTerminals(): TerminalEntry[] {
  return Array.from(instances.entries()).map(([id, { xterm }]) => ({
    id,
    xterm,
  }));
}

/**
 * xterm.write() queues data and parses it asynchronously. Callers that
 * need to read a consistent buffer state (e.g. serialize before session
 * save) must first drain every terminal's queue. Writing an empty chunk
 * and waiting for its callback is a cheap way to flush the pipeline.
 */
export async function flushAllWrites(): Promise<void> {
  const pending: Promise<void>[] = [];
  for (const { xterm } of instances.values()) {
    pending.push(
      new Promise<void>((resolve) => {
        try {
          xterm.write("", () => resolve());
        } catch {
          resolve();
        }
      }),
    );
  }
  await Promise.all(pending);
}
