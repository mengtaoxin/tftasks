import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { resolveDataDir } from './data-dir.ts';

export type ExtractWorkspaceResult =
  | { ok: true; workspace: string | undefined; args: readonly string[] }
  | { ok: false; error: string };

export type ResolveWorkspaceResult = { ok: true; dataDir: string } | { ok: false; error: string };

export function extractWorkspace(args: readonly string[]): ExtractWorkspaceResult {
  let workspace: string | undefined;
  const remaining: string[] = [];
  let index = 0;

  while (index < args.length) {
    const arg = args[index];
    if (arg === undefined) {
      index += 1;
      continue;
    }

    if (arg === '--workspace') {
      if (workspace !== undefined) {
        return { ok: false, error: 'Duplicate --workspace.' };
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith('-')) {
        return { ok: false, error: 'Missing value for --workspace.' };
      }
      workspace = value;
      index += 2;
      continue;
    }

    remaining.push(arg);
    index += 1;
  }

  return { ok: true, workspace, args: remaining };
}

export function resolveWorkspace(
  workspace: string | undefined,
  env: { readonly TFTASKS_HOME?: string } = process.env,
): ResolveWorkspaceResult {
  if (workspace === undefined) {
    return { ok: true, dataDir: resolveDataDir(env) };
  }

  const dataDir = resolveWorkspacePath(workspace);
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    return { ok: false, error: `Workspace does not exist: ${workspace}` };
  }
  return { ok: true, dataDir };
}

function resolveWorkspacePath(workspace: string): string {
  if (workspace === '~') {
    return homedir();
  }
  if (workspace.startsWith('~/') || workspace.startsWith('~\\')) {
    return path.join(homedir(), workspace.slice(2));
  }
  return path.resolve(workspace);
}
