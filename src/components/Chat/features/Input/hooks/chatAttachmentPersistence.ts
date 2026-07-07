import { deleteAttachment, type Attachment } from '@/lib/storage/attachmentStorage';
import { translate } from '@/lib/i18n';

export const MAX_CHAT_ATTACHMENT_SAVE_CONCURRENCY = 4;

export async function settleWithConcurrencyLimit<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results = new Array<PromiseSettledResult<R>>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        try {
          results[index] = { status: 'fulfilled', value: await worker(items[index]!) };
        } catch (reason) {
          results[index] = { status: 'rejected', reason };
        }
      }
    }
  );

  await Promise.all(workers);
  return results;
}

export function deleteAttachmentQuietly(attachment: Attachment): void {
  try {
    void Promise.resolve(deleteAttachment(attachment)).catch(() => {});
  } catch {
  }
}

export function getAttachmentSaveFailureToastMessage(results: PromiseSettledResult<Attachment>[]): string | null {
  const rejectedResults = results.filter((result) => result.status === 'rejected');
  if (rejectedResults.length === 0) {
    return null;
  }

  const hasUnsupportedFile = rejectedResults.some((result) =>
    result.reason instanceof Error && /unsupported attachment type/i.test(result.reason.message)
  );
  if (hasUnsupportedFile) {
    return translate('notes.unsupportedFile');
  }

  return translate('asset.uploadFailed');
}
