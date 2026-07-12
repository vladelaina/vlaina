import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardElementNode } from './WhiteboardElementNode';

const note = {
  id: 'wb-element-1',
  type: 'note' as const,
  x: 0,
  y: 0,
  width: 220,
  height: 148,
  text: '',
};

function renderNode(overrides: Partial<ComponentProps<typeof WhiteboardElementNode>> = {}) {
  const props: ComponentProps<typeof WhiteboardElementNode> = {
    connectorSource: false,
    element: note,
    elementTextLabel: 'Note text',
    resizeLabel: 'Resize',
    selected: true,
    tool: 'select',
    onConnectorTarget: vi.fn(),
    onPointerDown: vi.fn(),
    onResizePointerDown: vi.fn(),
    onSelect: vi.fn(),
    onTextChange: vi.fn(),
    onTextEditEnd: vi.fn(),
    onTextEditStart: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<WhiteboardElementNode {...props} />) };
}

describe('WhiteboardElementNode', () => {
  it('focuses a newly selected empty note and starts a text edit session', () => {
    const { props } = renderNode();
    const textArea = screen.getByRole('textbox', { name: 'Note text' });

    expect(textArea).toHaveFocus();
    expect(props.onSelect).toHaveBeenCalledWith(note.id);
    expect(props.onTextEditStart).toHaveBeenCalledWith(note.id);
  });

  it('ends text editing with the keyboard without inserting another line', () => {
    const { props } = renderNode();
    const textArea = screen.getByRole('textbox', { name: 'Note text' });

    fireEvent.keyDown(textArea, { key: 'Enter', ctrlKey: true });

    expect(textArea).not.toHaveFocus();
    expect(props.onTextEditEnd).toHaveBeenCalledWith(note.id);
  });

  it('lets an unselected shape receive drag gestures before text editing', () => {
    renderNode({ element: { ...note, type: 'rect' }, selected: false });

    expect(screen.getByRole('textbox', { name: 'Note text' })).toHaveClass('pointer-events-none');
  });
});
