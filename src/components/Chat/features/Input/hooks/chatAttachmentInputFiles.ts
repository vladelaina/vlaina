export const MAX_CHAT_ATTACHMENT_INPUT_FILES = 64;
export const MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN = 1024;

function getTransferType(types: DataTransfer['types'], index: number): string | null {
  const maybeTypes = types as DataTransfer['types'] & { item?: (index: number) => string | null };
  if (typeof maybeTypes.item === 'function') {
    return maybeTypes.item(index);
  }
  return maybeTypes[index] ?? null;
}

export function hasChatAttachmentFileType(types: DataTransfer['types'] | null | undefined): boolean {
  if (!types) {
    return false;
  }

  const length = Math.min(types.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    if (getTransferType(types, index) === 'Files') {
      return true;
    }
  }
  return false;
}

export function hasChatAttachmentTransferItem(items: DataTransferItemList | null | undefined): boolean {
  if (!items) {
    return false;
  }

  const length = Math.min(items.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    if (items[index]?.kind === 'file') {
      return true;
    }
  }
  return false;
}

export function hasChatAttachmentFileTransfer(transfer: DataTransfer | null | undefined): boolean {
  if (!transfer) {
    return false;
  }
  if (hasChatAttachmentFileType(transfer.types)) {
    return true;
  }
  if (hasChatAttachmentTransferItem(transfer.items)) {
    return true;
  }
  return transfer.files.length > 0;
}

function isChatAttachmentFileCandidate(value: unknown): value is File {
  if (value instanceof File) {
    return true;
  }
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<File>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.type === 'string' &&
    typeof candidate.size === 'number' &&
    typeof candidate.arrayBuffer === 'function'
  );
}

export function collectChatAttachmentFiles(
  files: FileList | readonly File[] | null | undefined,
  maxFiles = MAX_CHAT_ATTACHMENT_INPUT_FILES
): File[] {
  if (!files) {
    return [];
  }

  const collected: File[] = [];
  const length = Math.min(files.length, maxFiles);
  for (let index = 0; index < length; index += 1) {
    const file = files[index];
    if (isChatAttachmentFileCandidate(file)) {
      collected.push(file);
    }
  }
  return collected;
}

export function collectChatAttachmentClipboardFiles(items: DataTransferItemList | null | undefined): File[] {
  if (!items) {
    return [];
  }

  const files: File[] = [];
  const length = Math.min(items.length, MAX_CHAT_ATTACHMENT_TRANSFER_ITEM_SCAN);
  for (let index = 0; index < length; index += 1) {
    const item = items[index];
    if (item?.kind !== 'file') {
      continue;
    }

    const file = item.getAsFile();
    if (!file) {
      continue;
    }

    files.push(file);
    if (files.length >= MAX_CHAT_ATTACHMENT_INPUT_FILES) {
      break;
    }
  }
  return files;
}

export function collectChatAttachmentTransferFiles(
  transfer: DataTransfer | null | undefined
): File[] {
  if (!transfer) {
    return [];
  }

  const files = collectChatAttachmentFiles(transfer.files);
  if (files.length > 0) {
    return files;
  }

  return collectChatAttachmentClipboardFiles(transfer.items);
}
