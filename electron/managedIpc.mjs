const activeManagedStreams = new Map();
const activeManagedJsonRequests = new Map();
const IPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const MAX_MANAGED_BINARY_BODY_BYTES = 64 * 1024 * 1024;
const MAX_MANAGED_BINARY_BODY_BASE64_CHARS = Math.ceil(MAX_MANAGED_BINARY_BODY_BYTES / 3) * 4;
const MAX_MANAGED_STREAM_LINE_CHARS = 1024 * 1024;
const MAX_MANAGED_ERROR_BODY_BYTES = 64 * 1024;

function requireSafeIpcRequestId(value, label) {
  const rawId = primitiveToString(value);
  const id = rawId === null ? '' : rawId.trim();
  if (!IPC_REQUEST_ID_PATTERN.test(id)) {
    throw new Error(`${label} must contain only safe channel characters.`);
  }
  return id;
}

function primitiveToString(value) {
  if (value == null) {
    return '';
  }
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return null;
  }
}

function getManagedErrorMessage(error) {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && typeof error.message === 'string') {
    return error.message;
  }
  return primitiveToString(error) || 'Unknown error';
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

function deleteActiveManagedStream(requestId, controller) {
  if (activeManagedStreams.get(requestId) === controller) {
    activeManagedStreams.delete(requestId);
  }
}

function isCurrentManagedStream(requestId, controller) {
  return activeManagedStreams.get(requestId) === controller;
}

function deleteActiveManagedJsonRequest(requestId, controller) {
  if (activeManagedJsonRequests.get(requestId) === controller) {
    activeManagedJsonRequests.delete(requestId);
  }
}

function isCurrentManagedJsonRequest(requestId, controller) {
  return activeManagedJsonRequests.get(requestId) === controller;
}

function parseOptionalManagedRequestId(requestIdOrPayload, maybePayload, label) {
  if (maybePayload === undefined) {
    return { requestId: null, payload: requestIdOrPayload };
  }

  return {
    requestId: requireSafeIpcRequestId(requestIdOrPayload, label),
    payload: maybePayload,
  };
}

async function requestManagedJsonWithOptionalCancel(requestManagedJson, requestId, pathname, init) {
  const controller = requestId ? new AbortController() : null;

  if (requestId && controller) {
    activeManagedJsonRequests.get(requestId)?.abort();
    activeManagedJsonRequests.set(requestId, controller);
  }

  try {
    const managedRequest = Promise.resolve(requestManagedJson(pathname, {
      ...init,
      ...(controller ? { signal: controller.signal } : {}),
    }));
    const result = controller
      ? await raceWithAbort(managedRequest, controller.signal)
      : await managedRequest;
    if (requestId && controller && (!isCurrentManagedJsonRequest(requestId, controller) || controller.signal.aborted)) {
      throw createAbortError();
    }
    return result;
  } catch (error) {
    if (requestId && controller && (!isCurrentManagedJsonRequest(requestId, controller) || controller.signal.aborted)) {
      throw createAbortError();
    }
    throw error;
  } finally {
    if (requestId && controller) {
      deleteActiveManagedJsonRequest(requestId, controller);
    }
  }
}

function cancelManagedJsonRequest(requestId, label) {
  const id = requireSafeIpcRequestId(requestId, label);
  const controller = activeManagedJsonRequests.get(id);
  if (controller) {
    controller.abort();
    deleteActiveManagedJsonRequest(id, controller);
  }
}

function normalizeManagedErrorPayload(payload, status) {
  const fallback = `Managed stream failed: HTTP ${status}`;
  const errorCode =
    typeof payload?.errorCode === 'string' && payload.errorCode.trim()
      ? payload.errorCode.trim()
      : typeof payload?.error?.code === 'string' && payload.error.code.trim()
        ? payload.error.code.trim()
        : null;
  const normalizedCode = typeof errorCode === 'string' ? errorCode.toLowerCase() : '';
  let message = fallback;
  if (normalizedCode === 'points_exhausted' || normalizedCode === 'inactive_points' || normalizedCode === 'insufficient_points') {
    message = 'MANAGED_QUOTA_EXHAUSTED';
  } else if (normalizedCode === 'upstream_rate_limited') {
    message = 'UPSTREAM_RATE_LIMITED';
  } else if (normalizedCode === 'upstream_unavailable') {
    message = 'UPSTREAM_UNAVAILABLE';
  } else if (normalizedCode === 'unsupported_message_content' || normalizedCode === 'unsupported_model_input') {
    message = 'UNSUPPORTED_MODEL_INPUT';
  } else if (normalizedCode === 'invalid_request') {
    message = 'INVALID_REQUEST';
  }

  return { message, statusCode: status, errorCode };
}

function createAbortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (!signal?.aborted) return;
  throw createAbortError();
}

function assertManagedStreamLineLength(line) {
  if (line.length > MAX_MANAGED_STREAM_LINE_CHARS) {
    throw new Error('Managed stream line is too large.');
  }
}

function appendManagedStreamBuffer(buffer, next) {
  if (buffer.length + next.length > MAX_MANAGED_STREAM_LINE_CHARS) {
    throw new Error('Managed stream line is too large.');
  }
  return buffer + next;
}

async function readManagedErrorText(response, signal) {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';
  const cancelReader = () => {
    void reader.cancel(createAbortError()).catch(() => {});
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      if (done) {
        break;
      }

      bytesRead += value.byteLength;
      if (bytesRead > MAX_MANAGED_ERROR_BODY_BYTES) {
        void reader.cancel(createAbortError()).catch(() => {});
        return '';
      }
      text += decoder.decode(value, { stream: true });
    }

    return text + decoder.decode();
  } finally {
    signal?.removeEventListener('abort', cancelReader);
    reader.releaseLock();
  }
}

async function raceWithAbort(promise, signal) {
  if (!signal) return await promise;
  throwIfAborted(signal);
  promise.catch(() => undefined);

  return await new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener('abort', abort);
    };
    const settle = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const abort = () => {
      settle(() => reject(createAbortError()));
    };

    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }

    promise.then(
      (value) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            resolve(value);
          } catch (error) {
            reject(error);
          }
        });
      },
      (error) => {
        settle(() => {
          try {
            throwIfAborted(signal);
            reject(error);
          } catch (abortError) {
            reject(abortError);
          }
        });
      },
    );
  });
}

async function readManagedErrorPayload(response, signal) {
  const fallback = { message: `Managed stream failed: HTTP ${response.status}`, statusCode: response.status, errorCode: null };
  let text = '';
  try {
    throwIfAborted(signal);
    text = await readManagedErrorText(response, signal);
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError();
    }
    text = '';
  }
  if (!text) {
    return fallback;
  }

  try {
    const payload = JSON.parse(text);
    return normalizeManagedErrorPayload(payload, response.status);
  } catch {
    return fallback;
  }
}

function normalizeManagedBinaryPayload(payload) {
  if (typeof payload?.bodyBase64 !== 'string') {
    throw new Error('Invalid managed binary request body.');
  }
  const bodyBase64 = payload.bodyBase64;
  if (bodyBase64.length > MAX_MANAGED_BINARY_BODY_BASE64_CHARS) {
    throw new Error('Managed binary request body is too large.');
  }
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(bodyBase64) || bodyBase64.length % 4 !== 0) {
    throw new Error('Invalid managed binary request body.');
  }
  const decodedByteLength = getBase64DecodedByteLength(bodyBase64);
  if (decodedByteLength === null || decodedByteLength > MAX_MANAGED_BINARY_BODY_BYTES) {
    throw new Error('Managed binary request body is too large.');
  }

  const headers = {};
  const rawHeaders = payload?.headers;
  if (rawHeaders && typeof rawHeaders === 'object') {
    for (const [key, value] of Object.entries(rawHeaders)) {
      const normalizedKey = String(key).trim();
      const normalizedValue = primitiveToString(value);
      if (normalizedValue === null) {
        throw new Error('Invalid managed binary request header.');
      }
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(normalizedKey) || /[\u0000\r\n]/.test(normalizedValue)) {
        throw new Error('Invalid managed binary request header.');
      }
      headers[normalizedKey] = normalizedValue;
    }
  }

  return { body: Buffer.from(bodyBase64, 'base64'), headers };
}

function getBase64DecodedByteLength(payload) {
  if (payload.length % 4 !== 0) {
    return null;
  }

  let padding = 0;
  if (payload.endsWith('==')) {
    padding = 2;
  } else if (payload.endsWith('=')) {
    padding = 1;
  }

  const byteLength = Math.floor((payload.length * 3) / 4) - padding;
  return byteLength >= 0 ? byteLength : null;
}

