import { appendFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';

export async function appendCommandLog(
  dataDir: string,
  commandName: string,
  exitCode: number,
  now: Date = new Date(),
): Promise<void> {
  try {
    const info = await stat(dataDir);
    if (!info.isDirectory()) {
      return;
    }
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return;
    }
    throw error;
  }

  const logsDir = path.join(dataDir, 'logs');
  await mkdir(logsDir, { recursive: true });
  await appendFile(
    path.join(logsDir, `${logDay(now)}.log`),
    `${now.toISOString()} ${commandName} exit=${exitCode}\n`,
    'utf8',
  );
}

/** Local calendar day, matching the user's "today". */
function logDay(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
