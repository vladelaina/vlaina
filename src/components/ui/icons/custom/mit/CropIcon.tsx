/*
 * Origin: Lucide Icons (crop)
 * License: ISC
 */
import { SVGProps } from 'react';
import { themeIconTokens, themeStyleResetTokens } from '@/styles/themeTokens';

export const CropIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={themeIconTokens.viewBoxDefault}
    fill={themeStyleResetTokens.fillNone}
    stroke={themeStyleResetTokens.currentColor}
    strokeWidth={themeIconTokens.strokeDefault}
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
    <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
  </svg>
);
