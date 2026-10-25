import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_LANG, isLang, type Lang } from './lang.ts';

export type Settings = {
  readonly version: number;
  readonly lang: Lang;
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  lang: DEFAULT_LANG,
};

export function settingsPath(dataDir: string): string {
  return path.join(dataDir, 'settings.json');
}

export async function loadSettings(dataDir: string): Promise<Settings> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(dataDir), 'utf8');
  } catch (error: unknown) {
    if (isEnoent(error)) {
      return DEFAULT_SETTINGS;
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_SETTINGS;
  }

  if (!isPlainObject(parsed)) {
    return DEFAULT_SETTINGS;
  }

  const version = typeof parsed.version === 'number' ? parsed.version : DEFAULT_SETTINGS.version;
  const lang = isLang(parsed.lang) ? parsed.lang : DEFAULT_LANG;
  return { version, lang };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
