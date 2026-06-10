import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PremiumSlider } from './premium-slider';

describe('PremiumSlider', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('keeps the local final track gradient in sync with the slider percentage', () => {
    render(<PremiumSlider min={0} max={100} value={25} onChange={vi.fn()} />);

    const sliderRoot = document.querySelector<HTMLElement>('.premium-slider');
    expect(sliderRoot).not.toBeNull();
    expect(sliderRoot!.style.getPropertyValue('--vlaina-slider-percentage')).toBe('25%');
    expect(sliderRoot!.style.getPropertyValue('--vlaina-gradient-premium-slider-track')).toContain('25%');

    fireEvent.input(screen.getByRole('slider'), { target: { value: '75' } });

    expect(sliderRoot!.style.getPropertyValue('--vlaina-slider-percentage')).toBe('75%');
    expect(sliderRoot!.style.getPropertyValue('--vlaina-gradient-premium-slider-track')).toContain('75%');
  });
});