function sanitizeManagedChatMessage(message) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) {
    return message;
  }

  const nextMessage = { ...message };
  const hasAssistantMetadata = Boolean(nextMessage.reasoning_content) ||
    (Array.isArray(nextMessage.tool_calls) && nextMessage.tool_calls.length > 0);
  if (nextMessage.role === 'assistant' && nextMessage.content == null && hasAssistantMetadata) {
    nextMessage.content = '';
  }
  if (
    (nextMessage.role === 'system' || nextMessage.role === 'user' || nextMessage.role === 'tool') &&
    nextMessage.content == null
  ) {
    nextMessage.content = '';
  }
  return nextMessage;
}

function sanitizeManagedChatCompletionBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return body ?? {};
  }
  if (!Array.isArray(body.messages)) {
    return body;
  }
  return {
    ...body,
    messages: body.messages.map(sanitizeManagedChatMessage),
  };
}

function createManagedStreamAccumulator(onChunk) {
  let fullContent = '';
  let hasStartedReasoning = false;
  let hasFinishedReasoning = false;

  return {
    pushDelta({ reasoning, content }) {
      const reasoningText = typeof reasoning === 'string' ? reasoning : '';
      const contentText = typeof content === 'string' ? content : '';
      if (!reasoningText && !contentText) {
        return true;
      }

      if (reasoningText) {
        if (!hasStartedReasoning || hasFinishedReasoning) {
          fullContent += '<think>';
          hasStartedReasoning = true;
          hasFinishedReasoning = false;
        }
        fullContent += reasoningText;
      }

      if (contentText) {
        if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += '</think>';
          hasFinishedReasoning = true;
        }
        fullContent += contentText;
      }

      return onChunk(fullContent);
    },
    finish() {
      if (hasStartedReasoning && !hasFinishedReasoning) {
        fullContent += '</think>';
        hasFinishedReasoning = true;
      }
      return fullContent;
    },
  };
}

