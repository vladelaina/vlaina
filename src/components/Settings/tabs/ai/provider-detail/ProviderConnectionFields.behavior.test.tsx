import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProviderConnectionFields } from './ProviderConnectionFields';

function buildProps(overrides: Partial<Parameters<typeof ProviderConnectionFields>[0]> = {}) {
  const props: Parameters<typeof ProviderConnectionFields>[0] = {
    providerId: 'provider-1',
    name: 'Channel 1',
    apiHost: '',
    apiKey: 'sk-1234567890abcdef',
    showApiKey: false,
    apiKeyCopied: false,
    onNameChange: vi.fn(),
    onApiHostChange: vi.fn(),
    onApiKeyChange: vi.fn(),
    onToggleApiKey: vi.fn(),
    onCopyApiKey: vi.fn(),
    ...overrides,
  };

  return props;
}

function renderFields(overrides: Partial<Parameters<typeof ProviderConnectionFields>[0]> = {}) {
  const props = buildProps(overrides);
  render(<ProviderConnectionFields {...props} />);
  return props;
}

describe('ProviderConnectionFields API key input', () => {
  it('reveals a masked existing key when focused', () => {
    const props = renderFields();
    const input = screen.getByDisplayValue('sk-1234••••••cdef');

    fireEvent.focus(input);

    expect(props.onToggleApiKey).toHaveBeenCalledTimes(1);
  });

  it('selects the full key after revealing a focused existing key', () => {
    const props = buildProps();
    const { rerender } = render(<ProviderConnectionFields {...props} />);
    const input = screen.getByDisplayValue('sk-1234••••••cdef') as HTMLInputElement;

    fireEvent.focus(input);
    rerender(<ProviderConnectionFields {...props} showApiKey />);

    const revealedInput = screen.getByDisplayValue('sk-1234567890abcdef') as HTMLInputElement;
    expect(revealedInput.selectionStart).toBe(0);
    expect(revealedInput.selectionEnd).toBe('sk-1234567890abcdef'.length);
  });

  it('keeps an empty key editable while hidden', () => {
    const props = renderFields({ apiKey: '' });
    const input = screen.getByPlaceholderText('sk-...');

    expect(input).not.toHaveAttribute('readonly');

    fireEvent.change(input, { target: { value: 's' } });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('s');
  });

  it('keeps a newly entered hidden key editable after blur in the same detail view', () => {
    const props = buildProps({ apiKey: '' });
    const { rerender } = render(<ProviderConnectionFields {...props} />);
    const input = screen.getByPlaceholderText('sk-...');

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'sk-partial' } });
    fireEvent.blur(input);

    rerender(<ProviderConnectionFields {...props} apiKey="sk-partial" allowHiddenApiKeyEditing />);

    const updatedInput = screen.getByDisplayValue('sk-partial');
    expect(updatedInput).not.toHaveAttribute('readonly');

    fireEvent.change(updatedInput, { target: { value: 'sk-partial-more' } });
    expect(props.onApiKeyChange).toHaveBeenCalledWith('sk-partial-more');
  });
});
