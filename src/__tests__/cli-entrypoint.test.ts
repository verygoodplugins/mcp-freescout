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
