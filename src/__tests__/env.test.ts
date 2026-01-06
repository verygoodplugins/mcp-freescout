import { jest } from '@jest/globals';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('loadEnv', () => {
  it('does not write dotenv runtime logs to stdout', async () => {
    const originalCwd = process.cwd();
    const tempDir = mkdtempSync(join(tmpdir(), 'mcp-freescout-env-'));
    writeFileSync(join(tempDir, '.env'), 'HELLO=World\n');

    const stdoutWrites: string[] = [];
    const stdoutSpy = jest
      .spyOn(process.stdout, 'write')
      .mockImplementation(
        (chunk: string | Buffer | Uint8Array, ..._args: unknown[]) => {
          stdoutWrites.push(
            typeof chunk === 'string'
              ? chunk
              : (chunk?.toString?.() ?? String(chunk))
          );
          return true;
        }
      );

    process.chdir(tempDir);
    const { loadEnv } = await import('../env.js');

    loadEnv();

    expect(stdoutWrites.join('')).not.toContain('[dotenv@');

    process.chdir(originalCwd);
    stdoutSpy.mockRestore();
  });
});
