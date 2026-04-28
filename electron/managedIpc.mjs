const activeManagedStreams = new Map();

export function registerManagedIpc({
  handleIpc,
  requestManagedJson,
  fetchWithStoredSession,
  managedApiBaseUrl,
  createElectronBillingCheckout,
  requireNonEmptyString,
}) {
  handleIpc('desktop:billing:create-checkout', async (_event, tier) => {
    return await createElectronBillingCheckout(String(tier ?? ''));
  });

  handleIpc('desktop:managed:get-models', async () => {
    return await requestManagedJson('/models', { method: 'GET' });
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

  handleIpc('desktop:managed:chat-completion-stream:start', async (event, requestId, body) => {
    const id = String(requestId ?? '').trim();
    if (!id) {
      throw new Error('A managed stream request id is required.');
    }

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
          throw new Error(await response.text().catch(() => `Managed stream failed: HTTP ${response.status}`));
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

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]' || !trimmed.startsWith('data: ')) {
              continue;
            }

            try {
              const payload = JSON.parse(trimmed.slice(6));
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
                sender.send(`desktop:managed:stream:${id}:chunk`, fullContent);
              }
            } catch {
            }
          }
        }

        if (hasStartedReasoning && !hasFinishedReasoning) {
          fullContent += '</think>';
        }

        sender.send(`desktop:managed:stream:${id}:done`, { content: fullContent });
      } catch (error) {
        if (controller.signal.aborted) {
          sender.send(`desktop:managed:stream:${id}:error`, { message: 'Aborted' });
        } else {
          sender.send(`desktop:managed:stream:${id}:error`, {
            message: error instanceof Error ? error.message : String(error),
          });
        }
      } finally {
        activeManagedStreams.delete(id);
      }
    })();
  });

  handleIpc('desktop:managed:chat-completion-stream:cancel', async (_event, requestId) => {
    const id = requireNonEmptyString(requestId, 'managed stream request id');
    const controller = activeManagedStreams.get(id);
    if (controller) {
      controller.abort();
      activeManagedStreams.delete(id);
    }
  });
}
