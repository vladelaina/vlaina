import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { AppIcon } from '@/components/common/AppIcon';
import { type CustomIcon } from '@/lib/storage/unifiedStorage';
import { useUIStore } from '@/stores/uiSlice';
import { getRandomHeaderEmoji, preloadRandomEmojiData } from '@/components/common/UniversalIconPicker/randomEmoji';
import { type ItemColor, COLOR_HEX } from '@/lib/colors';
import { ICON_SIZES, IconSize } from '@/components/ui/icons/sizes';

const IconPicker = lazy(async () => {
  const mod = await import('@/components/common/UniversalIconPicker/index');
  return { default: mod.UniversalIconPicker };
});

interface HeroIconHeaderProps {
  id: string;
  icon: string | null;
  onIconChange: (icon: string | null) => void;
  onColorChange?: (color: ItemColor) => void;
  initialColor?: ItemColor;
  
  title?: string;
  renderTitle?: () => React.ReactNode;

  iconSize?: number | IconSize;
  minIconSize?: number;
  maxIconSize?: number;
  sliderValue?: number;
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;

  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void;
  imageLoader?: (src: string) => Promise<string>;
  onRequestRandomIcon?: () => string | null;

  className?: string;
  coverUrl?: string | null;
  children?: React.ReactNode;
  compact?: boolean;
}

const resolvePixelSize = (size: number | IconSize) => {
  if (typeof size === 'string' && size in ICON_SIZES) {
    return ICON_SIZES[size as IconSize];
  }
  return size as number;
};

function HeaderIcon({ 
  itemId, 
  originalIcon, 
  sizeVar,
  imageLoader
}: { 
  itemId: string, 
  originalIcon: string | null, 
  sizeVar: string,
  imageLoader?: (src: string) => Promise<string>
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
        />
    );
}

