import { memo } from 'react';
import { AppIcon } from '@/components/common/AppIcon';
import { themeIconTokens } from '@/styles/themeTokens';

const GRID_ICON_SIZE = themeIconTokens.sizeMd;

interface IconRowProps {
  icons: string[];
  imageLoader?: (src: string) => Promise<string>;
  allowLegacyImageScheme?: boolean;
}

export const IconRow = memo(
  function IconRow({ icons, imageLoader, allowLegacyImageScheme = false }: IconRowProps) {
    return (
      <div className="px-2 grid grid-cols-9 gap-0.5">
        {icons.map((icon, i) => (
          <button
            key={i}
            data-icon={icon}
            className="w-full aspect-square flex items-center justify-center rounded-md text-xl hover:bg-[var(--vlaina-bg-hover)]"
          >
            <AppIcon
              icon={icon}
              size={GRID_ICON_SIZE}
              imageLoader={imageLoader}
              allowLegacyImageScheme={allowLegacyImageScheme}
            />
          </button>
        ))}
      </div>
    );
  },
  (prev, next) => {
    if (prev.imageLoader !== next.imageLoader) return false;
    if (prev.allowLegacyImageScheme !== next.allowLegacyImageScheme) return false;
    if (prev.icons.length !== next.icons.length) return false;
    for (let i = 0; i < prev.icons.length; i++) {
      if (prev.icons[i] !== next.icons[i]) return false;
    }
    return true;
  }
);
