import { ICON_SIZES } from './sizes';
import { renderShootingStarSvgMarkup } from './custom/mit/ShootingStarIconData';

const EDITOR_ICON_SIZE = ICON_SIZES.md;

export const EDITOR_ICONS = {
  bold: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
    <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
    <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"></path>
  </svg>`,
  italic: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="19" y1="4" x2="10" y2="4"></line>
    <line x1="14" y1="20" x2="5" y2="20"></line>
    <line x1="15" y1="4" x2="9" y2="20"></line>
  </svg>`,
  underline: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"></path>
    <line x1="4" y1="21" x2="20" y2="21"></line>
  </svg>`,
  strike: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M17.3 4.9c-2.3-.6-4.4-1-6.2-.9-2.7 0-5.3.7-5.3 3.6 0 1.5 1.8 3.3 3.6 3.9h.2m8.2 3.7c.3.4.4.8.4 1.3 0 2.9-2.7 3.6-6.2 3.6-2.3 0-4.4-.3-6.2-.9M4 11.5h16"></path>
  </svg>`,
  code: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="16 18 22 12 16 6"></polyline>
    <polyline points="8 6 2 12 8 18"></polyline>
  </svg>`,
  highlight: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="m9 11-6 6v3h9l3-3"></path>
    <path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"></path>
  </svg>`,
  link: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
  </svg>`,
  color: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="m4 21 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2m3.8 5.7 1.9-5.7m0 0 3.1-9.3 3.1 9.3m-6.2 0h6.2"></path>
  </svg>`,
  text: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
  </svg>`,
  shootingStar: renderShootingStarSvgMarkup(EDITOR_ICON_SIZE),
  chevronDown: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>`,
  alignLeft: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="4" y1="12" x2="14" y2="12"></line>
    <line x1="4" y1="18" x2="18" y2="18"></line>
  </svg>`,
  align: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="4" y1="12" x2="20" y2="12"></line>
    <line x1="4" y1="18" x2="20" y2="18"></line>
  </svg>`,
  alignCenter: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="7" y1="12" x2="17" y2="12"></line>
    <line x1="5" y1="18" x2="19" y2="18"></line>
  </svg>`,
  alignRight: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <line x1="4" y1="6" x2="20" y2="6"></line>
    <line x1="10" y1="12" x2="20" y2="12"></line>
    <line x1="6" y1="18" x2="20" y2="18"></line>
  </svg>`,
  copy: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <rect x="9" y="9" width="11" height="11" rx="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>`,
  quote: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M10 13H6.5a1.5 1.5 0 0 1-1.5-1.5V9a4 4 0 0 1 4-4"></path>
    <path d="M19 13h-3.5a1.5 1.5 0 0 1-1.5-1.5V9a4 4 0 0 1 4-4"></path>
  </svg>`,
  trash: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M3 6h18"></path>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
    <line x1="10" y1="11" x2="10" y2="17"></line>
    <line x1="14" y1="11" x2="14" y2="17"></line>
  </svg>`,
  reviewRetry: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M244,56v48a12,12,0,0,1-12,12H184a12,12,0,1,1,0-24H201.1l-19-17.38c-.13-.12-.26-.24-.38-.37A76,76,0,1,0,127,204h1a75.53,75.53,0,0,0,52.15-20.72,12,12,0,0,1,16.49,17.45A99.45,99.45,0,0,1,128,228h-1.37A100,100,0,1,1,198.51,57.06L220,76.72V56a12,12,0,0,1,24,0Z"></path>
  </svg>`,
  reviewApply: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z"></path>
  </svg>`,
  reviewClose: `<svg width="${EDITOR_ICON_SIZE}" height="${EDITOR_ICON_SIZE}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z"></path>
  </svg>`,
} as const;