export function registerManagedIpc({
  handleIpc,
  requestManagedJson,
  requestManagedPublicJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  submitElectronFeedback,
  requireNonEmptyString,
}) {
  handleIpc('desktop:billing:create-checkout', async (_event, tier) => {
    return await createElectronBillingCheckout(primitiveToString(tier) ?? '');
  });

  handleIpc('desktop:feedback:submit', async (_event, message) => {
    return await submitElectronFeedback(primitiveToString(message) ?? '');
  });

  handleIpc('desktop:managed:get-models', async () => {
    return await requestManagedPublicJson('/models', { method: 'GET' });
  });

  handleIpc('desktop:managed:get-models-version', async () => {
    return await requestManagedPublicJson('/models/version', { method: 'GET' });
  });

  handleIpc('desktop:managed:get-budget', async () => {
    return await requestManagedJson('/budget', { method: 'GET' });
  });

  handleIpc('desktop:managed:chat-completion', async (_event, requestIdOrBody, maybeBody) => {
    const { requestId, payload: body } = parseOptionalManagedRequestId(
      requestIdOrBody,
      maybeBody,
      'managed chat completion request id',
    );
    return await requestManagedJsonWithOptionalCancel(requestManagedJson, requestId, '/chat/completions', {
      method: 'POST',
      body: JSON.stringify(sanitizeManagedChatCompletionBody(body)),
    });
  });

  handleIpc('desktop:managed:chat-completion:cancel', async (_event, requestId) => {
    cancelManagedJsonRequest(requestId, 'managed chat completion request id');
  });

  handleIpc('desktop:managed:image-generation', async (_event, requestIdOrBody, maybeBody) => {
    const { requestId, payload: body } = parseOptionalManagedRequestId(
      requestIdOrBody,
      maybeBody,
      'managed image generation request id',
    );
    return await requestManagedJsonWithOptionalCancel(requestManagedJson, requestId, '/images/generations', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  });

  handleIpc('desktop:managed:image-generation:cancel', async (_event, requestId) => {
    cancelManagedJsonRequest(requestId, 'managed image generation request id');
  });

  handleIpc('desktop:managed:image-edit', async (_event, requestIdOrPayload, maybePayload) => {
    const { requestId, payload } = parseOptionalManagedRequestId(
      requestIdOrPayload,
      maybePayload,
      'managed image edit request id',
    );
    const { body, headers } = normalizeManagedBinaryPayload(payload);
    return await requestManagedJsonWithOptionalCancel(requestManagedJson, requestId, '/images/edits', {
      method: 'POST',
      headers,
      body,
    });
  });

  handleIpc('desktop:managed:image-edit:cancel', async (_event, requestId) => {
    cancelManagedJsonRequest(requestId, 'managed image edit request id');
  });

  handleIpc('desktop:managed:chat-completion-stream:start', async (event, requestId, body) => {
    const id = requireSafeIpcRequestId(requestId, 'managed stream request id');

    const previous = activeManagedStreams.get(id);
    previous?.abort();

    const controller = new AbortController();
    activeManagedStreams.set(id, controller);
    const sender = event.sender;
    const sendStreamEvent = (suffix, payload) => {
      if (!isCurrentManagedStream(id, controller)) {
        return false;
      }
      return safeSend(sender, `desktop:managed:stream:${id}:${suffix}`, payload);
    };

    void (async () => {
      try {
        const response = await raceWithAbort(fetchWithStoredSession(`${managedApiBaseUrl}/chat/completions`, {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(sanitizeManagedChatCompletionBody(body)),
        }), controller.signal);

        if (!response.ok) {
          throw await readManagedErrorPayload(response, controller.signal);
        }

        if (!response.body) {
          throw new Error('Managed API response body is null');
        }

        const reader = response.body.getReader();
        const cancelReader = () => {
          void reader.cancel(new Error('Aborted')).catch(() => {});
        };
        controller.signal.addEventListener('abort', cancelReader, { once: true });
        const decoder = new TextDecoder();
        let buffer = '';

        const accumulator = createManagedStreamAccumulator((fullContent) => {
          if (!sendStreamEvent('chunk', fullContent)) {
            controller.abort();
            return false;
          }
          return true;
        });

        const consumeLine = (line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
            return true;
          }

          const payload = JSON.parse(trimmed.slice(6));
          if (payload?.error) {
            const message = typeof payload.error?.message === 'string'
              ? payload.error.message
              : 'Managed stream failed';
            throw new Error(message);
          }

          const delta = Array.isArray(payload.choices) ? payload.choices[0]?.delta : undefined;
          const reasoning =
            typeof delta?.reasoning_content === 'string' ? delta.reasoning_content : null;
          const content = typeof delta?.content === 'string' ? delta.content : null;

          return accumulator.pushDelta({ reasoning, content });
        };

        try {
          if (controller.signal.aborted) {
            throw new Error('Aborted');
          }

          while (true) {
            const { done, value } = await raceWithAbort(reader.read(), controller.signal);
            if (controller.signal.aborted) {
              throw new Error('Aborted');
            }
            if (done) {
              break;
            }

            buffer = appendManagedStreamBuffer(buffer, decoder.decode(value, { stream: true }));
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              try {
                assertManagedStreamLineLength(line);
                if (!consumeLine(line)) {
                  throw new Error('Aborted');
                }
              } catch (error) {
                if (!(error instanceof SyntaxError)) {
                  throw error;
                }
              }
            }
            assertManagedStreamLineLength(buffer);
          }

          if (buffer.trim()) {
            assertManagedStreamLineLength(buffer);
            if (!consumeLine(buffer)) {
              throw new Error('Aborted');
            }
          }

          sendStreamEvent('done', { content: accumulator.finish() });
        } catch (error) {
          void reader.cancel(createAbortError()).catch(() => {});
          throw error;
        } finally {
          controller.signal.removeEventListener('abort', cancelReader);
          reader.releaseLock();
        }
      } catch (error) {
        if (controller.signal.aborted) {
          if (isCurrentManagedStream(id, controller)) {
            safeSend(sender, `desktop:managed:stream:${id}:error`, { message: 'Aborted' });
          }
        } else {
          sendStreamEvent('error', {
            message: getManagedErrorMessage(error),
            statusCode: typeof error?.statusCode === 'number' ? error.statusCode : undefined,
            errorCode: typeof error?.errorCode === 'string' ? error.errorCode : undefined,
          });
        }
      } finally {
        deleteActiveManagedStream(id, controller);
      }
    })();
  });

  handleIpc('desktop:managed:chat-completion-stream:cancel', async (_event, requestId) => {
    const id = requireSafeIpcRequestId(requestId, 'managed stream request id');
    const controller = activeManagedStreams.get(id);
    if (controller) {
      controller.abort();
      deleteActiveManagedStream(id, controller);
    }
  });
}
