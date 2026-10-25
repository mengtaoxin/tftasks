import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { zipSync } from 'fflate';

export type ZipEntry = {
  readonly name: string;
  readonly data: Uint8Array;
};

/**
 * Builds a zip archive from path→bytes entries. Paths use POSIX separators.
 */
export function createZip(entries: readonly ZipEntry[]): Uint8Array {
  const tree: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    tree[entry.name] = entry.data;
  }
  return zipSync(tree);
}

/**
 * Recursively lists files under `rootDir`, returning zip paths relative to
 * `rootDir` with POSIX separators, plus file bytes.
 */
export async function collectFiles(rootDir: string, relativePrefix = ''): Promise<ZipEntry[]> {
  const names = await readdir(rootDir, { withFileTypes: true });
  const nested = await Promise.all(
    names.map(async (entry) => {
      const relative = relativePrefix === '' ? entry.name : `${relativePrefix}/${entry.name}`;
      const absolute = path.join(rootDir, entry.name);
      if (entry.isDirectory()) {
        return collectFiles(absolute, relative);
      }
      if (entry.isFile()) {
        return [
          {
            name: relative.split(path.sep).join('/'),
            data: new Uint8Array(await readFile(absolute)),
          } satisfies ZipEntry,
        ];
      }
      return [];
    }),
  );
  return nested.flat();
}
