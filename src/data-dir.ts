import { homedir } from 'node:os';
import path from 'node:path';

export function resolveDataDir(env: { readonly TFTASKS_HOME?: string } = process.env): string {
  const configured = env.TFTASKS_HOME;
  if (configured !== undefined && configured.length > 0) {
    return configured;
  }
  return path.join(homedir(), '.tftasks');
}
