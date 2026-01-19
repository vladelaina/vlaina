import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UniversalIconPicker as IconPicker } from '@/components/common/UniversalIconPicker';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { AppIcon } from '@/components/common/AppIcon';
import { type CustomIcon } from '@/lib/storage/unifiedStorage';
import { useUIStore } from '@/stores/uiSlice';
import { getRandomEmoji, loadSkinTone } from '@/components/common/UniversalIconPicker/constants';

interface HeroIconHeaderProps {
  // Identity
  id: string; // Used for preview targeting
  icon: string | null;
  onIconChange: (icon: string | null) => void;
  
  // Title (Optional rendering)
  title?: string;
  renderTitle?: () => React.ReactNode;

  // Size Control
  iconSize?: number;
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
    const { universalPreviewTarget, universalPreviewIcon, universalPreviewColor } = useUIStore();
    
    const isPreviewing = universalPreviewTarget === itemId;
    const previewIcon = (isPreviewing && universalPreviewIcon) ? universalPreviewIcon : null;
    
    // Priority: Preview > Original (Store/Local)
    const finalIcon = previewIcon ?? originalIcon;
    const finalColor = (isPreviewing && universalPreviewColor) ? universalPreviewColor : undefined;

    if (!finalIcon) return null;

    return (
        <AppIcon 
          icon={finalIcon} 
          color={finalColor} // Pass preview color
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
  const [pickerPosition, setPickerPosition] = useState<{ top: number; left: number } | null>(null);
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);

  // Universal Preview Hook
  // We use the entity ID to namespace the preview
  const { handlePreview, handlePreviewTone, handlePreviewColor } = useIconPreview(id);
  
  // Reactively track preview size (only for standard mode)
  const { universalPreviewTarget, universalPreviewIconSize } = useUIStore();
  const isPreviewing = universalPreviewTarget === id;
  const effectiveSize = (!compact && isPreviewing && universalPreviewIconSize !== null) 
    ? universalPreviewIconSize 
    : iconSize;

  // Sync CSS variable for size (VISUAL ONLY)
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.style.setProperty('--header-icon-size', `${effectiveSize}px`);
    }
  }, [effectiveSize]);

  const updatePickerPosition = () => {
    if (iconButtonRef.current) {
      const rect = iconButtonRef.current.getBoundingClientRect();
      setPickerPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  };

  const handleIconSelect = (newIcon: string) => {
    onIconChange(newIcon);
  };

  const handleRemoveIcon = () => {
    onIconChange(null);
  };

  const handlePickerClose = () => {
    setShowIconPicker(false);
    setIsHoveringHeader(false);
    handlePreview(null);
  };

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
  const currentSliderValue = sliderValue !== undefined ? sliderValue : iconSize;
  
  return (
    <div
      ref={headerRef}
      className={cn(
        "relative transition-[margin-top] duration-75 ease-out w-full",
        !compact && "max-w-3xl mx-auto px-10",
        className
      )}
      style={{
        '--header-icon-size': `${iconSize}px`,
        marginTop: coverUrl ? `calc(var(--header-icon-size) * -0.618)` : undefined,
      } as React.CSSProperties}
    >
      {children}
      
      {/* Main Container: Flex row for compact, Block for standard */}
      <div className={cn(compact ? "flex items-center gap-3 py-2" : "")}>
        
        {/* Icon Area */}
        <div
          className={cn(
              "duration-150 relative",
              "transition-[padding,opacity]",
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
                        updatePickerPosition();
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
                          const currentSkinTone = loadSkinTone();
                          const randomEmoji = getRandomEmoji(currentSkinTone);
                          onIconChange(randomEmoji);
                          updatePickerPosition();
                          setShowIconPicker(true);
                      }}
                      className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)] transition-colors")}
                  >
                      <HeartPulse className="size-4" />
                      {!compact && <span>Add icon</span>}
                  </button>
              </div>
          )}

          {showIconPicker && pickerPosition && createPortal(
              <div 
                className="fixed z-[9999]"
                style={{ top: pickerPosition.top, left: pickerPosition.left }}
              >
                  <IconPicker
                      onSelect={handleIconSelect}
                      onPreview={handlePreview}
                      onPreviewSkinTone={handlePreviewTone}
                      onPreviewColor={handlePreviewColor}
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
              </div>,
              document.body
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
              <div className="mb-4">
                  {renderTitle()}
              </div>
          )}
          {title !== undefined && !renderTitle && (
              <div className="mb-4 text-4xl font-bold text-[var(--neko-text-primary)] break-words outline-none placeholder:text-[var(--neko-text-tertiary)]">
                  {title}
              </div>
          )}
        </>
      )}
    </div>
  );
}
