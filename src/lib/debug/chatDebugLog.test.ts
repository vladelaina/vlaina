import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDiagnosticsLog,
  getDiagnosticsLogText,
} from '@/lib/diagnostics/diagnosticsLog';
import { addChatDebugLog } from './chatDebugLog';

describe('addChatDebugLog', () => {
  afterEach(() => {
    clearDiagnosticsLog();
  });

  it('adds sanitized chat and web search details to copied diagnostics', () => {
    addChatDebugLog('web-search', 'status:error', {
      modelId: 'deepseek-chat',
      providerId: 'managed',
      query: 'private search terms',
      urls: ['https://private.example/result?token=secret'],
      metrics: { durationMs: 42, resultCount: 1 },
      message: 'The current model does not support this input. Remove unsupported files.',
    }, 'warn');

    const log = getDiagnosticsLogText();

    expect(log).toContain('"channel": "chat"');
    expect(log).toContain('"event": "status:error"');
    expect(log).toContain('"scope": "web-search"');
    expect(log).toContain('"modelId": "deepseek-chat"');
    expect(log).toContain('"queryLength": 20');
    expect(log).toContain('"urlCount": 1');
    expect(log).toContain('"errorCategory": "unsupported-input"');
    expect(log).not.toContain('private search terms');
    expect(log).not.toContain('private.example');
    expect(log).not.toContain('token=secret');
    expect(log).not.toContain('Remove unsupported files');
  });

  it('drops identifiers and error details that may contain secrets', () => {
    addChatDebugLog('openai', 'model request failed before response body stream', {
      model: 'https://api.example/models/private?key=secret',
      error: 'Request failed with bearer sk-secret-value and prompt contents',
      toolCalls: [
        { id: 'private-call-id', name: 'web_search' },
        { id: 'private-read-id', name: 'read_webpage' },
      ],
    }, 'error');

    const log = getDiagnosticsLogText();

    expect(log).toContain('"toolCalls": [');
    expect(log).toContain('"web_search"');
    expect(log).toContain('"read_webpage"');
    expect(log).toContain('"errorCategory": "unknown"');
    expect(log).not.toContain('api.example');
    expect(log).not.toContain('sk-secret-value');
    expect(log).not.toContain('prompt contents');
    expect(log).not.toContain('private-call-id');
  });

  it('keeps bounded internal fallback event names readable', () => {
    addChatDebugLog(
      'web-search-loop',
      'managed model rejected tool input; retrying with plain web evidence',
      { model: 'deepseek-v4-flash' },
      'warn',
    );

    expect(getDiagnosticsLogText()).toContain(
      '"event": "managed model rejected tool input; retrying with plain web evidence"',
    );
  });
});
