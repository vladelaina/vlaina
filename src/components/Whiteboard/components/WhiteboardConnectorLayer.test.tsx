import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { WhiteboardConnectorLayer } from './WhiteboardConnectorLayer';
import type { WhiteboardElement } from '../model/whiteboardModel';

const elements: WhiteboardElement[] = [
  { height: 100, id: 'from', text: '', type: 'rect', width: 160, x: 0, y: 0 },
  { height: 100, id: 'to', text: '', type: 'rect', width: 160, x: 300, y: 0 },
];

describe('WhiteboardConnectorLayer', () => {
  it('provides a wide selectable target and renders the selected state', () => {
    const onSelectConnector = vi.fn();
    const { container } = render(
      <WhiteboardConnectorLayer
        connectors={[{ fromId: 'from', id: 'connector-1', toId: 'to' }]}
        elements={elements}
        interactive
        movePreview={null}
        selectedConnectorIds={['connector-1']}
        selectedElementIds={[]}
        visibleRect={null}
        onSelectConnector={onSelectConnector}
      />,
    );

    const connector = container.querySelector('[data-whiteboard-connector="connector-1"]');
    const lines = connector?.querySelectorAll('line');
    expect(lines?.[0]).toHaveAttribute('stroke', 'var(--vlaina-color-whiteboard-selected)');
    expect(lines?.[1]).toHaveAttribute('pointer-events', 'stroke');

    fireEvent.pointerDown(lines?.[1] as SVGLineElement, { button: 0, shiftKey: true });
    expect(onSelectConnector).toHaveBeenCalledWith('connector-1', true);
  });
});
