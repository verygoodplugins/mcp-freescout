import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';

type ShutdownReason = 'manual' | 'parent-exit' | 'signal';
type Signal = 'SIGINT' | 'SIGTERM' | 'SIGHUP';

export type ParentLivenessProbe = (parentPid: number) => boolean;

interface ProcessLike {
  ppid: number;
  once(signal: Signal, listener: () => void): unknown;
  removeListener(signal: Signal, listener: () => void): unknown;
  kill(pid: number, signal: 0): void;
  exit(code?: number): never;
}

interface WatchdogTimer {
  unref?: () => unknown;
}

type SetIntervalFn = (callback: () => void, ms: number) => WatchdogTimer;
type ClearIntervalFn = (timer: WatchdogTimer) => void;

interface StdioLifecycleOptions {
  handle: StdioServerHandle;
  processRef?: ProcessLike;
  parentPid?: number;
  env?: NodeJS.ProcessEnv;
  envName?: string;
  watchdogIntervalMs?: number;
  isParentAlive?: ParentLivenessProbe;
  setIntervalFn?: SetIntervalFn;
  clearIntervalFn?: ClearIntervalFn;
  onError?: (error: Error) => void;
}

export interface StdioLifecycle {
  close(): Promise<void>;
}

export const DEFAULT_PARENT_WATCHDOG_MS = 30_000;
export const MIN_PARENT_WATCHDOG_MS = 100;

/**
 * Reads the watchdog interval while protecting against an invalid or overly
 * aggressive environment override.
 */
export function parseWatchdogIntervalMs(raw: string | undefined): number {
  const intervalMs = Number(raw);

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    return DEFAULT_PARENT_WATCHDOG_MS;
  }

  return Math.max(intervalMs, MIN_PARENT_WATCHDOG_MS);
}

/** Starts a parent watchdog which invokes its callback at most once. */
export function startParentWatchdog(
  parentPid: number,
  intervalMs: number,
  onParentExit: () => void,
  isParentGone: ParentLivenessProbe,
  setIntervalFn: SetIntervalFn = setInterval
): WatchdogTimer {
  let fired = false;
  const watchdog = setIntervalFn(() => {
    if (!fired && isParentGone(parentPid)) {
      fired = true;
      onParentExit();
    }
  }, intervalMs);

  watchdog.unref?.();
  return watchdog;
}

function parentIsAlive(processRef: ProcessLike, parentPid: number): boolean {
  try {
    processRef.kill(parentPid, 0);
    return true;
  } catch (error) {
    return !(error instanceof Error && 'code' in error && error.code === 'ESRCH');
  }
}

/**
 * Closes the stdio serving entry when its launcher disappears or receives a
 * termination signal. It deliberately knows only about the serveStdio handle,
 * not its underlying transport, because serveStdio owns that transport.
 */
export function installStdioLifecycle(options: StdioLifecycleOptions): StdioLifecycle {
  const processRef = options.processRef ?? (process as unknown as ProcessLike);
  const parentPid = options.parentPid ?? processRef.ppid;
  const envName = options.envName ?? 'FREESCOUT_PARENT_WATCHDOG_MS';
  const watchdogIntervalMs =
    options.watchdogIntervalMs === undefined
      ? parseWatchdogIntervalMs((options.env ?? process.env)[envName])
      : parseWatchdogIntervalMs(String(options.watchdogIntervalMs));
  const isParentAlive = options.isParentAlive ?? ((pid) => parentIsAlive(processRef, pid));
  const isParentGone: ParentLivenessProbe = (pid) => processRef.ppid !== pid || !isParentAlive(pid);
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn: ClearIntervalFn =
    options.clearIntervalFn ?? ((timer) => clearInterval(timer as ReturnType<typeof setInterval>));
  const signals: Signal[] = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  let watchdog: WatchdogTimer | undefined;
  let shuttingDown: Promise<void> | undefined;
  let onSignal: () => void = () => undefined;

  const stopWatching = () => {
    if (watchdog !== undefined) {
      clearIntervalFn(watchdog);
      watchdog = undefined;
    }
    for (const signal of signals) {
      processRef.removeListener(signal, onSignal);
    }
  };

  const shutdown = (reason: ShutdownReason): Promise<void> => {
    if (shuttingDown) {
      return shuttingDown;
    }

    shuttingDown = (async () => {
      stopWatching();
      let exitCode = 0;
      try {
        await options.handle.close();
      } catch (error) {
        exitCode = 1;
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }

      if (reason !== 'manual') {
        processRef.exit(exitCode);
      }
    })();

    return shuttingDown;
  };

  onSignal = () => {
    void shutdown('signal');
  };

  for (const signal of signals) {
    processRef.once(signal, onSignal);
  }

  if (parentPid > 1) {
    watchdog = startParentWatchdog(
      parentPid,
      watchdogIntervalMs,
      () => void shutdown('parent-exit'),
      isParentGone,
      setIntervalFn
    );
  }

  return {
    close: () => shutdown('manual'),
  };
}
