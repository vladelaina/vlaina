import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CollapseTriangleAffordance, CollapseTriangleIcon } from './collapseTrianglePrimitive';

describe('CollapseTriangleIcon', () => {
  it('rotates when collapsed', () => {
    const { container } = render(<CollapseTriangleIcon collapsed size={16} />);
    const svg = container.querySelector('svg');

    expect(svg?.getAttribute('class') ?? '').toContain('-rotate-90');
    expect(svg?.getAttribute('width')).toBe('16');
    expect(svg?.getAttribute('height')).toBe('16');
  });
});

describe('CollapseTriangleAffordance', () => {
  it('keeps collapsed triangles visible in hover-unless-collapsed mode', () => {
    const { container } = render(
      <CollapseTriangleAffordance collapsed visibility="hover-unless-collapsed" />
    );
    const wrapper = container.querySelector('span');

    expect(wrapper?.getAttribute('class') ?? '').toContain('opacity-100');
    expect(wrapper?.getAttribute('class') ?? '').not.toContain('group-hover:opacity-100');
  });

  it('reveals expanded triangles on hover in hover-unless-collapsed mode', () => {
    const { container } = render(
      <CollapseTriangleAffordance collapsed={false} visibility="hover-unless-collapsed" />
    );
    const wrapper = container.querySelector('span');

    expect(wrapper?.getAttribute('class') ?? '').toContain('opacity-0');
    expect(wrapper?.getAttribute('class') ?? '').toContain('group-hover:opacity-100');
  });
});
