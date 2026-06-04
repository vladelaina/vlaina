import { describe, expect, it } from 'vitest';
import { buildStoredUserMessageContent } from './helpers';

describe('buildStoredUserMessageContent image parsing', () => {
  it('keeps image markdown examples as text instead of vision attachments', async () => {
    const content = [
      'Use this syntax:',
      '```md',
      '![example](data:image/png;base64,CODE)',
      '```',
      '',
      '![image](<data:image/png;base64,REAL>)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: [
          'Use this syntax:',
          '```md',
          '![example](data:image/png;base64,CODE)',
          '```',
          '',
          '',
          '',
          'Describe the real image.',
        ].join('\n'),
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
  });

  it('keeps inline code image markdown as text', async () => {
    await expect(buildStoredUserMessageContent('Use `![example](data:image/png;base64,CODE)` here')).resolves.toBe(
      'Use `![example](data:image/png;base64,CODE)` here',
    );
  });

  it('keeps safe remote markdown images as vision attachments on resend paths', async () => {
    const content = [
      '![remote](https://example.com/photo.png)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: 'Describe the real image.',
      },
      { type: 'image_url', image_url: { url: 'https://example.com/photo.png' } },
    ]);
  });

  it('does not turn video markdown into vision attachments on resend paths', async () => {
    const content = [
      '![video](https://example.com/movie.mp4)',
      '',
      'Describe this.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toBe(content);
  });

  it('keeps unsafe image markdown as text instead of vision attachments', async () => {
    const content = [
      '![local](http://127.0.0.1:3000/secret.png)',
      '',
      '![safe](<data:image/png;base64,REAL>)',
      '',
      'Describe the real image.',
    ].join('\n');

    await expect(buildStoredUserMessageContent(content)).resolves.toEqual([
      {
        type: 'text',
        text: [
          '![local](http://127.0.0.1:3000/secret.png)',
          '',
          '',
          '',
          'Describe the real image.',
        ].join('\n'),
      },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,REAL' } },
    ]);
  });
});
