import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AiToolbarModelSelector } from './AiToolbarModelSelector';

const mocks = vi.hoisted(() => ({
  modelSelector: vi.fn(),
}));

vi.mock('@/components/Chat/features/Input/ModelSelector', () => ({
  ModelSelector: (props: Record<string, unknown>) => {
    mocks.modelSelector(props);
    return <div data-testid="model-selector" />;
  },
}));

describe('AiToolbarModelSelector', () => {
  it('renders the model dropdown as an embedded high-layer popup above the notes shell', () => {
    const onSelectModel = vi.fn();

    render(<AiToolbarModelSelector onSelectModel={onSelectModel} />);

    expect(mocks.modelSelector).toHaveBeenCalledWith(expect.objectContaining({
      dropdownLayerClassName: 'z-[var(--vlaina-z-120)]',
      dropdownPlacement: 'top',
      focusSearchOnOpen: false,
      isEmbedded: true,
      onSelectModel,
      restoreComposerFocusOnClose: false,
      theme: 'notes',
    }));
  });
});
