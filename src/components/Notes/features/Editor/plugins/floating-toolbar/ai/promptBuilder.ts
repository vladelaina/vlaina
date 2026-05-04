export interface EditorAiSelectionContext {
  beforeContext?: string;
  afterContext?: string;
}

export function buildEditorAiUserMessage(
  instruction: string,
  selectedText: string,
  context: EditorAiSelectionContext = {}
): string {
  const message = [
    `Instruction: ${instruction.trim()}`,
    '',
    'Use the surrounding context only to understand meaning, style, references, numbering, and markdown structure.',
    'Do not edit or return the surrounding context.',
    'Return only the edited selected content.',
    '',
  ];

  if (context.beforeContext?.trim()) {
    message.push(
      'Read-only context before the selection:',
      '<<<CONTEXT_BEFORE',
      context.beforeContext,
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

  if (context.afterContext?.trim()) {
    message.push(
      '',
      'Read-only context after the selection:',
      '<<<CONTEXT_AFTER',
      context.afterContext,
      '>>>'
    );
  }

  return message.join('\n');
}
