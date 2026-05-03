import { describe, expect, it } from 'vitest';
import { __testing__, TRANSLATE_TO_ENGLISH_PROMPT } from './aiSelectionCommands';

describe('ai selection commands', () => {
  it('builds an editor instruction payload around the selected text', () => {
    const message = __testing__.buildEditorAiUserMessage(
      TRANSLATE_TO_ENGLISH_PROMPT,
      'Hello world',
      {
        beforeContext: 'The previous sentence.',
        afterContext: 'The next sentence.',
      }
    );

    expect(message).toContain('Instruction: Translate to English');
    expect(message).toContain('Use the surrounding context only to understand meaning');
    expect(message).toContain('Do not edit or return the surrounding context.');
    expect(message).toContain('Read-only context before the selection:');
    expect(message).toContain('The previous sentence.');
    expect(message).toContain('Selected content:');
    expect(message).toContain('<<<SELECTION');
    expect(message).toContain('Hello world');
    expect(message).toContain('>>>');
    expect(message).toContain('Read-only context after the selection:');
    expect(message).toContain('The next sentence.');
  });

  it('normalizes fenced and thinking-tagged model output', () => {
    const normalized = __testing__.normalizeAiEditedText(
      '<think>draft</think>\n```markdown\nHello world\n```'
    );

    expect(normalized).toBe('Hello world');
  });
});
