import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';

const temporaryDirectories: string[] = [];
const distEntryPoint = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { force: true, recursive: true }))
  );
});

it('starts when npm invokes the executable through a symlink', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-freescout-cli-'));
  temporaryDirectories.push(directory);
  const executable = join(directory, 'mcp-freescout');
  await symlink(distEntryPoint, executable);

  const child = spawn(process.execPath, [executable], {
    env: {
      ...process.env,
      FREESCOUT_URL: 'https://example.invalid',
      FREESCOUT_API_KEY: 'test-only-key',
      FREESCOUT_DEFAULT_USER_ID: '1',
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  try {
    const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
      let stdout = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`CLI initialize timed out: ${stderr}`));
        }
      }, 5_000);

      child.stdout.on('data', (chunk) => {
        stdout += chunk;
        if (!settled && stdout.includes('protocolVersion')) {
          settled = true;
          clearTimeout(timeout);
          resolve(JSON.parse(stdout.trim()) as Record<string, unknown>);
        }
      });
      child.on('error', reject);
      child.on('exit', (code) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          reject(new Error(`CLI exited ${code}: ${stderr}`));
        }
      });
      child.stdin.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2026-06-18',
            capabilities: {},
            clientInfo: { name: 'cli-entrypoint-test', version: '1.0.0' },
          },
        })}\n`
      );
    });

    expect(response).toMatchObject({
      id: 1,
      jsonrpc: '2.0',
      result: { serverInfo: { name: 'mcp-freescout' } },
    });
  } finally {
    child.stdin.end();
    child.kill('SIGTERM');
  }
});

it('answers initialize and tools/list without FreeScout credentials, then reports them on a tool call', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'mcp-freescout-cli-'));
  temporaryDirectories.push(directory);

  const env = { ...process.env };
  delete env.FREESCOUT_URL;
  delete env.FREESCOUT_API_KEY;
  delete env.FREESCOUT_DEFAULT_USER_ID;

  // Run from an empty directory so a local .env file cannot supply credentials.
  const child = spawn(process.execPath, [distEntryPoint], {
    cwd: directory,
    env,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const pending = new Map<number, (message: Record<string, unknown>) => void>();
  let buffered = '';
  child.stdout.on('data', (chunk) => {
    buffered += chunk;
    let newline = buffered.indexOf('\n');
    while (newline !== -1) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      if (line) {
        const message = JSON.parse(line) as Record<string, unknown>;
        pending.get(message.id as number)?.(message);
      }
      newline = buffered.indexOf('\n');
    }
  });

  const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
  const request = (id: number, method: string, params: Record<string, unknown>) =>
    new Promise<Record<string, unknown>>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`${method} timed out: ${stderr}`)), 5_000);
      pending.set(id, (message) => {
        clearTimeout(timeout);
        resolve(message);
      });
      child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`);
    });

  try {
    const initialized = await request(1, 'initialize', {
      protocolVersion: '2025-11-25',
      capabilities: {},
      clientInfo: { name: 'cli-entrypoint-test', version: '1.0.0' },
    });
    expect(initialized).toMatchObject({ result: { serverInfo: { name: 'mcp-freescout' } } });

    child.stdin.write(
      `${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n`
    );

    const listed = await request(2, 'tools/list', {});
    const tools = (listed.result as { tools: { name: string }[] }).tools.map((tool) => tool.name);
    expect(tools).toHaveLength(8);
    expect(tools).toContain('freescout_get_mailboxes');

    const called = await request(3, 'tools/call', {
      name: 'freescout_get_mailboxes',
      arguments: {},
    });
    expect(JSON.stringify(called)).toContain(
      'Missing required environment variables: FREESCOUT_URL and FREESCOUT_API_KEY'
    );
    expect(stderr).toContain('FreeScout credentials are not set');
    expect(child.exitCode).toBeNull();
  } finally {
    child.stdin.end();
    child.kill('SIGTERM');
    await exited;
  }
});
