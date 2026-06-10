import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readAiReviewThemeStyles() {
  return readFileSync(
    resolve(process.cwd(), 'src/components/Notes/features/Editor/styles/floating-toolbar.ai-review.theme.css'),
    'utf8'
  );
}

describe('floating toolbar responsive styles', () => {
  it('keeps the mobile AI review panel width tied to the local review width variable', () => {
    const css = readAiReviewThemeStyles();

    expect(css).toContain(
      'width: min(var(--vlaina-toolbar-ai-review-width, calc(100vw - var(--vlaina-size-24px))), calc(100vw - var(--vlaina-size-24px)));'
    );
    expect(css).toContain(
      'max-width: min(var(--vlaina-toolbar-ai-review-width, calc(100vw - var(--vlaina-size-24px))), calc(100vw - var(--vlaina-size-24px)));'
    );
    expect(css).not.toContain('width: var(--vlaina-width-toolbar-ai-panel-mobile);');
  });
});
