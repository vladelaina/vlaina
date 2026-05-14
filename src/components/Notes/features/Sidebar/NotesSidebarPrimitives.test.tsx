import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotesSidebarSection } from './NotesSidebarPrimitives';

describe('NotesSidebarPrimitives', () => {
  it('does not clip expanded section content', () => {
    const { container } = render(
      <NotesSidebarSection title="Files" expanded>
        <div>Long file names can wrap beyond two lines.</div>
      </NotesSidebarSection>,
    );

    expect(container.innerHTML).toContain('grid-rows-[1fr]');
    expect(container.innerHTML).toContain('overflow-visible');
  });

  it('clips collapsed section content', () => {
    const { container } = render(
      <NotesSidebarSection title="Files" expanded={false}>
        <div>Hidden files</div>
      </NotesSidebarSection>,
    );

    expect(container.innerHTML).toContain('grid-rows-[0fr]');
    expect(container.innerHTML).toContain('overflow-hidden');
  });
});
