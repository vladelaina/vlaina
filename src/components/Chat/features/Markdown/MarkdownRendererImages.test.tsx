import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: (props: React.ImgHTMLAttributes<HTMLImageElement> & { alt?: string; src: string }) => (
    <img data-testid="local-image" {...props} alt={props.alt || 'image'} />
  ),
}));

vi.mock('./components/ChatImageViewer', () => ({
  ChatImageViewer: () => null,
}));

import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer images', () => {
  it('renders generated base64 image markdown as an image', () => {
    render(<MarkdownRenderer content="![Generated image](<data:image/png;base64,abc123>)" />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', 'data:image/png;base64,abc123');
    expect(screen.queryByText('[Image unavailable]')).not.toBeInTheDocument();
  });

  it('still renders legacy unwrapped base64 image markdown', () => {
    render(<MarkdownRenderer content="![Generated image](data:image/png;base64,abc123)" />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', 'data:image/png;base64,abc123');
  });

  it('renders Notes inline color and underline markdown through the shared pipeline', () => {
    render(
      <MarkdownRenderer
        content={'++under++ <span style="color: #123456">text</span> <mark style="background-color: var(--note-color)">bg</mark>'}
      />
    );

    expect(screen.getByText('under').tagName.toLowerCase()).toBe('u');
    expect(screen.getByText('text')).toHaveAttribute('data-text-color', '#123456');
    expect(screen.getByText('text')).toHaveStyle({ color: '#123456' });
    expect(screen.getByText('bg').tagName.toLowerCase()).toBe('mark');
    expect(screen.getByText('bg')).toHaveAttribute('data-bg-color', 'var(--note-color)');
    expect(screen.getByText('bg')).toHaveStyle({ backgroundColor: 'var(--note-color)' });
  });

  it('drops unsafe declarations from raw color styles instead of reusing arbitrary style payloads', () => {
    render(<MarkdownRenderer content={'<span style="color: red; background-image: url(https://example.com/x.png)">bad</span>'} />);

    expect(screen.getByText('bad').getAttribute('style')).toContain('color: red');
    expect(screen.getByText('bad').getAttribute('style')).not.toContain('background-image');
  });

  it('reuses Notes image width, alignment, and crop attributes safely', () => {
    render(
      <MarkdownRenderer
        content={'<img src="https://example.com/a.png" alt="diagram" width="66%" align="right" data-vlaina-crop="1,2,80,90,1.5" />'}
      />
    );

    expect(screen.getByTestId('local-image')).toHaveStyle({ width: '66%' });
    expect(screen.getByTestId('local-image')).toHaveAttribute('data-vlaina-crop', '1.000000,2.000000,80.000000,90.000000,1.500000');
    expect(screen.getByTestId('local-image').parentElement?.parentElement).toHaveClass('justify-end');
  });

  it('reuses Notes block alignment comments for read-only markdown', () => {
    render(<MarkdownRenderer content={'Aligned paragraph\n\n<!--align:center-->'} />);

    expect(screen.getByText('Aligned paragraph')).toHaveAttribute('data-text-align', 'center');
    expect(screen.getByText('Aligned paragraph')).toHaveStyle({ textAlign: 'center' });
  });

  it('reuses Notes abbreviation definitions for read-only markdown', () => {
    render(<MarkdownRenderer content={'*[HTML]: Hyper Text Markup Language\n\nHTML works.'} />);

    expect(screen.getByText('HTML')).toHaveAttribute('title', 'Hyper Text Markup Language');
    expect(screen.getByText('HTML').tagName.toLowerCase()).toBe('abbr');
  });

  it('reuses Notes TOC shortcuts for read-only markdown', () => {
    render(<MarkdownRenderer content={'[TOC]\n\n## Alpha\n\n### Beta'} />);

    const alphaLink = screen.getByText('Alpha', { selector: 'a' });
    const alphaHeading = screen.getByText('Alpha', { selector: 'h2' });
    expect(alphaLink).toHaveAttribute('href', `#${alphaHeading.id}`);
    expect(screen.getByText('Beta', { selector: 'a' })).toHaveClass('toc-link');
    expect(alphaHeading).toHaveAttribute('id');
  });

  it('reuses Notes pseudo definition list rendering for read-only markdown', () => {
    render(<MarkdownRenderer content={'Term\n: Definition'} />);

    expect(screen.getByText('Term').tagName.toLowerCase()).toBe('dt');
    expect(screen.getByText('Definition').closest('dd')).toHaveClass('definition-desc');
  });
});