export function HeroIconHeader({
  id,
  icon,
  onIconChange,
  iconSize = 60,
  minIconSize,
  maxIconSize,
  sliderValue,
  onSizeChange,
  onSizeConfirm,
  title,
  renderTitle,
  customIcons,
  onUploadFile,
  onDeleteCustomIcon,
  imageLoader,
  onRequestRandomIcon,
  className,
  coverUrl,
  children,
  compact = false,
}: HeroIconHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);

  const resolvedIconSize = resolvePixelSize(iconSize);

  const { handlePreview, handlePreviewTone } = useIconPreview(id);
  
  const universalPreviewTarget = useUIStore(s => s.universalPreviewTarget);
  const universalPreviewIconSize = useUIStore(s => s.universalPreviewIconSize);
  const isPreviewing = universalPreviewTarget === id;
  const effectiveSize = (!compact && isPreviewing && universalPreviewIconSize !== null) 
    ? universalPreviewIconSize 
    : resolvedIconSize;

  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.style.setProperty('--header-icon-size', `${effectiveSize}px`);
    }
  }, [effectiveSize]);

  useEffect(() => {
    void preloadRandomEmojiData();
  }, []);

  const handleIconSelect = useCallback((newIcon: string) => {
    onIconChange(newIcon);
  }, [onIconChange]);

  const handleRemoveIcon = useCallback(() => {
    onIconChange(null);
  }, [onIconChange]);

  const handlePickerClose = useCallback(() => {
    setShowIconPicker(false);
    setIsHoveringHeader(false);
    handlePreview(null);
  }, [handlePreview]);

  const handleLocalSizeChange = useCallback((newSize: number) => {
    if (sliderValue === undefined && headerRef.current) {
      headerRef.current.style.transition = 'none';
      headerRef.current.style.setProperty('--header-icon-size', `${newSize}px`);
    }
    onSizeChange?.(newSize);
  }, [onSizeChange, sliderValue]);

  const handleLocalSizeConfirm = useCallback((newSize: number) => {
    if (sliderValue === undefined && headerRef.current) {
      headerRef.current.style.transition = '';
    }
    onSizeConfirm?.(newSize);
  }, [onSizeConfirm, sliderValue]);

  const currentSliderValue = sliderValue !== undefined ? sliderValue : resolvedIconSize;
  return (
    <div
      ref={headerRef}
      className={cn(
        "relative transition-[margin-top] duration-75 ease-out w-full",
        !compact && "max-w-3xl mx-auto px-10",
        !compact && coverUrl && "pointer-events-none",
        className
      )}
      style={{
        '--header-icon-size': `${resolvedIconSize}px`,
        marginTop: coverUrl ? `calc(var(--header-icon-size) * -0.618)` : undefined,
      } as React.CSSProperties}
    >
      {children}
      
      <div className={cn(compact ? "flex items-center gap-3 py-2" : "pointer-events-none")}>
        <div
          className={cn(
              "duration-150 relative",
              "transition-[padding,opacity]",
              !compact && "w-fit",
              !compact && "z-30",
              !compact && "pointer-events-auto",
              !compact && "pb-2",
              !compact && (coverUrl ? "pt-0" : "pt-10")
          )}
          onMouseEnter={() => setIsHoveringHeader(true)}
          onMouseLeave={() => setIsHoveringHeader(false)}
        >
          {icon || showIconPicker ? (
              <div
                  className="relative flex items-center"
                  style={{ height: 'var(--header-icon-size)' }}
              >
                  <button
                      ref={iconButtonRef}
                      onClick={() => {
                        setShowIconPicker(true);
                      }}
                      className="hover:scale-105 transition-transform cursor-pointer flex items-center group"
                      style={{
                          marginLeft: !compact ? `calc(var(--header-icon-size) * -0.1)` : 0
                      }}
                  >
                      <HeaderIcon 
                          key={icon || 'empty'}
                          itemId={id} 
                          originalIcon={icon}
                          sizeVar="var(--header-icon-size)" 
                          imageLoader={imageLoader}
                      />
                  </button>
              </div>
          ) : (
              <div className={cn(
                  "flex items-center gap-2 transition-all duration-150",
                  compact ? "h-8" : "h-14",
                  isHoveringHeader ? "opacity-100" : (compact ? "opacity-50" : "opacity-0")
              )}>
                  <button
                      ref={iconButtonRef}
                      onClick={() => {
                          const randomIcon = onRequestRandomIcon?.() ?? getRandomHeaderEmoji();
                          if (!randomIcon) {
                            return;
                          }
                          onIconChange(randomIcon);
                          setShowIconPicker(true);
                      }}
                      className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm text-[var(--vlaina-text-secondary)] hover:text-[var(--vlaina-text-primary)] transition-colors")}
                  >
                      <Icon size="md" name="misc.activity" />
                      {!compact && <span>Add icon</span>}
                  </button>
              </div>
          )}

          {showIconPicker && (
              <div
                className="absolute z-[9999] top-full mt-2"
                style={{ left: !compact ? `calc(var(--header-icon-size) * -0.1)` : 0 }}
                data-no-auto-close="true"
              >
                  <Suspense fallback={null}>
                    <IconPicker
                        onSelect={handleIconSelect}
                        onPreview={handlePreview}
                        onPreviewSkinTone={handlePreviewTone}
                        onRemove={handleRemoveIcon}
                        onClose={handlePickerClose}
                        
                        hasIcon={!!icon}
                        currentIcon={icon || undefined}
                        
                        currentSize={!compact ? currentSliderValue : undefined}
                        minSize={!compact ? minIconSize : undefined}
                        maxSize={!compact ? maxIconSize : undefined}
                        onSizeChange={!compact ? handleLocalSizeChange : undefined}
                        onSizeConfirm={!compact ? handleLocalSizeConfirm : undefined}

                        customIcons={customIcons}
                        onUploadFile={onUploadFile}
                        onDeleteCustomIcon={onDeleteCustomIcon}
                        imageLoader={imageLoader}
                    />
                  </Suspense>
              </div>
          )}
        </div>

        {compact && (
          <div className="flex-1 min-w-0">
             {renderTitle ? renderTitle() : (
                <div className="text-base font-bold text-[var(--vlaina-text-primary)] break-words">
                    {title}
                </div>
             )}
          </div>
        )}
      
      </div>

      {!compact && (
        <>
          {renderTitle && (
              <div className="mb-4 pointer-events-auto">
                  {renderTitle()}
              </div>
          )}
          {title !== undefined && !renderTitle && (
              <div className="mb-4 pointer-events-auto text-4xl font-bold text-[var(--vlaina-text-primary)] break-words outline-none placeholder:text-[var(--vlaina-text-tertiary)]">
                  {title}
              </div>
          )}
        </>
      )}
    </div>
  );
}
