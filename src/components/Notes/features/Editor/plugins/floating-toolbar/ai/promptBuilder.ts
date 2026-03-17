export function buildEditorAiUserMessage(instruction: string, selectedText: string): string {
  return [
    `Instruction: ${instruction.trim()}`,
    '',
    'Selected content:',
    '<<<SELECTION',
    selectedText,
    '>>>',
  ].join('\n');
}
