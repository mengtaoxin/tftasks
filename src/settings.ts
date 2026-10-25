import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './errors.ts';
import { DEFAULT_LANG, isLang, type Lang } from './lang.ts';

export type Settings = {
  readonly version: number;
  readonly lang: Lang;
};

export type SettingEntry = {
  readonly name: string;
  readonly value: unknown;
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  lang: DEFAULT_LANG,
};

const RESERVED_NAMES = new Set(['version']);

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

export async function createSetting(
  dataDir: string,
  name: string,
  value: unknown,
): Promise<SettingEntry> {
  const document = await readSettingsDocument(dataDir);
  assertMutableName(name);
  assertSettingValue(name, value);
  if (Object.hasOwn(document, name)) {
    throw new AppError('Setting already exists.');
  }
  document[name] = value;
  await writeSettingsDocument(dataDir, document);
  return { name, value };
}

export async function updateSetting(
  dataDir: string,
  name: string,
  value: unknown,
): Promise<SettingEntry> {
  const document = await readSettingsDocument(dataDir);
  assertMutableName(name);
  assertSettingValue(name, value);
  if (!Object.hasOwn(document, name)) {
    throw new AppError('Setting not found.');
  }
  document[name] = value;
  await writeSettingsDocument(dataDir, document);
  return { name, value };
}

export async function deleteSetting(dataDir: string, name: string): Promise<void> {
  const document = await readSettingsDocument(dataDir);
  assertMutableName(name);
  if (!Object.hasOwn(document, name)) {
    throw new AppError('Setting not found.');
  }
  delete document[name];
  await writeSettingsDocument(dataDir, document);
}

async function readSettingsDocument(dataDir: string): Promise<Record<string, unknown>> {
  let raw: string;
  try {
    raw = await readFile(settingsPath(dataDir), 'utf8');
  } catch (error: unknown) {
    if (isEnoent(error)) {
      throw new AppError('Not initialized. Run tftasks init.');
    }
    throw error;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError('Invalid settings.json.');
  }
  if (!isPlainObject(parsed)) {
    throw new AppError('Invalid settings.json.');
  }
  return { ...parsed };
}

async function writeSettingsDocument(
  dataDir: string,
  document: Record<string, unknown>,
): Promise<void> {
  await writeFile(settingsPath(dataDir), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

function assertMutableName(name: string): void {
  if (RESERVED_NAMES.has(name)) {
    throw new AppError(`Setting name is reserved: ${name}.`);
  }
}

function assertSettingValue(name: string, value: unknown): void {
  if (name === 'lang' && !isLang(value)) {
    throw new AppError('Invalid lang.');
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEnoent(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}
