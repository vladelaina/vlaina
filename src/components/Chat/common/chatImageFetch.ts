import {
  fetchBoundedImageBlob,
  fetchBoundedImageBlobResult,
  MAX_FETCHED_IMAGE_BYTES,
  type BoundedImageBlobFetchResult,
} from '@/lib/markdown/fetchBoundedImageBlob';

export const MAX_CHAT_IMAGE_FETCH_BYTES = MAX_FETCHED_IMAGE_BYTES;

export type ChatImageFetchResult = BoundedImageBlobFetchResult;

export { fetchBoundedImageBlob as fetchChatImageBlob, fetchBoundedImageBlobResult as fetchChatImageBlobResult };
