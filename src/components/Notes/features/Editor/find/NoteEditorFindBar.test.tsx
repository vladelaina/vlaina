import React, { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteEditorFindController } from './types';
import { NoteEditorFindBar } from './NoteEditorFindBar';

vi.mock('framer-motion', async () => {
  const React = await import('react');

  const MotionDiv = React.forwardRef(function MotionDiv(props: any, ref: React.ForwardedRef<HTMLDivElement>) {
    const { children, ...rest } = props;
    return React.createElement('div', { ...rest, ref }, children);
  });

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    motion: {
      div: MotionDiv,
    },
  };
});

function createController(
  overrides: Partial<NoteEditorFindController> = {},
): NoteEditorFindController {
  return {
    isOpen: true,
    isReplaceOpen: false,
    query: 'find',
    replaceValue: '',
    activeMatchNumber: 1,
    totalMatches: 1,
    canNavigate: true,
    canReplace: true,
    inputRef: createRef<HTMLInputElement>(),
    replaceInputRef: createRef<HTMLInputElement>(),
    setQuery: vi.fn(),
    setReplaceValue: vi.fn(),
    open: vi.fn(),
    close: vi.fn(),
    goToPrevious: vi.fn(),
    goToNext: vi.fn(),
    toggleReplace: vi.fn(),
    replaceCurrent: vi.fn(),
    replaceAll: vi.fn(),
    handleQueryKeyDown: vi.fn(),
    handleReplaceKeyDown: vi.fn(),
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('NoteEditorFindBar', () => {
  it('closes when clicking outside the find bar', () => {
    const controller = createController();

    render(
      <div>
        <NoteEditorFindBar controller={controller} />
        <button type="button" data-testid="outside">
          Outside
        </button>
      </div>,
    );

    fireEvent.mouseDown(screen.getByTestId('outside'));

    expect(controller.close).toHaveBeenCalledWith(false);
  });

  it('stays open when clicking inside the find bar', () => {
    const controller = createController();

    render(<NoteEditorFindBar controller={controller} />);

    fireEvent.mouseDown(screen.getByPlaceholderText('Find'));

    expect(controller.close).not.toHaveBeenCalled();
  });
});
