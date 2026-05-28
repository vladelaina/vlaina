import { joinPath } from './adapter';

export async function getPrimaryAttachmentDir(basePath: string): Promise<string> {
  return joinPath(basePath, '.vlaina', 'attachments');
}

export async function getPrimaryAttachmentPath(basePath: string, filename: string): Promise<string> {
  return joinPath(basePath, '.vlaina', 'attachments', filename);
}
