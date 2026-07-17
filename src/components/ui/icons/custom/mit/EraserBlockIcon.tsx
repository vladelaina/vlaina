/*
 * Origin: Radix Icons (eraser)
 * License: MIT
 */
import { SVGProps } from 'react';
import { themeStyleResetTokens } from '@/styles/themeTokens';

export const EraserBlockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 15 15"
    fill={themeStyleResetTokens.fillNone}
    {...props}
  >
    <path
      d="M8.36.73a.5.5 0 0 1 .71 0l5.2 5.2a.5.5 0 0 1 0 .71l-6.92 6.92a1.5 1.5 0 0 1-2.12 0L1.44 9.77a1.5 1.5 0 0 1 0-2.12L8.36.73Zm-4.25 5.67 4.49 4.49 4.61-4.6-4.5-4.5-4.6 4.61Zm-1.97 1.96a.5.5 0 0 0 0 .71l3.79 3.79a.5.5 0 0 0 .71 0l1.25-1.26L3.4 7.11 2.14 8.36Z"
      fill={themeStyleResetTokens.currentColor}
    />
  </svg>
);
