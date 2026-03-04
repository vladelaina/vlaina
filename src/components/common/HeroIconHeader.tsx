import { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { Icon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { AppIcon } from '@/components/common/AppIcon';
import { type CustomIcon } from '@/lib/storage/unifiedStorage';
import { useUIStore } from '@/stores/uiSlice';
import { getRandomEmojiFromPreference } from '@/components/common/UniversalIconPicker/randomEmoji';
import { type ItemColor, COLOR_HEX } from '@/lib/colors';
import { ICON_SIZES, IconSize } from '@/components/ui/icons/sizes';

const IconPicker = lazy(async () => {
  const mod = await import('@/components/common/UniversalIconPicker/index');
  return { default: mod.UniversalIconPicker };
});

interface HeroIconHeaderProps {
  // Identity
  id: string; // Used for preview targeting
  icon: string | null;
  onIconChange: (icon: string | null) => void;
  onColorChange?: (color: ItemColor) => void;
  initialColor?: ItemColor;
  
  // Title (Optional rendering)
  title?: string;
  renderTitle?: () => React.ReactNode;

  // Size Control
  iconSize?: number | IconSize;
  minIconSize?: number;
  maxIconSize?: number;
  sliderValue?: number; // If provided, decouples slider from icon visual size
  onSizeChange?: (size: number) => void;
  onSizeConfirm?: (size: number) => void;

  // Upload / Customization Context
  customIcons?: CustomIcon[];
  onUploadFile?: (file: File) => Promise<{ success: boolean; url?: string; error?: string }>;
  onDeleteCustomIcon?: (id: string) => void;
  imageLoader?: (src: string) => Promise<string>;

  // Layout / Style
  className?: string;
  coverUrl?: string | null; // Affects layout (margin/padding)
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
    
    // Priority: Preview > Original (Store/Local)
    const finalIcon = previewIcon ?? originalIcon;
    
    // Resolve color: Preview (ItemColor -> Hex) > Undefined (Let AppIcon parse from string)
    let finalColorHex: string | undefined;
    if (isPreviewing && universalPreviewColor) {
        finalColorHex = COLOR_HEX[universalPreviewColor as ItemColor] || COLOR_HEX['default'];
    }

    if (!finalIcon) return null;

    return (
        <AppIcon 
          icon={finalIcon} 
          color={finalColorHex} // Pass hex color
          size={sizeVar} // Pass CSS variable string
          imageLoader={imageLoader}
        />
    );
}

export function HeroIconHeader({
  id,
  icon,
  onIconChange,
  iconSize = 60, // Default visual size
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

  // Universal Preview Hook
  // We use the entity ID to namespace the preview
  const { handlePreview, handlePreviewTone } = useIconPreview(id);
  
  // Reactively track preview size (only for standard mode)
  const universalPreviewTarget = useUIStore(s => s.universalPreviewTarget);
  const universalPreviewIconSize = useUIStore(s => s.universalPreviewIconSize);
  const isPreviewing = universalPreviewTarget === id;
  const effectiveSize = (!compact && isPreviewing && universalPreviewIconSize !== null) 
    ? universalPreviewIconSize 
    : resolvedIconSize;

  // Sync CSS variable for size (VISUAL ONLY)
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.style.setProperty('--header-icon-size', `${effectiveSize}px`);
    }
  }, [effectiveSize]);

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

  // High-performance size update (direct DOM)
  const handleLocalSizeChange = useCallback((newSize: number) => {
    // Only update visual size locally if we are NOT in decoupled mode
    if (sliderValue === undefined && headerRef.current) {
      headerRef.current.style.transition = 'none';
      headerRef.current.style.setProperty('--header-icon-size', `${newSize}px`);
    }
    // Notify parent
    onSizeChange?.(newSize);
  }, [onSizeChange, sliderValue]);

  const handleLocalSizeConfirm = useCallback((newSize: number) => {
    if (sliderValue === undefined && headerRef.current) {
      headerRef.current.style.transition = '';
    }
    onSizeConfirm?.(newSize);
  }, [onSizeConfirm, sliderValue]);

  // Determine what value the slider should show
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
      
      {/* Main Container: Flex row for compact, Block for standard */}
      <div className={cn(compact ? "flex items-center gap-3 py-2" : "pointer-events-none")}>
        
        {/* Icon Area */}
        <div
          className={cn(
              "duration-150 relative",
              "transition-[padding,opacity]",
              !compact && "w-fit",
              !compact && "z-30",
              !compact && "pointer-events-auto",
              !compact && "pb-4",
              !compact && (coverUrl ? "pt-0" : "pt-10") // Default top padding only for standard mode
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
                          key={icon || 'empty'} // Force re-mount on icon change
                          itemId={id} 
                          originalIcon={icon}
                          sizeVar="var(--header-icon-size)" 
                          imageLoader={imageLoader}
                      />
                  </button>
              </div>
          ) : (
              // Placeholder / Add Button
              <div className={cn(
                  "flex items-center gap-2 transition-all duration-150",
                  compact ? "h-8" : "h-14",
                  isHoveringHeader ? "opacity-100" : (compact ? "opacity-50" : "opacity-0")
              )}>
                  <button
                      ref={iconButtonRef}
                      onClick={() => {
                          void (async () => {
                            const randomEmoji = await getRandomEmojiFromPreference();
                            onIconChange(randomEmoji);
                            setShowIconPicker(true);
                          })();
                      }}
                      className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)] transition-colors")}
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
                        
                        // Slider props (Hidden in compact mode as it's provided externally)
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

        {/* Title Area (Compact Mode: Inline) */}
        {compact && (
          <div className="flex-1 min-w-0">
             {renderTitle ? renderTitle() : (
                <div className="text-base font-bold text-[var(--neko-text-primary)] break-words">
                    {title}
                </div>
             )}
          </div>
        )}
      
      </div>

      {/* Title Area (Standard Mode: Below) */}
      {!compact && (
        <>
          {renderTitle && (
              <div className="mb-4 pointer-events-auto">
                  {renderTitle()}
              </div>
          )}
          {title !== undefined && !renderTitle && (
              <div className="mb-4 pointer-events-auto text-4xl font-bold text-[var(--neko-text-primary)] break-words outline-none placeholder:text-[var(--neko-text-tertiary)]">
                  {title}
              </div>
          )}
        </>
      )}
    </div>
  );
}
