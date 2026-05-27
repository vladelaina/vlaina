import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AIModel, ChatMessage, Provider } from '../types';
import { getUserFacingAIError } from '../errors';
import { OpenAICompatibleClient } from './openai';

function buildProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: 'provider-1',
    name: 'Test',
    type: 'newapi',
    apiHost: 'https://api.example.com',
    apiKey: 'sk-test',
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function buildModel(overrides: Partial<AIModel> = {}): AIModel {
  return {
    id: 'provider-1::claude-sonnet-4-5',
    apiModelId: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    providerId: 'provider-1',
    enabled: true,
    createdAt: 1,
    ...overrides,
  };
}

function streamResponse(text: string): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

describe('OpenAICompatibleClient endpoint detection', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to Anthropic model listing and returns the detected endpoint type', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'claude-sonnet-4-5' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(buildProvider());

    expect(result).toEqual({
      models: ['claude-sonnet-4-5'],
      endpointType: 'anthropic',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test' },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
  });

  it('uses a recorded Anthropic endpoint type first', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ data: [{ id: 'claude-opus-4-1' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(
      buildProvider({ endpointType: 'anthropic' }),
    );

    expect(result.endpointType).toBe('anthropic');
    expect(result.models).toEqual(['claude-opus-4-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
  });

  it('falls back from a recorded Anthropic endpoint type to OpenAI-compatible model listing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(
      buildProvider({ endpointType: 'anthropic' }),
    );

    expect(result).toEqual({
      models: ['gpt-4o-mini'],
      endpointType: 'openai',
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.com/v1/models',
      expect.objectContaining({
        headers: { Authorization: 'Bearer sk-test' },
      }),
    );
  });

  it('sanitizes model ids returned by provider model listing endpoints', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        data: [
          { id: ' gpt-4o-mini ' },
          { id: '' },
          { id: 42 },
          { id: 'GPT-4O-MINI' },
          {},
          { id: 'claude-sonnet-4-5' },
        ],
      }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().getModelsWithEndpointDetection(buildProvider());

    expect(result).toEqual({
      models: ['gpt-4o-mini', 'claude-sonnet-4-5'],
      endpointType: 'openai',
    });
  });

  it('sends chat requests to Anthropic when the endpoint type is recorded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onChunk = vi.fn();

    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel(),
      buildProvider({ endpointType: 'anthropic' }),
      onChunk,
    );

    expect(result).toBe('hello');
    expect(onChunk).toHaveBeenCalledWith('hello');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'x-api-key': 'sk-test',
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      model: 'claude-sonnet-4-5',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    });
  });

  it('routes GPT image models to the image generation endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ b64_json: 'abc123', revised_prompt: 'A small red house' }],
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onChunk = vi.fn();

    const result = await new OpenAICompatibleClient().sendMessage(
      'draw a house',
      [],
      buildModel({ apiModelId: 'gpt-image-2', name: 'GPT Image 2' }),
      buildProvider(),
      onChunk,
    );

    expect(result).toBe('![A small red house](<data:image/png;base64,abc123>)');
    expect(onChunk).toHaveBeenCalledWith('![A small red house](<data:image/png;base64,abc123>)');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
        },
      }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: 'gpt-image-2',
      prompt: 'draw a house',
      n: 1,
    });
  });

  it('escapes generated image markdown alt text and target', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        data: [{ b64_json: ' abc123\n ', revised_prompt: 'A ] weird\n prompt' }],
      }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().sendMessage(
      'draw',
      [],
      buildModel({ apiModelId: 'gpt-image-2', name: 'GPT Image 2' }),
      buildProvider(),
      vi.fn(),
    );

    expect(result).toBe('![A \\] weird prompt](<data:image/png;base64,abc123>)');
  });

  it('recognizes standalone image model names with provider prefixes and mixed separators', async () => {
    const cases = [
      'OpenAI/GPT_Image_2',
      'openai/DALL·E 3',
      'google/IMAGEN-4.0-generate-preview',
      'bfl/FLUX.1-dev',
      'stability/Stable Diffusion XL',
      'stability/sd3.5-large',
      'alibaba/Qwen_Image',
      'bytedance/Seedream-3.0',
      'ideogram/Ideogram-V3',
      'midjourney/MJ-v7',
      'HiDream-I1',
      'recraft-v3',
      'leonardo-phoenix',
    ];

    for (const apiModelId of cases) {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ data: [{ url: `https://cdn.example.com/${encodeURIComponent(apiModelId)}.png` }] }), { status: 200 }),
      );
      vi.stubGlobal('fetch', fetchMock);

      await new OpenAICompatibleClient().sendMessage(
        'draw a house',
        [],
        buildModel({ apiModelId, name: apiModelId }),
        buildProvider(),
        vi.fn(),
      );

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/v1/images/generations',
        expect.any(Object),
      );
    }
  });

  it('routes standalone image model image inputs to the image edit endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.com/edited.png' }] }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await new OpenAICompatibleClient().sendMessage(
      [
        { type: 'text', text: 'turn this into a watercolor' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,aGk=' } },
      ],
      [],
      buildModel({ apiModelId: 'gpt-image-2', name: 'GPT Image 2' }),
      buildProvider(),
      vi.fn(),
    );

    expect(result).toBe('![Generated image 1](<https://cdn.example.com/edited.png>)');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/v1/images/edits',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': expect.stringMatching(/^multipart\/form-data; boundary=/),
        }),
      }),
    );
    expect(fetchMock.mock.calls[0][1].body).toBeInstanceOf(Blob);
  });

  it('rejects unsupported image edit attachment formats before calling the provider', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(new OpenAICompatibleClient().sendMessage(
      [
        { type: 'text', text: 'edit this' },
        { type: 'image_url', image_url: { url: 'data:image/gif;base64,aGk=' } },
      ],
      [],
      buildModel({ apiModelId: 'gpt-image-2', name: 'GPT Image 2' }),
      buildProvider(),
      vi.fn(),
    )).rejects.toThrow('Image edits require a PNG, JPEG, or WebP image attachment.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not leak rendered thinking or OpenAI transcript fields into Anthropic requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"hello"}}\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const history: ChatMessage[] = [{
      id: 'm1',
      role: 'assistant',
      content: '<think>private plan</think>Visible previous answer',
      apiTranscript: [{
        role: 'assistant',
        content: null,
        reasoning_content: 'private transcript',
        tool_calls: [{
          id: 'call-1',
          type: 'function',
          function: { name: 'web_search', arguments: '{"query":"x"}' },
        }],
      }],
      modelId: 'deepseek-chat',
      timestamp: 1,
      versions: [{ content: '<think>private version plan</think>Version answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [] }],
      currentVersionIndex: 0,
    }];

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      history,
      buildModel(),
      buildProvider({ endpointType: 'anthropic' }),
      vi.fn(),
    );

    const bodyText = fetchMock.mock.calls[0][1].body;
    const body = JSON.parse(bodyText);
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Visible previous answer' },
      { role: 'user', content: 'continue' },
    ]);
    expect(bodyText).not.toContain('<think>');
    expect(bodyText).not.toContain('private plan');
    expect(bodyText).not.toContain('private transcript');
    expect(bodyText).not.toContain('reasoning_content');
    expect(bodyText).not.toContain('tool_calls');
  });

  it('does not silently ignore web search on Anthropic endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      new OpenAICompatibleClient().sendMessage(
        'hi',
        [],
        buildModel(),
        buildProvider({ endpointType: 'anthropic' }),
        vi.fn(),
        undefined,
        { webSearchEnabled: true },
      ),
    ).rejects.toThrow('Web search is unavailable for this model.');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('retries one transient OpenAI-compatible web search model request before failing the tool loop', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('<!DOCTYPE html><html><body>Cloudflare 502</body></html>', { status: 502 }))
      .mockResolvedValueOnce(streamResponse('data: {"choices":[{"delta":{"content":"web answer"}}]}\n\ndata: [DONE]\n\n'));
    vi.stubGlobal('fetch', fetchMock);
    const chunks: string[] = [];

    const result = await new OpenAICompatibleClient().sendMessage(
      'search current docs',
      [],
      buildModel({ apiModelId: 'gpt-4o-mini' }),
      buildProvider({ endpointType: 'openai' }),
      (chunk) => chunks.push(chunk),
      undefined,
      { webSearchEnabled: true },
    );

    expect(result).toBe('web answer');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(chunks[chunks.length - 1]).toBe('web answer');
  });

  it('wraps Anthropic thinking deltas in think tags', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse([
        'event: content_block_delta',
        'data: {"type":"content_block_delta","delta":{"type":"thinking_delta","thinking":"plan"}}',
        '',
        'event: content_block_delta',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"answer"}}',
        '',
      ].join('\n')),
    );
    vi.stubGlobal('fetch', fetchMock);
    const chunks: string[] = [];

    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel(),
      buildProvider({ endpointType: 'anthropic' }),
      (chunk) => chunks.push(chunk),
    );

    expect(result).toBe('<think>plan</think>answer');
    expect(chunks).toEqual(['<think>plan', '<think>plan</think>answer']);
  });

  it('replays hidden API transcript with reasoning content for DeepSeek-compatible history', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const history = [{
      id: 'm1',
      role: 'assistant' as const,
      content: 'Visible previous answer',
      apiTranscript: [
        {
          role: 'assistant',
          content: null,
          reasoning_content: 'Need search.',
          tool_calls: [{
            id: 'call-1',
            type: 'function' as const,
            function: { name: 'web_search', arguments: '{"query":"x"}' },
          }],
        },
        {
          role: 'tool',
          tool_call_id: 'call-1',
          name: 'web_search',
          content: 'Search results',
        },
        {
          role: 'assistant',
          content: 'Visible previous answer',
        },
      ],
      modelId: 'deepseek-chat',
      timestamp: 1,
      versions: [{ content: 'Visible previous answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [] }],
      currentVersionIndex: 0,
    }];

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      history,
      buildModel({ apiModelId: 'deepseek-chat', name: 'DeepSeek Chat' }),
      buildProvider({ name: 'DeepSeek', apiHost: 'https://api.deepseek.com', endpointType: 'openai' }),
      vi.fn(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      {
        ...history[0].apiTranscript![0],
        content: '',
      },
      history[0].apiTranscript![1],
      history[0].apiTranscript![2],
      { role: 'user', content: 'continue' },
    ]);
  });

  it('does not replay hidden reasoning transcript for generic OpenAI-compatible providers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      [{
        id: 'm1',
        role: 'assistant',
        content: 'Visible previous answer',
        apiTranscript: [{ role: 'assistant', content: null, reasoning_content: 'hidden' }],
        modelId: 'gpt-4o-mini',
        timestamp: 1,
        versions: [{ content: 'Visible previous answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [] }],
        currentVersionIndex: 0,
      }],
      buildModel({ apiModelId: 'gpt-4o-mini', name: 'GPT 4o mini' }),
      buildProvider({ endpointType: 'openai' }),
      vi.fn(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Visible previous answer' },
      { role: 'user', content: 'continue' },
    ]);
  });

  it('strips rendered thinking from generic OpenAI-compatible assistant history', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      [{
        id: 'm1',
        role: 'assistant',
        content: '<think>hidden rendered plan</think>Visible previous answer',
        apiTranscript: [{ role: 'assistant', content: null, reasoning_content: 'hidden transcript' }],
        modelId: 'gpt-4o-mini',
        timestamp: 1,
        versions: [{ content: '<think>version hidden</think>Visible previous answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [] }],
        currentVersionIndex: 0,
      }],
      buildModel({ apiModelId: 'gpt-4o-mini', name: 'GPT 4o mini' }),
      buildProvider({ endpointType: 'openai' }),
      vi.fn(),
    );

    const bodyText = fetchMock.mock.calls[0][1].body;
    const body = JSON.parse(bodyText);
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Visible previous answer' },
      { role: 'user', content: 'continue' },
    ]);
    expect(bodyText).not.toContain('<think>');
    expect(bodyText).not.toContain('hidden rendered plan');
    expect(bodyText).not.toContain('hidden transcript');
    expect(bodyText).not.toContain('reasoning_content');
  });

  it('falls back to visible content when a replay transcript is malformed', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      [{
        id: 'm1',
        role: 'assistant',
        content: 'Visible previous answer',
        apiTranscript: [
          { role: 'tool', content: 'missing tool id' },
          {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call-1',
              type: 'function',
              function: { name: 'web_search', arguments: 123 as unknown as string },
            }],
          },
        ],
        modelId: 'deepseek-chat',
        timestamp: 1,
        versions: [{ content: 'Visible previous answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [] }],
        currentVersionIndex: 0,
      }],
      buildModel({ apiModelId: 'deepseek-chat', name: 'DeepSeek Chat' }),
      buildProvider({ name: 'DeepSeek', apiHost: 'https://api.deepseek.com', endpointType: 'openai' }),
      vi.fn(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      { role: 'assistant', content: 'Visible previous answer' },
      { role: 'user', content: 'continue' },
    ]);
  });

  it('replays hidden API transcript restored only from the active message version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    const apiTranscript = [{ role: 'assistant' as const, content: 'version answer', reasoning_content: 'version hidden' }];

    await new OpenAICompatibleClient().sendMessage(
      'continue',
      [{
        id: 'm1',
        role: 'assistant',
        content: 'Version answer',
        modelId: 'deepseek-chat',
        timestamp: 1,
        versions: [{ content: 'Version answer', createdAt: 1, kind: 'original' as const, subsequentMessages: [], apiTranscript }],
        currentVersionIndex: 0,
      }],
      buildModel({ apiModelId: 'deepseek-chat', name: 'DeepSeek Chat' }),
      buildProvider({ name: 'DeepSeek', apiHost: 'https://api.deepseek.com', endpointType: 'openai' }),
      vi.fn(),
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.messages).toEqual([
      apiTranscript[0],
      { role: 'user', content: 'continue' },
    ]);
  });

  it('stores hidden API transcript for direct OpenAI-compatible reasoning streams', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse([
        'data: {"choices":[{"delta":{"reasoning_content":"plan"}}]}',
        '',
        'data: {"choices":[{"delta":{"content":"answer"}}]}',
        '',
        'data: [DONE]',
        '',
      ].join('\n')),
    );
    vi.stubGlobal('fetch', fetchMock);

    const onApiTranscript = vi.fn();
    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'deepseek-chat' }),
      buildProvider({ name: 'DeepSeek', apiHost: 'https://api.deepseek.com', endpointType: 'openai' }),
      vi.fn(),
      undefined,
      { onApiTranscript },
    );

    expect(result).toBe('<think>plan</think>answer');
    expect(onApiTranscript).toHaveBeenCalledWith([{
      role: 'assistant',
      content: 'answer',
      reasoning_content: 'plan',
    }]);
  });

  it('stores hidden API transcript for managed reasoning streams', async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode([
            'data: {"choices":[{"delta":{"reasoning_content":"managed plan"}}]}',
            'data: {"choices":[{"delta":{"content":"managed answer"}}]}',
            'data: [DONE]',
            '',
          ].join('\n')));
          controller.close();
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const onApiTranscript = vi.fn();
    const result = await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'gpt-5.4' }),
      buildProvider({ id: 'vlaina-managed', apiHost: 'https://api.vlaina.com/v1', apiKey: '' }),
      vi.fn(),
      undefined,
      { onApiTranscript },
    );

    expect(result).toBe('<think>managed plan</think>managed answer');
    expect(onApiTranscript).toHaveBeenCalledWith([{
      role: 'assistant',
      content: 'managed answer',
      reasoning_content: 'managed plan',
    }]);
  });

  it('does not send local chat-control options in provider request bodies', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"next"}}]}\n\ndata: [DONE]\n\n'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'gpt-4o-mini' }),
      buildProvider({ endpointType: 'openai' }),
      vi.fn(),
      undefined,
      {
        webSearchEnabled: false,
        onApiTranscript: vi.fn(),
        max_tokens: 32,
      },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.max_tokens).toBe(32);
    expect(body.webSearchEnabled).toBeUndefined();
    expect(body.onApiTranscript).toBeUndefined();
    expect(body.onWebSearchStatus).toBeUndefined();
  });

  it('keeps OpenAI-compatible request timeout active while reading the stream body', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => new Response(
      new ReadableStream({
        start(controller) {
          init.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('Aborted', 'AbortError'));
          });
        },
      }),
      { status: 200 },
    ));
    vi.stubGlobal('fetch', fetchMock);
    const client = new OpenAICompatibleClient();
    (client as unknown as { timeout: number }).timeout = 10;

    const request = expect(client.sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'gpt-4o-mini' }),
      buildProvider({ endpointType: 'openai' }),
      vi.fn(),
    )).rejects.toThrow('The AI request timed out.');
    await vi.advanceTimersByTimeAsync(20);

    await request;
    vi.useRealTimers();
  });

  it('clears the OpenAI-compatible request timeout after a successful stream', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"done"}}]}\n\ndata: [DONE]\n\n'),
    ));

    const client = new OpenAICompatibleClient();
    (client as unknown as { timeout: number }).timeout = 10_000;

    await expect(client.sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'gpt-4o-mini' }),
      buildProvider({ endpointType: 'openai' }),
      vi.fn(),
    )).resolves.toBe('done');

    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('rejects HTML error documents streamed as assistant content before emitting UI chunks', async () => {
    const onChunk = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      streamResponse('data: {"choices":[{"delta":{"content":"<!DOCTYPE html><html><head><title>nekotick.org | 524: A timeout occurred</title></head><body>Cloudflare Error code 524</body></html>"}}]}\n\ndata: [DONE]\n\n'),
    ));

    await expect(new OpenAICompatibleClient().sendMessage(
      'hi',
      [],
      buildModel({ apiModelId: 'gpt-4o-mini' }),
      buildProvider({ endpointType: 'openai' }),
      onChunk,
    )).rejects.toMatchObject({
      message: 'UPSTREAM_UNAVAILABLE',
    });
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('preserves direct provider transport details for chat failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(
      new OpenAICompatibleClient().sendMessage(
        'hi',
        [],
        buildModel({ apiModelId: 'gpt-4o-mini' }),
        buildProvider(),
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      details: 'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed',
    });

    try {
      await new OpenAICompatibleClient().sendMessage(
        'hi',
        [],
        buildModel({ apiModelId: 'gpt-4o-mini' }),
        buildProvider(),
        vi.fn(),
      );
    } catch (error) {
      expect(getUserFacingAIError(error).message).toBe(
        'OpenAI-compatible chat request to https://api.example.com/v1/chat/completions failed: fetch failed',
      );
    }
  });
});
