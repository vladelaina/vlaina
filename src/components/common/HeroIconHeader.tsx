import { useState, useRef, useCallback, useEffect } from 'react';
import { HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';
import { UniversalIconPicker as IconPicker } from '@/components/common/UniversalIconPicker';
import { useIconPreview } from '@/components/common/UniversalIconPicker/useIconPreview';
import { AppIcon } from '@/components/common/AppIcon';
import { type CustomIcon } from '@/lib/storage/unifiedStorage';
import { useUIStore } from '@/stores/uiSlice';
import { getRandomEmoji, loadRecentIcons, addToRecentIcons, loadSkinTone } from '@/components/common/UniversalIconPicker/constants';

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
}

function HeaderIcon({ itemId, originalIcon, sizeVar }: { itemId: string, originalIcon: string | null, sizeVar: string }) {
    const { universalPreviewTarget, universalPreviewIcon, universalPreviewColor } = useUIStore();
    
    const isPreviewing = universalPreviewTarget === itemId;
    const finalIcon = (isPreviewing && universalPreviewIcon) ? universalPreviewIcon : originalIcon;
    const finalColor = (isPreviewing && universalPreviewColor) ? universalPreviewColor : undefined;

    if (!finalIcon) return null;

    return (
        <AppIcon 
          icon={finalIcon} 
          color={finalColor} // Pass preview color
          size={sizeVar} // Pass CSS variable string
        />
    );
}

export function HeroIconHeader({
  id,
  icon,
  onIconChange,
  iconSize = 60, // Default size
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
}: HeroIconHeaderProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const iconButtonRef = useRef<HTMLButtonElement>(null);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isHoveringHeader, setIsHoveringHeader] = useState(false);

  // Universal Preview Hook
  // We use the entity ID to namespace the preview
  const { handlePreview, handlePreviewTone, handlePreviewColor } = useIconPreview(id);

  // Sync CSS variable for size
  useEffect(() => {
    if (headerRef.current) {
      headerRef.current.style.setProperty('--header-icon-size', `${iconSize}px`);
    }
  }, [iconSize]);

  const handleIconSelect = (newIcon: string) => {
    onIconChange(newIcon);
    handlePreview(null);
  };

  const handleRemoveIcon = () => {
    onIconChange(null);
    handlePreview(null);
  };

  const handlePickerClose = () => {
    setShowIconPicker(false);
    setIsHoveringHeader(false);
    handlePreview(null);
  };

  // High-performance size update (direct DOM)
  const handleLocalSizeChange = useCallback((newSize: number) => {
    if (headerRef.current) {
      headerRef.current.style.transition = 'none';
      headerRef.current.style.setProperty('--header-icon-size', `${newSize}px`);
    }
    // Notify parent if needed (e.g. for persisting, but usually onSizeConfirm is better)
    onSizeChange?.(newSize);
  }, [onSizeChange]);

  const handleLocalSizeConfirm = useCallback((newSize: number) => {
    if (headerRef.current) {
      headerRef.current.style.transition = '';
    }
    onSizeConfirm?.(newSize);
  }, [onSizeConfirm]);

  return (
    <div
      ref={headerRef}
      className={cn(
        "relative transition-[margin-top] duration-75 ease-out w-full max-w-3xl mx-auto px-10", // Added standard width/padding
        className
      )}
      style={{
        '--header-icon-size': `${iconSize}px`,
        marginTop: coverUrl ? `calc(var(--header-icon-size) * -0.618)` : undefined,
      } as React.CSSProperties}
    >
      {children}
      <div
        className={cn(
            "pb-4 duration-150 relative",
            "transition-[padding,opacity]",
            coverUrl ? "pt-0" : "pt-10" // Default top padding
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
                    onClick={() => setShowIconPicker(true)}
                    className="hover:scale-105 transition-transform cursor-pointer flex items-center group"
                    style={{
                        marginLeft: `calc(var(--header-icon-size) * -0.1)`
                    }}
                >
                    <HeaderIcon 
                        itemId={id} 
                        originalIcon={icon} 
                        sizeVar="var(--header-icon-size)" 
                    />
                </button>
            </div>
        ) : (
            // Placeholder / Add Button
            <div className={cn(
                "flex items-center gap-2 transition-all duration-150 h-14",
                isHoveringHeader ? "opacity-100" : "opacity-0"
            )}>
                <button
                    ref={iconButtonRef}
                    onClick={() => {
                        // "Surprise Me" Logic: Generate random start icon
                        const currentSkinTone = loadSkinTone();
                        const randomEmoji = getRandomEmoji(currentSkinTone);
                        
                        // Apply immediately
                        onIconChange(randomEmoji);
                        
                        // Track history
                        const currentRecent = loadRecentIcons();
                        addToRecentIcons(randomEmoji, currentRecent);
                        
                        setShowIconPicker(true);
                    }}
                    className={cn("flex items-center gap-1.5 py-1 rounded-md text-sm text-[var(--neko-text-secondary)] hover:text-[var(--neko-text-primary)] transition-colors")}
                >
                    <HeartPulse className="size-4" />
                    <span>Add icon</span>
                </button>
            </div>
        )}

        {showIconPicker && (
            <div className="relative">
                <div className="absolute top-2 left-0 z-50">
                    <IconPicker
                        onSelect={handleIconSelect}
                        onPreview={handlePreview}
                        onPreviewSkinTone={handlePreviewTone}
                        onPreviewColor={handlePreviewColor}
                        onRemove={handleRemoveIcon}
                        onClose={handlePickerClose}
                        
                        hasIcon={!!icon}
                        currentIcon={icon || undefined}
                        
                        // Slider props
                        currentSize={iconSize}
                        onSizeChange={handleLocalSizeChange}
                        onSizeConfirm={handleLocalSizeConfirm}

                        customIcons={customIcons}
                        onUploadFile={onUploadFile}
                        onDeleteCustomIcon={onDeleteCustomIcon}
                        imageLoader={imageLoader}
                    />
                </div>
            </div>
        )}
      </div>

      {/* Title Area */}
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
    </div>
  );
}
