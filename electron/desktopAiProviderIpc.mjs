import {
  createAbortError,
  fetchAiProviderRequestWithRetry,
  MAX_AI_PROVIDER_RESPONSE_BODY_BYTES,
  MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES,
  normalizeAiProviderRequest,
  raceWithAbort,
  requireSafeIpcRequestId,
  summarizeError,
} from './desktopAiProviderRequest.mjs';

const activeAiProviderRequests = new Map();

function deleteActiveAiProviderRequest(requestId, controller) {
  if (activeAiProviderRequests.get(requestId) === controller) {
    activeAiProviderRequests.delete(requestId);
  }
}

function isCurrentAiProviderRequest(requestId, controller) {
  return activeAiProviderRequests.get(requestId) === controller;
}

function safeSend(sender, channel, payload) {
  if (!sender || sender.isDestroyed()) {
    return false;
  }

  try {
    sender.send(channel, payload);
    return true;
  } catch {
    return false;
  }
}

function sendAiProviderResponseChunk(sendRequestEvent, value) {
  if (value.byteLength <= MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES) {
    return sendRequestEvent('chunk', Array.from(value));
  }

  for (let offset = 0; offset < value.byteLength; offset += MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES) {
    const chunk = value.subarray(offset, offset + MAX_AI_PROVIDER_RESPONSE_IPC_CHUNK_BYTES);
    if (!sendRequestEvent('chunk', Array.from(chunk))) {
      return false;
    }
  }

  return true;
}

export function registerDesktopAiProviderIpc({ handleIpc }) {
  handleIpc('desktop:ai-provider:request:start', async (event, requestId, rawRequest) => {
    const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
    const previous = activeAiProviderRequests.get(id);
    previous?.abort();

    const request = normalizeAiProviderRequest(rawRequest);
    const controller = new AbortController();
    activeAiProviderRequests.set(id, controller);
    const sender = event.sender;
    const sendRequestEvent = (suffix, payload) => {
      if (!isCurrentAiProviderRequest(id, controller)) {
        return false;
      }
      return safeSend(sender, `desktop:ai-provider:request:${id}:${suffix}`, payload);
    };

    let response;
    try {
      response = await fetchAiProviderRequestWithRetry(request, controller.signal);
    } catch (error) {
      deleteActiveAiProviderRequest(id, controller);
      if (controller.signal.aborted) {
        throw error;
      }
      throw new Error(`连接到自定义渠道失败，可能是上游或网络瞬时不可达，可重试。AI provider request to ${request.url} failed before an HTTP response was received: ${summarizeError(error)}`);
    }

    void (async () => {
      try {
        if (!response.body) {
          sendRequestEvent('done');
          return;
        }

        const reader = response.body.getReader();
        const cancelReader = () => {
          void reader.cancel(createAbortError()).catch(() => {});
        };
        controller.signal.addEventListener('abort', cancelReader, { once: true });
        try {
          if (controller.signal.aborted) {
            throw createAbortError();
          }

          let responseBytesRead = 0;
          while (true) {
            const { done, value } = await raceWithAbort(reader.read(), controller.signal);
            if (controller.signal.aborted) {
              throw createAbortError();
            }
            if (done) {
              break;
            }
            const chunkByteLength = value?.byteLength;
            if (!Number.isFinite(chunkByteLength) || chunkByteLength < 0) {
              throw new Error('Invalid AI provider response chunk.');
            }
            responseBytesRead += chunkByteLength;
            if (responseBytesRead > MAX_AI_PROVIDER_RESPONSE_BODY_BYTES) {
              throw new Error('AI provider response body is too large.');
            }

            if (!sendAiProviderResponseChunk(sendRequestEvent, value)) {
              controller.abort();
              throw createAbortError();
            }
          }

          sendRequestEvent('done');
        } catch (error) {
          void reader.cancel(createAbortError()).catch(() => {});
          throw error;
        } finally {
          controller.signal.removeEventListener('abort', cancelReader);
          reader.releaseLock();
        }
      } catch (error) {
        if (controller.signal.aborted) {
          if (isCurrentAiProviderRequest(id, controller)) {
            safeSend(sender, `desktop:ai-provider:request:${id}:error`, {
              message: 'Aborted',
            });
          }
          return;
        }
        sendRequestEvent('error', {
          message: error instanceof Error ? error.message : summarizeError(error),
        });
      } finally {
        deleteActiveAiProviderRequest(id, controller);
      }
    })();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Array.from(response.headers.entries()),
    };
  });

  handleIpc('desktop:ai-provider:request:cancel', async (_event, requestId) => {
    const id = requireSafeIpcRequestId(requestId, 'AI provider request id');
    const controller = activeAiProviderRequests.get(id);
    if (controller) {
      controller.abort();
      deleteActiveAiProviderRequest(id, controller);
    }
  });
}
