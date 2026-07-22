import { render } from '@testing-library/react';
import ReactMarkdown from 'react-markdown';
import { describe, expect, it } from 'vitest';
import { READONLY_MARKDOWN_REHYPE_PLUGINS } from '@/components/common/markdown/markdownPipeline';
import {
  prepareSplitPreviewMarkdown,
  SPLIT_PREVIEW_REMARK_PLUGINS,
} from './NotesSplitPreviewMarkdown';

describe('Notes split preview math', () => {
  it('renders supported math syntax through the shared notes pipeline', () => {
    const markdown = prepareSplitPreviewMarkdown([
      'Inline \\(x+y\\).',
      '',
      '\\[',
      '\\ce{H2O}',
      '\\]',
      '',
      '$$x^2$$',
      '',
      '```math',
      '\\frac{1}{2}',
      '```',
      '',
      '```latex',
      '\\documentclass{article}',
      '```',
    ].join('\n'));
    const { container } = render(
      <ReactMarkdown
        remarkPlugins={SPLIT_PREVIEW_REMARK_PLUGINS}
        rehypePlugins={READONLY_MARKDOWN_REHYPE_PLUGINS}
      >
        {markdown}
      </ReactMarkdown>,
    );

    expect(container.querySelectorAll('.katex')).toHaveLength(4);
    expect(container.querySelector('.math-error')).toBeNull();
    expect(container.querySelector('code.language-latex')?.textContent).toContain('\\documentclass');
    expect(container.querySelector('code.language-math')).toBeNull();
  });
});
