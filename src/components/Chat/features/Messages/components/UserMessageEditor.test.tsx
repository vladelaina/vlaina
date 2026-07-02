import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ChatMessage } from '@/lib/ai/types';
import { UserMessageEditor } from './UserMessageEditor';

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/hooks/usePredictedTextareaHeight', () => ({
  usePredictedTextareaHeight: () => ({ syncHeight: vi.fn() }),
}));

const message: ChatMessage = {
  id: 'message-1',
  role: 'user',
  content: 'original',
  modelId: 'model-1',
  timestamp: 1,
  versions: [],
  currentVersionIndex: 0,
};

describe('UserMessageEditor', () => {
  it('does not save a composing edit from the save button', () => {
    const onEdit = vi.fn();
    render(
      <UserMessageEditor
        message={message}
        parsedContent={{ text: 'original', imageSources: [] }}
        onClose={vi.fn()}
        onEdit={onEdit}
      />,
    );

    const textarea = screen.getByRole('textbox');
    const saveButton = screen.getByText('common.send');

    fireEvent.compositionStart(textarea);
    fireEvent.change(textarea, { target: { value: 'nihon' } });
    fireEvent.click(saveButton);

    expect(onEdit).not.toHaveBeenCalled();

    fireEvent.compositionEnd(textarea);
    fireEvent.change(textarea, { target: { value: '日本' } });
    fireEvent.click(saveButton);

    expect(onEdit).toHaveBeenCalledWith('message-1', '日本');
  });
});
