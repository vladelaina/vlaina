import { parseErrorTag } from '../errorTag';
import {
  MAX_PROVIDER_JSON_RESPONSE_BODY_BYTES,
  readBoundedProviderResponseText,
} from '../providers/boundedResponseText';
import type { BenchmarkEndpoint } from './types';

export function readErrorMessage(payload: unknown): string | undefined {
  if (typeof payload === 'string') {
    return readEmbeddedErrorMessage(payload) || payload.trim() || undefined;
  }

  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const body = payload as Record<string, unknown>;
  const topLevelError = body.error;
  if (topLevelError) {
    if (typeof topLevelError === 'string') {
      return topLevelError;
    }

    if (typeof topLevelError === 'object' && topLevelError !== null) {
      const nested = topLevelError as Record<string, unknown>;
      if (typeof nested.message === 'string') {
        return nested.message;
      }
      if (typeof nested.error === 'string') {
        return nested.error;
      }
      if (typeof nested.error === 'object' && nested.error !== null) {
        const deepNested = nested.error as Record<string, unknown>;
        if (typeof deepNested.message === 'string') {
          return deepNested.message;
        }
      }
    }
  }

  const nestedContentError = readContentPayloadError(body);
  if (nestedContentError) {
    return nestedContentError;
  }

  const fallbackMessage =
    readStringField(body, 'message') ||
    readStringField(body, 'msg') ||
    readStringField(body, 'detail') ||
    readStringField(body, 'error_description');
  if (fallbackMessage) {
    return fallbackMessage;
  }

  return undefined;
}

function readStringField(payload: Record<string, unknown>, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readEmbeddedErrorMessage(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsedError = parseErrorTag(trimmed);
  if (parsedError) {
    return parsedError.content || 'Unknown error';
  }

  return undefined;
}

function readContentPayloadError(payload: Record<string, unknown>): string | undefined {
  const choiceContent = readChoiceContentError(payload);
  if (choiceContent) {
    return choiceContent;
  }

  const responseContent = readResponsesContentError(payload);
  if (responseContent) {
    return responseContent;
  }

  return undefined;
}

function readChoiceContentError(payload: Record<string, unknown>): string | undefined {
  const choices = payload.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return undefined;
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    return undefined;
  }

  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === 'string') {
    return readEmbeddedErrorMessage(content);
  }

  if (Array.isArray(content)) {
    for (const item of content) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const text = (item as Record<string, unknown>).text;
      if (typeof text === 'string') {
        const embeddedError = readEmbeddedErrorMessage(text);
        if (embeddedError) {
          return embeddedError;
        }
      }
    }
  }

  return undefined;
}

function readResponsesContentError(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.output_text === 'string') {
    return readEmbeddedErrorMessage(payload.output_text);
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return undefined;
  }

  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const content = (item as Record<string, unknown>).content;
    if (!Array.isArray(content)) {
      continue;
    }

    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }

      const text = (part as Record<string, unknown>).text;
      if (typeof text === 'string') {
        const embeddedError = readEmbeddedErrorMessage(text);
        if (embeddedError) {
          return embeddedError;
        }
      }
    }
  }

  return undefined;
}

export function isExpectedSuccessPayload(payload: unknown, endpoint: BenchmarkEndpoint): boolean {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const body = payload as Record<string, unknown>;

  if (endpoint === 'embeddings' || endpoint === 'image') {
    return Array.isArray(body.data) && body.data.length > 0;
  }

  if (endpoint === 'responses') {
    return Array.isArray(body.output) || typeof body.output_text === 'string';
  }

  return (
    (Array.isArray(body.choices) && body.choices.length > 0) ||
    (Array.isArray(body.content) && body.content.length > 0)
  );
}

export async function readBenchmarkResponseText(
  response: Response,
  signal: AbortSignal,
  fallbackOnReadError?: string,
  maxBytes?: number,
): Promise<string> {
  return await readBoundedProviderResponseText(response, signal, fallbackOnReadError, maxBytes);
}

export async function parseResponsePayload(response: Response, signal: AbortSignal): Promise<unknown> {
  const text = await readBenchmarkResponseText(response, signal, 'Unknown error', MAX_PROVIDER_JSON_RESPONSE_BODY_BYTES);
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
