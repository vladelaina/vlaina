/*
 * Source: Eva Icons
 * Repository: https://github.com/akveo/eva-icons
 * Icon: activity
 * License: MIT
 */
import { SVGProps } from 'react';
import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

export const ActivityIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox={themeIconTokens.viewBoxDefault} fill={themeStyleResetTokens.fillNone} xmlns="http://www.w3.org/2000/svg" {...props}>
    <g fill={themeStyleResetTokens.currentColor}>
      <path d="M14.33 20h-.21a2 2 0 0 1-1.76-1.58L9.68 6l-2.76 6.4A1 1 0 0 1 6 13H3a1 1 0 0 1 0-2h2.34l2.51-5.79a2 2 0 0 1 3.79.38L14.32 18l2.76-6.38A1 1 0 0 1 18 11h3a1 1 0 0 1 0 2h-2.34l-2.51 5.79A2 2 0 0 1 14.33 20z" />
    </g>
  </svg>
);
