import { describe, expect, it } from 'vitest';
import {
  buildEditorAiUserMessage,
  MAX_EDITOR_AI_CONTEXT_CHARS,
  MAX_EDITOR_AI_INSTRUCTION_CHARS,
} from './promptBuilder';

describe('promptBuilder', () => {
  it('bounds instruction and context fields in editor AI prompts', () => {
    const message = buildEditorAiUserMessage(
      'i'.repeat(MAX_EDITOR_AI_INSTRUCTION_CHARS + 20),
      'selected',
      {
        beforeContext: 'b'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS + 20),
        afterContext: 'a'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS + 20),
      },
    );

    expect(message).toContain(`Instruction: ${'i'.repeat(MAX_EDITOR_AI_INSTRUCTION_CHARS)}`);
    expect(message).not.toContain('i'.repeat(MAX_EDITOR_AI_INSTRUCTION_CHARS + 1));
    expect(message).toContain('b'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS));
    expect(message).not.toContain('b'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS + 1));
    expect(message).toContain('a'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS));
    expect(message).not.toContain('a'.repeat(MAX_EDITOR_AI_CONTEXT_CHARS + 1));
  });
});
