import { lazy, Suspense, useCallback, useState } from 'react';
import { AppIcon } from '@/components/common/AppIcon';
import { useGlobalIconUpload } from '@/components/common/UniversalIconPicker/hooks/useGlobalIconUpload';
import type { IconData } from './types';
import { DEFAULT_CALLOUT_ICON } from './types';
import { getCalloutIconValue } from './calloutIconUtils';

const UniversalIconPicker = lazy(async () => {
  const mod = await import('@/components/common/UniversalIconPicker/index');
  return { default: mod.UniversalIconPicker };
});

interface CalloutIconControlProps {
  icon: IconData;
  onChange: (value: string) => void;
}

interface CalloutIconPickerProps {
  currentIcon: string;
  onClose: () => void;
  onPreview: (value: string | null) => void;
  onRemove: () => void;
  onSelect: (value: string) => void;
}

function CalloutIconPicker({
  currentIcon,
  onClose,
  onPreview,
  onRemove,
  onSelect,
}: CalloutIconPickerProps) {
  const { customIcons, onUploadFile, onDeleteCustomIcon } = useGlobalIconUpload();

  return (
    <UniversalIconPicker
      onSelect={onSelect}
      onPreview={onPreview}
      onRemove={onRemove}
      onClose={onClose}
      hasIcon
      currentIcon={currentIcon}
      customIcons={customIcons}
      onUploadFile={onUploadFile}
      onDeleteCustomIcon={onDeleteCustomIcon}
    />
  );
}

export function CalloutIconControl({ icon, onChange }: CalloutIconControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [previewIcon, setPreviewIcon] = useState<string | null>(null);
  const iconValue = getCalloutIconValue(icon);
  const displayedIcon = previewIcon || iconValue;

  const handleSelect = useCallback((value: string) => {
    onChange(value);
    setPreviewIcon(null);
    setIsOpen(false);
  }, [onChange]);

  const handleRemove = useCallback(() => {
    onChange(DEFAULT_CALLOUT_ICON.value);
    setPreviewIcon(null);
    setIsOpen(false);
  }, [onChange]);

  return (
    <span className="callout-icon-control" data-prevent-picker-close="true">
      <button
        type="button"
        className="callout-icon-button"
        aria-label="Change callout icon"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsOpen(true);
        }}
      >
        <AppIcon icon={displayedIcon} size={20} />
      </button>

      {isOpen && (
        <span className="callout-icon-picker" data-prevent-picker-close="true">
          <Suspense fallback={null}>
            <CalloutIconPicker
              currentIcon={iconValue}
              onClose={() => {
                setPreviewIcon(null);
                setIsOpen(false);
              }}
              onPreview={setPreviewIcon}
              onRemove={handleRemove}
              onSelect={handleSelect}
            />
          </Suspense>
        </span>
      )}
    </span>
  );
}
