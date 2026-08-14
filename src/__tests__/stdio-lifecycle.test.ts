import { vi } from 'vitest';
import {
  DEFAULT_PARENT_WATCHDOG_MS,
  MIN_PARENT_WATCHDOG_MS,
  installStdioLifecycle,
  parseWatchdogIntervalMs,
  startParentWatchdog,
} from '../stdio-lifecycle.js';

function createProcessDouble(parentPid: number) {
  const listeners = new Map<string, () => void>();

  return {
    ppid: parentPid,
    once: vi.fn((signal: string, listener: () => void) => listeners.set(signal, listener)),
    removeListener: vi.fn((signal: string) => listeners.delete(signal)),
    kill: vi.fn(),
    exit: vi.fn(() => undefined as never),
    emit(signal: string) {
      listeners.get(signal)?.();
    },
  };
}

describe('installStdioLifecycle', () => {
  it.each([
    [undefined, DEFAULT_PARENT_WATCHDOG_MS],
    ['not-a-number', DEFAULT_PARENT_WATCHDOG_MS],
    ['0', DEFAULT_PARENT_WATCHDOG_MS],
    ['25', MIN_PARENT_WATCHDOG_MS],
    ['500', 500],
  ])('validates watchdog interval %s', (raw, expected) => {
    expect(parseWatchdogIntervalMs(raw)).toBe(expected);
  });

  it('closes the serveStdio handle and exits when the parent process disappears', async () => {
    const processRef = createProcessDouble(42);
    const handle = { close: vi.fn().mockResolvedValue(undefined) };
    let watchdog: (() => void) | undefined;

    installStdioLifecycle({
      handle,
      processRef,
      isParentAlive: () => false,
      setIntervalFn: (callback) => {
        watchdog = callback;
        return { unref: vi.fn() } as never;
      },
      clearIntervalFn: vi.fn(),
    });

    watchdog?.();

    await vi.waitFor(() => expect(handle.close).toHaveBeenCalledOnce());
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('closes gracefully on SIGTERM and does not depend on a transport object', async () => {
    const processRef = createProcessDouble(1);
    const handle = { close: vi.fn().mockResolvedValue(undefined) };

    installStdioLifecycle({ handle, processRef });
    processRef.emit('SIGTERM');

    await vi.waitFor(() => expect(handle.close).toHaveBeenCalledOnce());
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('closes gracefully on SIGHUP', async () => {
    const processRef = createProcessDouble(1);
    const handle = { close: vi.fn().mockResolvedValue(undefined) };

    installStdioLifecycle({ handle, processRef });
    processRef.emit('SIGHUP');

    await vi.waitFor(() => expect(handle.close).toHaveBeenCalledOnce());
    expect(processRef.exit).toHaveBeenCalledWith(0);
  });

  it('uses the validated watchdog environment override', () => {
    const processRef = createProcessDouble(42);
    const handle = { close: vi.fn().mockResolvedValue(undefined) };
    const setIntervalFn = vi.fn(() => ({ unref: vi.fn() }));

    installStdioLifecycle({
      handle,
      processRef,
      env: { FREESCOUT_PARENT_WATCHDOG_MS: '25' },
      setIntervalFn,
      clearIntervalFn: vi.fn(),
    });

    expect(setIntervalFn).toHaveBeenCalledWith(expect.any(Function), MIN_PARENT_WATCHDOG_MS);
  });

  it('fires a parent watchdog only once', () => {
    let watchdog: (() => void) | undefined;
    const onParentExit = vi.fn();

    startParentWatchdog(
      42,
      500,
      onParentExit,
      () => true,
      (callback) => {
        watchdog = callback;
        return { unref: vi.fn() };
      }
    );

    watchdog?.();
    watchdog?.();

    expect(onParentExit).toHaveBeenCalledOnce();
  });

  it('keeps the server alive while its original parent is reachable', () => {
    const processRef = createProcessDouble(42);
    const handle = { close: vi.fn().mockResolvedValue(undefined) };
    let watchdog: (() => void) | undefined;

    const lifecycle = installStdioLifecycle({
      handle,
      processRef,
      isParentAlive: () => true,
      setIntervalFn: (callback) => {
        watchdog = callback;
        return { unref: vi.fn() } as never;
      },
      clearIntervalFn: vi.fn(),
    });

    watchdog?.();

    expect(handle.close).not.toHaveBeenCalled();
    expect(processRef.exit).not.toHaveBeenCalled();
    void lifecycle.close();
  });
});
