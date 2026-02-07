const DANGEROUS_CHARS = /[<>:"/\\|?*]/g;

const MAX_FILENAME_LENGTH = 200;

export function sanitizeFilename(name: string): string {
  if (!name) return 'untitled';

  let sanitized = name.replace(DANGEROUS_CHARS, '');

  sanitized = sanitized.trim();

  if (!sanitized) return 'untitled';

  return sanitized;
}

export function truncateFilename(name: string, maxLength: number = MAX_FILENAME_LENGTH): string {
  if (name.length <= maxLength) return name;

  const lastDot = name.lastIndexOf('.');

  if (lastDot === -1 || lastDot === 0) {
    return name.substring(0, maxLength);
  }

  const extension = name.substring(lastDot);
  const baseName = name.substring(0, lastDot);

  if (extension.length >= maxLength) {
    return name.substring(0, maxLength);
  }

  const maxBaseLength = maxLength - extension.length;
  return baseName.substring(0, maxBaseLength) + extension;
}

export function resolveFilenameConflict(
  name: string,
  existingNames: Set<string>
): string {
  const lowerExisting = new Set(
    Array.from(existingNames).map(n => n.toLowerCase())
  );

  if (!lowerExisting.has(name.toLowerCase())) {
    return name;
  }

  const lastDot = name.lastIndexOf('.');
  let baseName: string;
  let extension: string;

  if (lastDot === -1 || lastDot === 0) {
    baseName = name;
    extension = '';
  } else {
    baseName = name.substring(0, lastDot);
    extension = name.substring(lastDot);
  }

  let counter = 1;
  let newName: string;

  do {
    newName = `${baseName}_${counter}${extension}`;
    counter++;
  } while (lowerExisting.has(newName.toLowerCase()));

  return newName;
}

export function processFilename(
  originalName: string,
  existingNames: Set<string>,
  maxLength: number = MAX_FILENAME_LENGTH
): string {
  let name = sanitizeFilename(originalName);
  name = truncateFilename(name, maxLength);
  name = resolveFilenameConflict(name, existingNames);
  return name;
}

export function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml',
    'bmp': 'image/bmp',
    'ico': 'image/x-icon',
    'avif': 'image/avif',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}

export function isImageFilename(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif'];
  return imageExtensions.includes(ext);
}

export function generateFilename(
  originalName: string,
  format: 'original' | 'timestamp' | 'sequence',
  existingNames: Set<string>
): string {
  const lastDot = originalName.lastIndexOf('.');
  const extension = lastDot > 0 ? originalName.substring(lastDot).toLowerCase() : '.png';

  let baseName: string;

  switch (format) {
    case 'original':
      return processFilename(originalName, existingNames);

    case 'timestamp':
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      baseName = `${date}_${hours}-${minutes}-${seconds}`;
      break;

    case 'sequence':
      let counter = 1;
      const lowerExisting = new Set(
        Array.from(existingNames).map(n => n.toLowerCase())
      );

      do {
        baseName = counter.toString();
        counter++;
      } while (lowerExisting.has((baseName + extension).toLowerCase()));

      return baseName + extension;


    default:
      return processFilename(originalName, existingNames);
  }

  const newName = baseName + extension;
  return resolveFilenameConflict(newName, existingNames);
}
