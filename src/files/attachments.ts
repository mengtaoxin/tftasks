import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function taskAttachmentDir(dataDir: string, taskId: string): string {
  return path.resolve(dataDir, 'files', 'task-attachments', taskId);
}

export function taskDetailPath(dataDir: string, taskId: string): string {
  return path.join(taskAttachmentDir(dataDir, taskId), 'index.md');
}

export async function readTaskDetail(detailPath: string): Promise<string> {
  return readFile(detailPath, 'utf8');
}

export async function writeTaskDetail(detailPath: string, detail: string): Promise<void> {
  const directory = path.dirname(detailPath);
  await mkdir(directory, { recursive: true });
  const tempPath = path.join(directory, `.${randomUUID()}.tmp`);
  try {
    await writeFile(tempPath, detail, 'utf8');
    await rename(tempPath, detailPath);
  } catch (error) {
    await rm(tempPath, { force: true });
    throw error;
  }
}

export async function removeTaskAttachments(dataDir: string, taskId: string): Promise<void> {
  await rm(taskAttachmentDir(dataDir, taskId), { recursive: true, force: true });
}

export function repeatConfigAttachmentDir(dataDir: string, configId: string): string {
  return path.resolve(dataDir, 'files', 'repeat-task-config-attachments', configId);
}

export function repeatConfigDetailPath(dataDir: string, configId: string): string {
  return path.join(repeatConfigAttachmentDir(dataDir, configId), 'index.md');
}

export async function removeRepeatConfigAttachments(
  dataDir: string,
  configId: string,
): Promise<void> {
  await rm(repeatConfigAttachmentDir(dataDir, configId), { recursive: true, force: true });
}
