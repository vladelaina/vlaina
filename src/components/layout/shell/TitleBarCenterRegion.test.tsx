import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TitleBarCenterRegion, TitleBarInteractiveRegion } from './TitleBarCenterRegion';

describe('TitleBarCenterRegion', () => {
  it('keeps only the content-sized interactive region non-draggable', () => {
    const { getByTestId } = render(
      <TitleBarCenterRegion data-testid="center">
        <TitleBarInteractiveRegion data-testid="interactive" />
      </TitleBarCenterRegion>,
    );

    expect(getByTestId('center')).toHaveClass('w-full');
    expect(getByTestId('center')).not.toHaveClass('app-no-drag');
    expect(getByTestId('interactive')).toHaveClass('app-no-drag', 'w-fit', 'max-w-full');
    expect(getByTestId('interactive')).not.toHaveClass('w-full');
  });
});
