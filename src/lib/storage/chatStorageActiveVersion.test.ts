import { describe, expect, it } from 'vitest';
import { normalizeSessionMessages } from './chatStorage';

describe('chatStorage active version normalization', () => {
  it('restores top-level content from the active persisted version', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'old answer',
      modelId: 'model-1',
      timestamp: 1,
      currentVersionIndex: 1,
      versions: [
        { content: 'old answer', createdAt: 1, kind: 'original', subsequentMessages: [] },
        { content: 'new answer', createdAt: 2, kind: 'regeneration', subsequentMessages: [] },
      ],
    }]);

    expect(messages[0]).toMatchObject({
      content: 'new answer',
      currentVersionIndex: 1,
    });
    expect(messages[0]?.versions.map((version) => version.content)).toEqual([
      'old answer',
      'new answer',
    ]);
  });

  it('exposes the active version transcript instead of a stale top-level transcript', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'old answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [{ role: 'assistant', content: 'old answer transcript' }],
      currentVersionIndex: 1,
      versions: [
        {
          content: 'old answer',
          createdAt: 1,
          kind: 'original',
          subsequentMessages: [],
          apiTranscript: [{ role: 'assistant', content: 'old answer transcript' }],
        },
        {
          content: 'new answer',
          createdAt: 2,
          kind: 'regeneration',
          subsequentMessages: [],
          apiTranscript: [{ role: 'assistant', content: 'new answer transcript' }],
        },
      ],
    }]);

    expect(messages[0]?.apiTranscript).toEqual([
      { role: 'assistant', content: 'new answer transcript' },
    ]);
    expect(messages[0]?.versions[1]?.apiTranscript).toEqual(messages[0]?.apiTranscript);
  });

  it('does not copy stale top-level transcripts onto an active version with different content', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'old answer',
      modelId: 'model-1',
      timestamp: 1,
      apiTranscript: [{ role: 'assistant', content: 'old answer transcript' }],
      currentVersionIndex: 1,
      versions: [
        { content: 'old answer', createdAt: 1, kind: 'original', subsequentMessages: [] },
        { content: 'new answer', createdAt: 2, kind: 'regeneration', subsequentMessages: [] },
      ],
    }]);

    expect(messages[0]?.apiTranscript).toBeUndefined();
    expect(messages[0]?.versions[1]?.apiTranscript).toBeUndefined();
  });

  it('derives user image sources from the active version content', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'user',
      content: 'old prompt\n\n![old](attachment://old.png)',
      modelId: 'model-1',
      timestamp: 1,
      imageSources: ['attachment://old.png'],
      currentVersionIndex: 1,
      versions: [
        {
          content: 'old prompt\n\n![old](attachment://old.png)',
          createdAt: 1,
          kind: 'original',
          subsequentMessages: [],
        },
        {
          content: 'new prompt\n\n![new](attachment://active.png)',
          createdAt: 2,
          kind: 'edit',
          subsequentMessages: [],
        },
      ],
    }]);

    expect(messages[0]).toMatchObject({
      content: 'new prompt\n\n![new](attachment://active.png)',
      imageSources: ['attachment://active.png'],
    });
  });

  it('derives assistant image sources from markdown and html in the active version content', () => {
    const messages = normalizeSessionMessages([{
      id: 'm1',
      role: 'assistant',
      content: 'old answer\n\n<img src="https://example.com/old.png">',
      modelId: 'model-1',
      timestamp: 1,
      imageSources: ['https://example.com/old.png'],
      currentVersionIndex: 1,
      versions: [
        {
          content: 'old answer\n\n<img src="https://example.com/old.png">',
          createdAt: 1,
          kind: 'original',
          subsequentMessages: [],
        },
        {
          content: 'new answer\n\n![new](attachment://active.png)\n\n<img src="https://example.com/active.png">',
          createdAt: 2,
          kind: 'regeneration',
          subsequentMessages: [],
        },
      ],
    }]);

    expect(messages[0]).toMatchObject({
      content: 'new answer\n\n![new](attachment://active.png)\n\n<img src="https://example.com/active.png">',
      imageSources: ['attachment://active.png', 'https://example.com/active.png'],
    });
  });
});
