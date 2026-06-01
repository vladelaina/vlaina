/*
 * Origin: Phosphor Icons
 * License: MIT
 */
import { SVGProps } from 'react';
import { themeStyleResetTokens } from '@/styles/themeTokens';
import { SHOOTING_STAR_PATH, SHOOTING_STAR_VIEW_BOX } from './ShootingStarIconData';

export const ShootingStarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox={SHOOTING_STAR_VIEW_BOX} fill={themeStyleResetTokens.fillNone} xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d={SHOOTING_STAR_PATH}
      fill={themeStyleResetTokens.currentColor}
    />
  </svg>
);
