import { SVGProps } from 'react';
import { SHOOTING_STAR_PATH, SHOOTING_STAR_VIEW_BOX } from './ShootingStarIconData';

export const ShootingStarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox={SHOOTING_STAR_VIEW_BOX} fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path
      d={SHOOTING_STAR_PATH}
      fill="currentColor"
    />
  </svg>
);
