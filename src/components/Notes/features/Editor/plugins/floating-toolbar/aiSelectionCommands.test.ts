import { describe, expect, it } from 'vitest';
import { __testing__, TRANSLATE_TO_ENGLISH_PROMPT } from './aiSelectionCommands';

describe('ai selection commands', () => {
  it('builds an editor instruction payload around the selected text', () => {
    const message = __testing__.buildEditorAiUserMessage(
      TRANSLATE_TO_ENGLISH_PROMPT,
      '你好世界'
    );

    expect(message).toContain('Instruction: Translate to English');
    expect(message).toContain('Selected content:');
    expect(message).toContain('<<<SELECTION');
    expect(message).toContain('你好世界');
    expect(message).toContain('>>>');
  });

  it('normalizes fenced and thinking-tagged model output', () => {
    const normalized = __testing__.normalizeAiEditedText(
      '<think>draft</think>\n```markdown\nHello world\n```'
    );

    expect(normalized).toBe('Hello world');
  });
});
