import { describe, expect, it } from 'vitest';
import { buildChatErrorPayload } from './errorHandling';

describe('buildChatErrorPayload', () => {
  it('localizes desktop custom provider transport failures for custom providers', () => {
    const result = buildChatErrorPayload(
      new Error(
        "Error invoking remote method 'desktop:ai-provider:request:start': Error: AI provider request to https://api.example.com/v1/chat/completions failed before an HTTP response was received: TypeError: fetch failed"
      ),
      false,
    );

    expect(result.message).toBe(
      'The custom channel still could not be reached after automatic retries. Check your network or the upstream service, then try again.',
    );
    expect(result.xml).toBe(
      '<error type="NETWORK_ERROR" code="">The custom channel still could not be reached after automatic retries. Check your network or the upstream service, then try again.</error>',
    );
  });

  it('preserves custom provider upstream messages', () => {
    const result = buildChatErrorPayload(new Error('Custom provider rejected the request'), false);

    expect(result).toEqual({
      message: 'Custom provider rejected the request',
      xml: '<error type="custom_provider" code="">Custom provider rejected the request</error>',
    });
  });
});
