import { AppIcon } from '@/components/common/AppIcon';
import { type ItemColor, COLOR_HEX } from '@/lib/colors';
import { type IconSize, ICON_SIZES } from '@/components/ui/icons/sizes';
import { useUIStore } from '@/stores/uiSlice';

export const resolvePixelSize = (size: number | IconSize) => {
  if (typeof size === 'string' && size in ICON_SIZES) {
    return ICON_SIZES[size as IconSize];
  }
  return size as number;
};

export function HeaderIcon({
  itemId,
  originalIcon,
  sizeVar,
  imageLoader,
  allowLegacyImageScheme = false,
}: {
  itemId: string,
  originalIcon: string | null,
  sizeVar: string,
  imageLoader?: (src: string) => Promise<string>,
  allowLegacyImageScheme?: boolean
}) {
  const universalPreviewTarget = useUIStore(s => s.universalPreviewTarget);
  const universalPreviewIcon = useUIStore(s => s.universalPreviewIcon);
  const universalPreviewColor = useUIStore(s => s.universalPreviewColor);

  const isPreviewing = universalPreviewTarget === itemId;
  const previewIcon = (isPreviewing && universalPreviewIcon) ? universalPreviewIcon : null;

  const finalIcon = previewIcon ?? originalIcon;

  let finalColorHex: string | undefined;
  if (isPreviewing && universalPreviewColor) {
    finalColorHex = COLOR_HEX[universalPreviewColor as ItemColor] || COLOR_HEX['default'];
  }

  if (!finalIcon) return null;

  return (
    <AppIcon
      icon={finalIcon}
      color={finalColorHex}
      size={sizeVar}
      imageLoader={imageLoader}
      allowLegacyImageScheme={allowLegacyImageScheme}
    />
  );
}
