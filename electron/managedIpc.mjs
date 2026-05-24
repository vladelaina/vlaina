const activeManagedStreams = new Map();
const IPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function requireSafeIpcRequestId(value, label) {
  const id = String(value ?? '').trim();
  if (!IPC_REQUEST_ID_PATTERN.test(id)) {
    throw new Error(`${label} must contain only safe channel characters.`);
  }
  return id;
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

function normalizeManagedErrorPayload(payload, status) {
  const fallback = `Managed stream failed: HTTP ${status}`;
  const errorCode =
    typeof payload?.errorCode === 'string' && payload.errorCode.trim()
      ? payload.errorCode.trim()
      : typeof payload?.error?.code === 'string' && payload.error.code.trim()
        ? payload.error.code.trim()
        : null;
  const normalizedCode = typeof errorCode === 'string' ? errorCode.toLowerCase() : '';
  const message =
    normalizedCode === 'points_exhausted' || normalizedCode === 'inactive_points' || normalizedCode === 'insufficient_points'
      ? 'MANAGED_QUOTA_EXHAUSTED'
      : normalizedCode === 'upstream_rate_limited'
        ? 'UPSTREAM_RATE_LIMITED'
        : normalizedCode === 'upstream_unavailable'
          ? 'UPSTREAM_UNAVAILABLE'
          : normalizedCode === 'invalid_request'
            ? 'INVALID_REQUEST'
            : fallback;

  return { message, statusCode: status, errorCode };
}

async function readManagedErrorPayload(response) {
  const fallback = { message: `Managed stream failed: HTTP ${response.status}`, statusCode: response.status, errorCode: null };
  const text = await response.text().catch(() => '');
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
  const bodyBase64 = String(payload?.bodyBase64 ?? '');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(bodyBase64) || bodyBase64.length % 4 !== 0) {
    throw new Error('Invalid managed binary request body.');
  }

  const headers = {};
  const rawHeaders = payload?.headers;
  if (rawHeaders && typeof rawHeaders === 'object') {
    for (const [key, value] of Object.entries(rawHeaders)) {
      const normalizedKey = String(key).trim();
      const normalizedValue = String(value ?? '');
      if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(normalizedKey) || /[\u0000\r\n]/.test(normalizedValue)) {
        throw new Error('Invalid managed binary request header.');
      }
      headers[normalizedKey] = normalizedValue;
    }
  }

  return { body: Buffer.from(bodyBase64, 'base64'), headers };
}

export function registerManagedIpc({
  handleIpc,
  requestManagedJson,
  requestManagedPublicJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  requireNonEmptyString,
}) {
  handleIpc('desktop:billing:create-checkout', async (_event, tier) => {
    return await createElectronBillingCheckout(String(tier ?? ''));
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

  handleIpc('desktop:managed:chat-completion', async (_event, body) => {
    return await requestManagedJson('/chat/completions', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  });

  handleIpc('desktop:managed:image-generation', async (_event, body) => {
    return await requestManagedJson('/images/generations', {
      method: 'POST',
      body: JSON.stringify(body ?? {}),
    });
  });

  handleIpc('desktop:managed:image-edit', async (_event, payload) => {
    const { body, headers } = normalizeManagedBinaryPayload(payload);
    return await requestManagedJson('/images/edits', {
      method: 'POST',
      headers,
      body,
    });
  });

  handleIpc('desktop:managed:chat-completion-stream:start', async (event, requestId, body) => {
    const id = requireSafeIpcRequestId(requestId, 'managed stream request id');

    const previous = activeManagedStreams.get(id);
    previous?.abort();

    const controller = new AbortController();
    activeManagedStreams.set(id, controller);
    const sender = event.sender;

    void (async () => {
      try {
        const response = await fetchWithStoredSession(`${managedApiBaseUrl}/chat/completions`, {
          method: 'POST',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'text/event-stream',
          },
          body: JSON.stringify(body ?? {}),
        });

        if (!response.ok) {
          throw await readManagedErrorPayload(response);
        }

        if (!response.body) {
          throw new Error('Managed API response body is null');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let hasStartedReasoning = false;
        let hasFinishedReasoning = false;

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

          if (reasoning) {
            if (!hasStartedReasoning) {
              fullContent += '<think>';
              hasStartedReasoning = true;
            }
            fullContent += reasoning;
          }

          if (content) {
            if (hasStartedReasoning && !hasFinishedReasoning) {
              fullContent += '</think>';
              hasFinishedReasoning = true;
            }
            fullContent += content;
          }

          if (reasoning || content) {
            if (!safeSend(sender, `desktop:managed:stream:${id}:chunk`, fullContent)) {
              controller.abort();
              return false;
            }
          }
          return true;
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            try {
              if (!consumeLine(line)) {
                return;
              }
            } catch (error) {
              if (!(error instanceof SyntaxError)) {
                throw error;
              }
            }
          }
        }

        if (buffer.trim()) {
          consumeLine(buffer);
        }

        if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += '</think>';
        }

        safeSend(sender, `desktop:managed:stream:${id}:done`, { content: fullContent });
      } catch (error) {
        if (controller.signal.aborted) {
          safeSend(sender, `desktop:managed:stream:${id}:error`, { message: 'Aborted' });
        } else {
          safeSend(sender, `desktop:managed:stream:${id}:error`, {
            message: error instanceof Error
              ? error.message
              : typeof error?.message === 'string'
                ? error.message
                : String(error),
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
