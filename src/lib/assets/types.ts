export interface AssetEntry {
  filename: string;
  hash: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
}

export interface UploadResult {
  success: boolean;
  path: string | null;
  isDuplicate: boolean;
  existingFilename?: string;
  error?: string;
}
