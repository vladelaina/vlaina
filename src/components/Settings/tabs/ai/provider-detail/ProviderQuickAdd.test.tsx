import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderQuickAdd } from './ProviderQuickAdd';

vi.mock('@/components/ui/icons', () => ({
  Icon: ({ name }: { name: string }) => <span aria-hidden="true" data-testid={`icon-${name}`} />,
}));

vi.mock('@/lib/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe('ProviderQuickAdd', () => {
  it('does not submit a model id while IME composition is active', () => {
    const onAddAllVisible = vi.fn();
    const onValueChange = vi.fn();

    render(
      <ProviderQuickAdd
        value="nihon"
        error=""
        sortedFetchedModels={[]}
        providerModelIdSet={new Set()}
        onValueChange={onValueChange}
        onAddAllVisible={onAddAllVisible}
        onSetError={vi.fn()}
      />,
    );

    const input = screen.getByDisplayValue('nihon');
    const addButton = screen.getByRole('button', { name: 'settings.ai.addModels' });

    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.click(addButton);

    expect(onAddAllVisible).not.toHaveBeenCalled();
  });
});
