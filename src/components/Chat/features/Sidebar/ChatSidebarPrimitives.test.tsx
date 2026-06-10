import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatSidebarRow } from './ChatSidebarPrimitives';

describe('ChatSidebarPrimitives', () => {
  it('keeps inactive action fades transparent until the row is hovered', () => {
    render(
      <ChatSidebarRow
        main={<span>Alpha chat</span>}
        actions={<button type="button">More</button>}
      />,
    );

    const fade = screen.getByRole('button', { name: 'More' }).parentElement?.firstElementChild;

    expect(fade).toHaveClass('from-transparent');
    expect(fade).toHaveClass('group-hover/sidebar-row:from-[var(--vlaina-sidebar-chat-row-hover)]');
    expect(fade?.className).not.toContain('from-[var(--vlaina-sidebar-chat-fade)]');
  });
});
