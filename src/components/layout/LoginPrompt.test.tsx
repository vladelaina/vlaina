import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function readLoginPromptSource(): string {
  return readFileSync(resolve(process.cwd(), 'src/components/layout/LoginPrompt.tsx'), 'utf8');
}

describe('LoginPrompt', () => {
  it('keeps the signed-out header login button from using blue sidebar hover text', () => {
    const source = readLoginPromptSource();

    expect(source).toContain('hover:!text-[var(--vlaina-color-brand-pink)]');
    expect(source).toContain('hover:!bg-transparent');
    expect(source).not.toContain('ヾ(๑╹ヮ╹๑)ﾉ {signInLabel}');
    expect(source).not.toContain('getSidebarIdleRowSurfaceClass');
    expect(source).not.toContain('hover:text-[var(--vlaina-sidebar-row-selected-text)]');
  });
});
