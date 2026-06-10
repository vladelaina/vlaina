export interface EditorAiSelectionContext {
  beforeContext?: string;
  afterContext?: string;
}

export const MAX_EDITOR_AI_INSTRUCTION_CHARS = 4096;
export const MAX_EDITOR_AI_CONTEXT_CHARS = 1200;

function boundPromptField(value: string, maxChars: number): string {
  return value.length > maxChars ? value.slice(0, maxChars) : value;
}

export function buildEditorAiUserMessage(
  instruction: string,
  selectedText: string,
  context: EditorAiSelectionContext = {}
): string {
  const beforeContext = boundPromptField(context.beforeContext ?? '', MAX_EDITOR_AI_CONTEXT_CHARS);
  const afterContext = boundPromptField(context.afterContext ?? '', MAX_EDITOR_AI_CONTEXT_CHARS);
  const message = [
    `Instruction: ${boundPromptField(instruction.trim(), MAX_EDITOR_AI_INSTRUCTION_CHARS)}`,
    '',
    'Use the surrounding context only to understand meaning, style, references, numbering, and markdown structure.',
    'Do not edit or return the surrounding context.',
    'Return only the edited selected content.',
    '',
  ];

  if (beforeContext.trim()) {
    message.push(
      'Read-only context before the selection:',
      '<<<CONTEXT_BEFORE',
      beforeContext,
      '>>>',
      ''
    );
  }

  message.push(
    'Selected content:',
    '<<<SELECTION',
    selectedText,
    '>>>',
  );

  if (afterContext.trim()) {
    message.push(
      '',
      'Read-only context after the selection:',
      '<<<CONTEXT_AFTER',
      afterContext,
      '>>>'
    );
  }

  return message.join('\n');
}
