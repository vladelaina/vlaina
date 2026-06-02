import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';

vi.mock('@/components/Chat/common/LocalImage', () => ({
  LocalImage: ({ onResolvedSrc: _onResolvedSrc, ...props }: React.ImgHTMLAttributes<HTMLImageElement> & {
    alt?: string;
    onResolvedSrc?: (src: string | null) => void;
    src: string;
  }) => (
    <img data-testid="local-image" {...props} alt={props.alt || 'image'} />
  ),
}));

vi.mock('./components/ChatImageViewer', () => ({
  ChatImageViewer: () => null,
}));

import MarkdownRenderer from './MarkdownRenderer';

describe('MarkdownRenderer images', () => {
  it('removes KaTeX source annotations from read-only markdown output', () => {
    const { container } = render(<MarkdownRenderer content={'Before $x% hidden_secret_marker$ after'} />);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.innerHTML).not.toContain('application/x-tex');
    expect(container.innerHTML).not.toContain('hidden_secret_marker');
  });

  it('uses the shared KaTeX macros in read-only markdown output', () => {
    const { container } = render(<MarkdownRenderer content={'$\\R$'} />);

    expect(container.querySelector('.katex')).toBeInTheDocument();
    expect(container.innerHTML).toContain('mathbb');
  });


  it('renders generated base64 image markdown as an image', () => {
    render(<MarkdownRenderer content="![Generated image](<data:image/png;base64,abc123>)" />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', 'data:image/png;base64,abc123');
    expect(screen.queryByText('[Image unavailable]')).not.toBeInTheDocument();
  });

  it('compacts large inline base64 image markdown before rendering', () => {
    const src = `data:image/png;base64,${'a'.repeat(60_000)}`;

    render(<MarkdownRenderer content={`![Generated image](<${src}>)`} />);

    expect(screen.getByTestId('local-image')).toHaveAttribute('src', src);
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

  it('preserves escaped Notes inline mark delimiters as literal text', () => {
    render(<MarkdownRenderer content={'\\==mark== \\++under++ X\\^2^ H\\~2~O'} />);

    expect(screen.getByText('==mark== ++under++ X^2^ H~2~O')).toBeInTheDocument();
    expect(screen.queryByText('mark')).not.toBeInTheDocument();
    expect(screen.queryByText('under')).not.toBeInTheDocument();
  });

  it('drops unsafe declarations from raw color styles instead of reusing arbitrary style payloads', () => {
    render(<MarkdownRenderer content={'<span style="color: red; background-image: url(https://example.com/x.png)">bad</span>'} />);

    expect(screen.getByText('bad').getAttribute('style')).toContain('color: red');
    expect(screen.getByText('bad').getAttribute('style')).not.toContain('background-image');
  });

  it('keeps safe raw style declarations with CSS whitespace around the colon', () => {
    render(<MarkdownRenderer content={'<span style="color : #123456"><em>nested</em></span>'} />);

    expect(screen.getByText('nested').closest('span')).toHaveStyle({ color: '#123456' });
  });

  it('sanitizes raw picture srcset candidates before rendering', () => {
    const { container } = render(
      <MarkdownRenderer
        content={[
          '<picture>',
          '<source srcset="//127.0.0.1:3000/secret.png 1x, https://example.com/a.webp 2x">',
          '<img src="https://example.com/fallback.png" alt="fallback">',
          '</picture>',
          '<picture>',
          '<source srcset="images/safe.webp 1x, https://example.com/safe@2x.webp 2x">',
          '<img src="https://example.com/safe.png" alt="safe">',
          '</picture>',
        ].join('')}
      />
    );

    const sources = Array.from(container.querySelectorAll('source'));
    expect(sources[0]).not.toHaveAttribute('srcset');
    expect(sources[1]).toHaveAttribute('srcset', 'images/safe.webp 1x, https://example.com/safe@2x.webp 2x');
    expect(container.innerHTML).not.toContain('127.0.0.1');
  });

  it('strips arbitrary raw div data attributes from read-only markdown', () => {
    const { container } = render(
      <MarkdownRenderer content={'<div data-token="hidden_secret_marker" data-track="1">safe div</div>'} />
    );

    const div = screen.getByText('safe div');
    expect(div.tagName.toLowerCase()).toBe('div');
    expect(div).not.toHaveAttribute('data-token');
    expect(div).not.toHaveAttribute('data-track');
    expect(container.innerHTML).not.toContain('hidden_secret_marker');
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
    expect(screen.queryByText(/\*\[HTML\]/)).not.toBeInTheDocument();
  });

  it('preserves escaped Notes block shortcut markdown as literal text', () => {
    const { container } = render(
      <MarkdownRenderer
        content={'\\*[HTML]: Hyper Text Markup Language\n\nHTML works.\n\n\\[TOC]\n\nTerm\n\\: Definition'}
      />
    );

    expect(container).toHaveTextContent('*[HTML]: Hyper Text Markup Language');
    expect(container).toHaveTextContent('HTML works.');
    expect(container).toHaveTextContent('[TOC]');
    expect(container).toHaveTextContent('Term');
    expect(container).toHaveTextContent(': Definition');
    expect(screen.queryByText('HTML')?.tagName.toLowerCase()).not.toBe('abbr');
    expect(screen.queryByText('TOC', { selector: 'a' })).not.toBeInTheDocument();
    expect(container.querySelector('dl')).not.toBeInTheDocument();
  });

  it('reuses Notes TOC shortcuts for read-only markdown', () => {
    const { container } = render(<MarkdownRenderer content={'[TOC]\n\n## Alpha\n\n### Beta'} />);

    const alphaLink = screen.getByText('Alpha', { selector: 'a' });
    const alphaHeading = screen.getByText('Alpha', { selector: 'h2' });
    expect(alphaLink).toHaveAttribute('href', `#${alphaHeading.id}`);
    expect(screen.getByText('Beta', { selector: 'a' })).toHaveClass('toc-link');
    expect(alphaHeading).toHaveAttribute('id');
    expect(container.querySelector('.toc-block')).toHaveAttribute('data-type', 'toc');
  });

  it('reuses Notes callout blockquotes for read-only markdown', () => {
    const { container } = render(<MarkdownRenderer content={'> 💡 Tip body'} />);

    expect(container.querySelector('.callout')).toHaveAttribute('data-type', 'callout');
    expect(container.querySelector('.callout-icon')).toHaveTextContent('💡');
    expect(screen.getByText('Tip body')).toBeInTheDocument();
  });

  it('keeps ordinary read-only blockquotes from being parsed as callouts', () => {
    const { container } = render(
      <MarkdownRenderer content={'> 1. Keep this quoted\n\n> Note: also quoted\n\n> © Copyright\n\n> ™ Trademark'} />
    );

    expect(container.querySelector('.callout')).not.toBeInTheDocument();
    expect(container.querySelector('blockquote')).toBeInTheDocument();
    expect(container).toHaveTextContent('Keep this quoted');
    expect(container).toHaveTextContent('Note: also quoted');
    expect(container).toHaveTextContent('© Copyright');
    expect(container).toHaveTextContent('™ Trademark');
  });

  it('reuses Notes pseudo definition list rendering for read-only markdown', () => {
    render(<MarkdownRenderer content={'Term\n: Definition'} />);

    expect(screen.getByText('Term').tagName.toLowerCase()).toBe('dt');
    expect(screen.getByText('Definition').closest('dd')).toHaveClass('definition-desc');
  });
});
